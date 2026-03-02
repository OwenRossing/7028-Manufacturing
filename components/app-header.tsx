"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddPartControl } from "@/components/add-part-control";
import { isProjectScopedPath } from "@/lib/route-scope";
import { queryKeys } from "@/lib/query-keys";

type ProjectOption = {
  id: string;
  name: string;
  health: "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
  done: number;
  total: number;
};

type AppHeaderProps = {
  projects: ProjectOption[];
  completed: number;
  total: number;
};

export function AppHeader({ projects, completed, total }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(paramsString), [paramsString]);
  const activeTab = params.get("tab");
  const [projectOpen, setProjectOpen] = useState(false);
  const projectRef = useRef<HTMLDivElement | null>(null);
  const activeProjectId = params.get("projectId");
  const isProjectScoped = isProjectScopedPath(pathname);
  const metricsQueryString = useMemo(() => {
    const next = new URLSearchParams();
    if (activeProjectId) next.set("projectId", activeProjectId);
    return next.toString();
  }, [activeProjectId]);
  const metricsQuery = useQuery({
    queryKey: queryKeys.metrics.byProject(activeProjectId),
    queryFn: async () => {
      const response = await fetch(`/api/parts/metrics${metricsQueryString ? `?${metricsQueryString}` : ""}`);
      if (!response.ok) throw new Error("Unable to load metrics.");
      return (await response.json()) as { doneParts: number; totalParts: number };
    },
    refetchInterval: 10_000
  });
  const liveCompleted = metricsQuery.data?.doneParts ?? completed;
  const liveTotal = metricsQuery.data?.totalParts ?? total;

  useEffect(() => {
    if (pathname !== "/" || activeProjectId || projects.length === 0) return;
    const nextParams = new URLSearchParams(paramsString);
    nextParams.set("projectId", projects[0].id);
    router.replace(`/?${nextParams.toString()}`, { scroll: false });
  }, [pathname, activeProjectId, projects, paramsString, router]);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (projectRef.current && !projectRef.current.contains(event.target as Node)) setProjectOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const activeProjectName = useMemo(
    () => projects.find((project) => project.id === activeProjectId)?.name ?? "Select a project",
    [projects, activeProjectId]
  );

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  function projectHealthClass(health: ProjectOption["health"]): string {
    if (health === "ON_TRACK") return "text-[#8bc53f]";
    if (health === "AT_RISK") return "text-[#f5c84b]";
    return "text-[#ff6b6b]";
  }

  const isOverviewTab = activeTab === "overview" || activeTab === "community";
  const isBoardTab = activeTab === "board";
  const boardActive = pathname === "/" && isBoardTab;
  const overviewActive = pathname === "/" && isOverviewTab;
  const accountActive = pathname.startsWith("/settings") || pathname.startsWith("/projects");

  const overviewHref = useMemo(() => {
    const next = new URLSearchParams(paramsString);
    next.set("tab", "overview");
    return `/?${next.toString()}`;
  }, [paramsString]);

  const boardHref = useMemo(() => {
    const next = new URLSearchParams(paramsString);
    next.set("tab", "board");
    return `/?${next.toString()}`;
  }, [paramsString]);

  function topTabClass(active: boolean): string {
    return [
      "relative inline-flex items-center pb-0.5 text-lg font-semibold md:text-2xl",
      "after:absolute after:-bottom-[4px] after:left-0 after:h-[3px] after:rounded-full after:bg-[#1a9fff] after:transition-all",
      active
        ? "text-[#1a9fff] after:w-full"
        : "text-[#c7d5e0] hover:text-white after:w-0 hover:after:w-full"
    ].join(" ");
  }

  return (
    <header className="sticky top-0 z-50 bg-[#171d25]">
      <div className="border-b border-[#233246] px-3 py-0.5 text-center text-[11px] text-[#8fa0b2] lg:hidden">
        {liveCompleted} of {liveTotal} complete
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-2">
        <div className="hidden items-center gap-5 text-[30px] font-bold tracking-wide text-steel-100 lg:flex">
          <Link href={boardHref} className={topTabClass(boardActive)}>BOARD</Link>
          <Link href={overviewHref} className={topTabClass(overviewActive)}>OVERVIEW</Link>
          <Link href="/settings" className={topTabClass(accountActive)}>ACCOUNT</Link>
        </div>

        {isProjectScoped ? (
          <div className="relative ml-auto" ref={projectRef}>
            <Button variant="secondary" onClick={() => setProjectOpen((prev) => !prev)} className="h-10 w-52 justify-between rounded-sm border-steel-600 bg-steel-900">
              <span className={`truncate ${projectHealthClass(activeProject?.health ?? "OFF_TRACK")}`}>
                {activeProjectName}
              </span>
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
            {projectOpen ? (
              <div className="absolute right-0 mt-2 w-64 rounded-sm border border-steel-700 bg-steel-900 p-2 shadow-2xl">
                <p className="px-2 pb-2 text-xs uppercase tracking-wide text-steel-300">Project</p>
                {projects.map((project) => {
                  const nextParams = new URLSearchParams(paramsString);
                  nextParams.set("projectId", project.id);
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => {
                        if (pathname === "/") router.replace(`/?${nextParams.toString()}`, { scroll: false });
                        else router.push(`/?${nextParams.toString()}`);
                        setProjectOpen(false);
                      }}
                      className={`mb-1 block w-full rounded-sm border px-2 py-2 text-left text-sm ${
                        project.id === activeProjectId
                          ? "border-accent-500 bg-accent-500/15 text-accent-300"
                          : "border-steel-700 bg-steel-850 text-white hover:bg-steel-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate ${projectHealthClass(project.health)}`}>{project.name}</span>
                        <span className="text-xs text-[#8f98a0]">
                          {project.done}/{project.total || 0}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="ml-auto" />
        )}
        {isProjectScoped ? (
          <AddPartControl className="inline-flex h-10 items-center gap-2 rounded-[3px] border border-[#2f6eb6] bg-[#1a9fff] px-3 text-sm font-semibold text-white hover:bg-[#3aaeff]" />
        ) : null}
      </div>
    </header>
  );
}
