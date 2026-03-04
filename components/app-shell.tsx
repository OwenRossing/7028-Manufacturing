"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AppBottomBar } from "@/components/app-bottom-bar";
import { AppHeader } from "@/components/app-header";

type ProjectOption = {
  id: string;
  name: string;
  health: "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
  done: number;
  total: number;
};

export function AppShell({
  children,
  projects,
  completed,
  total
}: {
  children: React.ReactNode;
  projects: ProjectOption[];
  completed: number;
  total: number;
}) {
  const pathname = usePathname();
  const hideChrome = pathname.startsWith("/login");
  const isWorkspacePath = pathname === "/" || pathname.startsWith("/parts") || pathname.startsWith("/import");
  const shellClassName = isWorkspacePath
    ? "fixed inset-0 flex overflow-hidden bg-[#1b2838] text-white"
    : "min-h-screen bg-[#1b2838] text-white";
  const shellInnerClassName = isWorkspacePath ? "flex w-full min-h-0 flex-1 flex-col" : "w-full";
  const mainClassName = hideChrome
    ? "w-full"
    : isWorkspacePath
      ? "min-h-0 w-full flex-1 overflow-hidden pb-12"
      : "w-full pb-12";

  return (
    <div className={shellClassName}>
      <div className={shellInnerClassName}>
        {!hideChrome ? (
          <Suspense fallback={null}>
            <AppHeader projects={projects} completed={completed} total={total} />
          </Suspense>
        ) : null}
        <main className={mainClassName}>{children}</main>
        {!hideChrome ? (
          <Suspense fallback={null}>
            <AppBottomBar completed={completed} total={total} />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}
