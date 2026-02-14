"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Search, Settings, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const activeProjectId = params.get("projectId");

  useEffect(() => {
    setSearch(params.get("q") ?? "");
  }, [paramsString, params]);

  useEffect(() => {
    if (pathname !== "/" || activeProjectId || projects.length === 0) return;
    const nextParams = new URLSearchParams(paramsString);
    nextParams.set("projectId", projects[0].id);
    router.replace(`/?${nextParams.toString()}`, { scroll: false });
  }, [pathname, activeProjectId, projects, paramsString, router]);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (!accountRef.current) return;
      if (accountRef.current.contains(event.target as Node)) return;
      setAccountOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const activeProjectName = useMemo(
    () => projects.find((project) => project.id === activeProjectId)?.name ?? "No project selected",
    [projects, activeProjectId]
  );

  function onProjectChange(projectId: string) {
    const nextParams = new URLSearchParams();
    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      nextParams.set("q", trimmedSearch);
    }
    if (projectId) {
      nextParams.set("projectId", projectId);
    }
    router.push(`/?${nextParams.toString()}`);
  }

  function runSearch(raw: string) {
    const trimmedSearch = raw.trim();
    const nextParams = new URLSearchParams();
    if (trimmedSearch) {
      nextParams.set("q", trimmedSearch);
    }
    if (activeProjectId) {
      nextParams.set("projectId", activeProjectId);
    }
    const nextUrl = `/?${nextParams.toString()}`;
    if (pathname === "/") {
      router.replace(nextUrl, { scroll: false });
    } else {
      router.push(nextUrl);
    }
  }

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(search);
  }

  return (
    <header className="sticky top-0 z-40 isolate border-b border-steel-700 bg-steel-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-bold text-white">
          7028 Parts
        </Link>

        <form onSubmit={onSearchSubmit} className="order-3 w-full md:order-none md:flex-1">
          <div className="flex h-10 overflow-hidden rounded-md border border-steel-700 bg-steel-850">
            <button
              type="submit"
              aria-label="Search"
              className="flex items-center border-r border-steel-700 bg-brand-500 px-3 text-stone-950 hover:bg-brand-400"
            >
              <Search className="h-4 w-4" />
            </button>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-full rounded-none border-0 bg-transparent focus:border-0 focus:ring-0"
              placeholder="Search by part number, name, owner, status..."
            />
            <Link
              href="/parts/new"
              className="inline-flex items-center border-l border-steel-700 bg-brand-500 px-4 text-sm font-semibold text-stone-950 hover:bg-brand-400"
            >
              <Plus className="h-4 w-4" />
            </Link>
          </div>
        </form>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <span className="text-xs uppercase tracking-wide text-steel-300">Project</span>
          <Select
            value={activeProjectId ?? ""}
            onChange={(event) => onProjectChange(event.target.value)}
            className="w-52"
          >
            {!projects.length ? <option value="">No projects yet</option> : null}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative" ref={accountRef}>
          <Button variant="secondary" onClick={() => setAccountOpen((prev) => !prev)}>
            <span className="max-w-36 truncate">{userName ?? "Account"}</span>
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
          {accountOpen ? (
            <div className="absolute right-0 mt-2 w-64 rounded-md border border-steel-700 bg-steel-900 p-2 shadow-2xl">
              <p className="px-2 py-1 text-xs uppercase tracking-wide text-steel-300">Account</p>
              <p className="px-2 pb-2 text-sm text-white">{userName ?? "Not signed in"}</p>
              <p className="px-2 pb-2 text-xs text-steel-300">Project: {activeProjectName}</p>
              <Link href="/settings" className="clickable-surface mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-white">
                <Settings className="h-4 w-4 text-steel-300" />
                Settings
              </Link>
              <Link href="/projects" className="clickable-surface mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-white">
                <Wrench className="h-4 w-4 text-steel-300" />
                Project Admin
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 pb-3 sm:hidden">
        <span className="text-xs uppercase tracking-wide text-steel-300">Project</span>
        <Select
          value={activeProjectId ?? ""}
          onChange={(event) => onProjectChange(event.target.value)}
          className="h-9"
        >
          {!projects.length ? <option value="">No projects yet</option> : null}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </div>
    </header>
  );
}
