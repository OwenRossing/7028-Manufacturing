"use client";

import { PartStatus } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { statusLabel } from "@/lib/status";
import { PartListItem } from "@/types/parts";

type PartsResponse = {
  items: PartListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type PartsMetricsResponse = {
  totalParts: number;
  doneParts: number;
  totalRequired: number;
  totalComplete: number;
  throughputPerDay: number;
  etaDays: number | null;
  etaDate: string | null;
  statusCounts: Record<PartStatus, number>;
};

function buildQuery(searchParams: URLSearchParams): string {
  const params = new URLSearchParams();
  const q = searchParams.get("q");
  const projectId = searchParams.get("projectId");
  const sort = searchParams.get("sort");
  const statuses = searchParams.getAll("status");

  if (q) params.set("q", q);
  if (projectId) params.set("projectId", projectId);
  if (sort) params.set("sort", sort);
  for (const status of statuses) {
    params.append("status", status);
  }
  return params.toString();
}

export function PartsExplorer() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryString = useMemo(() => buildQuery(searchParams), [searchParams]);

  const query = useQuery({
    queryKey: ["parts", queryString],
    queryFn: async () => {
      const response = await fetch(`/api/parts?${queryString}`);
      if (!response.ok) {
        throw new Error("Unable to load parts.");
      }
      return (await response.json()) as PartsResponse;
    }
  });
  const metricsQuery = useQuery({
    queryKey: ["parts-metrics", queryString],
    queryFn: async () => {
      const response = await fetch(`/api/parts/metrics?${queryString}`);
      if (!response.ok) {
        throw new Error("Unable to load parts metrics.");
      }
      return (await response.json()) as PartsMetricsResponse;
    }
  });

  const statusFilters = searchParams.getAll("status");

  function toggleStatus(value: PartStatus) {
    const params = new URLSearchParams(searchParams.toString());
    const current = new Set(params.getAll("status"));
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    params.delete("status");
    for (const status of current) {
      params.append("status", status);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function priorityLabel(priority: number): string {
    if (priority <= 1) return "High";
    if (priority === 2) return "Medium";
    if (priority === 3) return "Standard";
    if (priority === 4) return "Low";
    return "Backlog";
  }

  return (
    <section className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-white">Project Overview</h1>
            <p className="text-sm text-steel-300">
              Search and review parts in a catalog layout with quick filtering.
            </p>
          </div>
          <Badge>{query.data?.total ?? 0} results</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-steel-700 bg-steel-850 p-3">
            <p className="text-xs uppercase tracking-wide text-steel-300">Completion</p>
            <p className="text-xl font-semibold text-white">
              {metricsQuery.data?.totalRequired
                ? Math.round(((metricsQuery.data.totalComplete ?? 0) / metricsQuery.data.totalRequired) * 100)
                : 0}
              %
            </p>
            <p className="text-xs text-steel-300">
              {metricsQuery.data?.totalComplete ?? 0}/{metricsQuery.data?.totalRequired ?? 0} qty
            </p>
          </div>
          <div className="rounded-md border border-steel-700 bg-steel-850 p-3">
            <p className="text-xs uppercase tracking-wide text-steel-300">Done</p>
            <p className="text-xl font-semibold text-white">
              {metricsQuery.data?.doneParts ?? 0}
            </p>
            <p className="text-xs text-steel-300">{metricsQuery.data?.totalParts ?? 0} tracked parts</p>
          </div>
          <div className="rounded-md border border-steel-700 bg-steel-850 p-3">
            <p className="text-xs uppercase tracking-wide text-steel-300">Pace</p>
            <p className="text-xl font-semibold text-white">{(metricsQuery.data?.throughputPerDay ?? 0).toFixed(2)}/day</p>
            <p className="text-xs text-steel-300">based on current filtered set</p>
          </div>
          <div className="rounded-md border border-steel-700 bg-steel-850 p-3">
            <p className="text-xs uppercase tracking-wide text-steel-300">Predicted End</p>
            <p className="text-xl font-semibold text-white">
              {metricsQuery.data?.etaDate ? new Date(metricsQuery.data.etaDate).toLocaleDateString() : "Not enough data"}
            </p>
            <p className="text-xs text-steel-300">
              {metricsQuery.data?.etaDays ? `${metricsQuery.data.etaDays} days remaining` : "Need more progress"}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit space-y-3 lg:sticky lg:top-28">
          <h2 className="text-base font-semibold text-white">Filters</h2>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-steel-300">Status</p>
            {Object.values(PartStatus).map((status) => (
              <button
                type="button"
                key={status}
                onClick={() => toggleStatus(status)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  statusFilters.includes(status)
                    ? "border-brand-500 bg-brand-500/15 text-brand-300"
                    : "border-steel-700 bg-steel-850 text-steel-300 hover:bg-steel-800"
                }`}
              >
                <span>{statusLabel(status)}</span>
                {statusFilters.includes(status) ? <span>On</span> : null}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-steel-300">Sort</p>
            <Select
              value={searchParams.get("sort") ?? "recent"}
              onChange={(event) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("sort", event.target.value);
                router.replace(`/?${params.toString()}`, { scroll: false });
              }}
            >
              <option value="recent">Most recent</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="progress">Progress</option>
            </Select>
          </div>
          <div className="space-y-2 border-t border-steel-700 pt-3">
            <p className="text-xs uppercase tracking-wide text-steel-300">Status counts</p>
            {Object.values(PartStatus).map((status) => (
              <div key={status} className="flex items-center justify-between rounded-md border border-steel-700 bg-steel-850 px-2 py-1 text-xs">
                <span className="text-steel-300">{statusLabel(status)}</span>
                <span className="font-semibold text-white">{metricsQuery.data?.statusCounts?.[status] ?? 0}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-3">
        {query.isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="h-24 animate-pulse border-steel-700/50 bg-steel-800/70" />
          ))
        ) : query.data?.items.length ? (
          query.data.items.map((part) => (
            <Card
              key={part.id}
              className="clickable-surface cursor-pointer"
              onClick={() => router.push(`/parts/${part.id}`)}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[170px_1fr_280px]">
                <div className="h-[170px] w-[170px] overflow-hidden rounded-md border border-steel-700 bg-steel-850">
                  {part.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/uploads/${part.photos[0].storageKey}`}
                      alt={part.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-steel-300">
                      No image
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-2">
                  <p className="line-clamp-2 text-xl font-semibold text-white">{part.name}</p>
                  <p className="text-sm text-steel-300">{part.partNumber}</p>
                  <p className="line-clamp-2 text-sm text-steel-300">
                    {part.description || "No description yet."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-steel-200">
                    <span>{part.owners.map((owner) => owner.user.displayName).join(", ") || "Unassigned"}</span>
                    <span className="text-steel-300">|</span>
                    <span>Updated {new Date(part.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge>{statusLabel(part.status)}</Badge>
                    <span className="rounded-full border border-steel-700 bg-steel-850 px-3 py-1 text-steel-100">
                      Priority {part.priority} ({priorityLabel(part.priority)})
                    </span>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border border-steel-700 bg-steel-850 p-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-steel-300">Qty Complete</p>
                      <p className="font-semibold text-white">{part.quantityComplete}</p>
                    </div>
                    <div>
                      <p className="text-steel-300">Qty Required</p>
                      <p className="font-semibold text-white">{part.quantityRequired}</p>
                    </div>
                    <div>
                      <p className="text-steel-300">Remaining</p>
                      <p className="font-semibold text-white">
                        {Math.max(0, part.quantityRequired - part.quantityComplete)}
                      </p>
                    </div>
                    <div>
                      <p className="text-steel-300">Progress</p>
                      <p className="font-semibold text-white">
                        {part.quantityRequired
                          ? Math.round((Math.min(part.quantityComplete, part.quantityRequired) / part.quantityRequired) * 100)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/parts/${part.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-brand-400"
                  >
                    Open Part
                  </Link>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm text-steel-300">No parts matched your current filters.</p>
          </Card>
        )}
        </div>
      </div>
    </section>
  );
}
