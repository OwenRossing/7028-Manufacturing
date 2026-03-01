"use client";

import { Kanban, Users, User } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function AppBottomBar({ completed, total }: { completed: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const activeProjectId = searchParams.get("projectId");
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

  const overviewActive =
    pathname === "/" && (searchParams.get("tab") === "overview" || searchParams.get("tab") === "community");
  const boardActive = pathname === "/" && (searchParams.get("tab") === "board" || !searchParams.get("tab"));
  const accountActive = pathname.startsWith("/settings") || pathname.startsWith("/projects");

  function goOverview() {
    const next = new URLSearchParams(paramsString);
    next.set("tab", "overview");
    router.push(`/?${next.toString()}`);
  }

  function goBoard() {
    const next = new URLSearchParams(paramsString);
    next.set("tab", "board");
    router.push(`/?${next.toString()}`);
  }

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 h-12 border-t border-[#1f2b3a] bg-[#171d25]">
      <div className="mx-auto hidden h-full w-full items-center justify-between px-5 text-sm text-[#67707b] lg:flex">
        <div>{liveCompleted} of {liveTotal} parts complete</div>
      </div>
      <div className="mx-auto flex h-full w-full items-center justify-around px-3 text-[#9aa8b8] lg:hidden">
        <button type="button" onClick={goBoard} className={`inline-flex flex-col items-center text-[10px] ${boardActive ? "text-[#1a9fff]" : ""}`}>
          <Kanban className="h-4 w-4" />
          Board
        </button>
        <button type="button" onClick={goOverview} className={`inline-flex flex-col items-center text-[10px] ${overviewActive ? "text-[#1a9fff]" : ""}`}>
          <Users className="h-4 w-4" />
          Overview
        </button>
        <button type="button" onClick={() => router.push("/settings")} className={`inline-flex flex-col items-center text-[10px] ${accountActive ? "text-[#1a9fff]" : ""}`}>
          <User className="h-4 w-4" />
          Account
        </button>
      </div>
    </footer>
  );
}
