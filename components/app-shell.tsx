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

  return (
    <div className="min-h-screen bg-[#1b2838] text-white">
      {!hideChrome ? (
        <Suspense fallback={null}>
          <AppHeader projects={projects} completed={completed} total={total} />
        </Suspense>
      ) : null}
      <main className={hideChrome ? "w-full" : "w-full pb-12"}>{children}</main>
      {!hideChrome ? (
        <Suspense fallback={null}>
          <AppBottomBar completed={completed} total={total} />
        </Suspense>
      ) : null}
    </div>
  );
}

