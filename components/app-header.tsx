"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PlusCircle, Search } from "lucide-react";
import { ProjectDrawer } from "@/components/project-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProjectOption = {
  id: string;
  name: string;
};

type AppHeaderProps = {
  userName: string | null;
  projects: ProjectOption[];
};

export function AppHeader({ userName, projects }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(paramsString), [paramsString]);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const activeProjectId = params.get("projectId");

  useEffect(() => {
    setSearch(params.get("q") ?? "");
  }, [paramsString, params]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (pathname !== "/") return;
      const currentQuery = params.get("q") ?? "";
      if (currentQuery === search.trim()) return;
      const nextParams = new URLSearchParams(paramsString);
      if (search.trim()) {
        nextParams.set("q", search.trim());
      } else {
        nextParams.delete("q");
      }
      router.replace(`/?${nextParams.toString()}`, { scroll: false });
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, pathname, router, paramsString, params]);

  const activeProjectName = useMemo(
    () => projects.find((project) => project.id === activeProjectId)?.name ?? "All Projects",
    [projects, activeProjectId]
  );

  async function createProject(name: string) {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, season: new Date().getFullYear().toString() })
    });
    const data = (await response.json().catch(() => null)) as { id?: string } | null;
    if (response.ok && data?.id) {
      router.push(`/?projectId=${data.id}`);
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-steel-700 bg-steel-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-bold text-white">
          7028 Parts
        </Link>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-steel-300" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Search by part number, name, owner, status..."
          />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/parts/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Part
            </Button>
          </Link>
          <Link href="/import">
            <Button variant="secondary">Import</Button>
          </Link>
          <ProjectDrawer
            projects={projects}
            activeProjectId={activeProjectId}
            onProjectSelect={(projectId) => {
              const nextParams = new URLSearchParams(paramsString);
              nextParams.set("projectId", projectId);
              router.push(`/?${nextParams.toString()}`);
            }}
            onCreateProject={createProject}
          />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 pb-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-steel-300">Active project:</span>
          <span className="font-semibold text-white">{activeProjectName}</span>
          <Link href="/projects" className="text-steel-300 hover:text-white">
            Projects Page
          </Link>
          <Link href="/prototypes/projects-drawer-a" className="text-steel-300 hover:text-white">
            Prototype A
          </Link>
          <Link href="/prototypes/projects-drawer-b" className="text-steel-300 hover:text-white">
            Prototype B
          </Link>
        </div>
        <div className="text-steel-300">{userName ? `Account: ${userName}` : "Not signed in"}</div>
      </div>
    </header>
  );
}
