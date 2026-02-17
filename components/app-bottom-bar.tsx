"use client";

import { useEffect, useState } from "react";
import { Home, Users, User, Smartphone, Monitor, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AppBottomBar({ completed, total }: { completed: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const [uiMode, setUiMode] = useState<"auto" | "mobile" | "desktop">("auto");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ui-mode");
      if (stored === "mobile" || stored === "desktop" || stored === "auto") {
        setUiMode(stored);
      }
    } catch {
      setUiMode("auto");
    }
  }, []);

  function setMode(mode: "auto" | "mobile" | "desktop") {
    setUiMode(mode);
    try {
      window.localStorage.setItem("ui-mode", mode);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent("ui-mode-change", { detail: mode }));
  }

  const overviewActive =
    pathname === "/" && (searchParams.get("tab") === "overview" || searchParams.get("tab") === "community");
  const accountActive = pathname.startsWith("/settings");
  const homeActive = pathname === "/" && !overviewActive;

  function goHome() {
    const next = new URLSearchParams(paramsString);
    next.delete("tab");
    router.push(next.toString() ? `/?${next.toString()}` : "/");
  }

  function goOverview() {
    const next = new URLSearchParams(paramsString);
    next.set("tab", "overview");
    router.push(`/?${next.toString()}`);
  }

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 h-12 border-t border-[#1f2b3a] bg-[#171d25]">
      <div className="mx-auto hidden h-full w-full items-center justify-between px-5 text-sm text-[#67707b] lg:flex">
        <div>{completed} of {total} parts complete</div>
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("auto")}
            className={`rounded-[3px] border px-2 py-1 ${
              uiMode === "auto"
                ? "border-[#1a9fff] bg-[#1a9fff]/25 text-[#cde9ff]"
                : "border-[#324154] bg-[#202b3a] text-[#8fa0b2]"
            }`}
          >
            Auto
          </button>
          <button
            type="button"
            onClick={() => setMode("mobile")}
            className={`rounded-[3px] border px-2 py-1 ${
              uiMode === "mobile"
                ? "border-[#1a9fff] bg-[#1a9fff]/25 text-[#cde9ff]"
                : "border-[#324154] bg-[#202b3a] text-[#8fa0b2]"
            }`}
          >
            Mobile
          </button>
          <button
            type="button"
            onClick={() => setMode("desktop")}
            className={`rounded-[3px] border px-2 py-1 ${
              uiMode === "desktop"
                ? "border-[#1a9fff] bg-[#1a9fff]/25 text-[#cde9ff]"
                : "border-[#324154] bg-[#202b3a] text-[#8fa0b2]"
            }`}
          >
            Desktop
          </button>
        </div>
      </div>
      <div className="mx-auto flex h-full w-full items-center justify-around px-3 text-[#9aa8b8] lg:hidden">
        <button type="button" onClick={goHome} className={`inline-flex flex-col items-center text-[10px] ${homeActive ? "text-[#1a9fff]" : ""}`}>
          <Home className="h-4 w-4" />
          Home
        </button>
        <button type="button" onClick={goOverview} className={`inline-flex flex-col items-center text-[10px] ${overviewActive ? "text-[#1a9fff]" : ""}`}>
          <Users className="h-4 w-4" />
          Overview
        </button>
        <button type="button" onClick={() => router.push("/settings")} className={`inline-flex flex-col items-center text-[10px] ${accountActive ? "text-[#1a9fff]" : ""}`}>
          <User className="h-4 w-4" />
          Account
        </button>
        <button type="button" onClick={() => setMode("mobile")} className="inline-flex flex-col items-center text-[10px]">
          <Smartphone className="h-4 w-4" />
          Mobile
        </button>
        <button type="button" onClick={() => setMode("desktop")} className="inline-flex flex-col items-center text-[10px]">
          <Monitor className="h-4 w-4" />
          Desktop
        </button>
        <button type="button" onClick={() => setMode("auto")} className="inline-flex flex-col items-center text-[10px]">
          <SlidersHorizontal className="h-4 w-4" />
          Auto
        </button>
      </div>
    </footer>
  );
}
