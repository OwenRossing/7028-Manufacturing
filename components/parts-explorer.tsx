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

  return (
    <section className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-white">Parts Explorer</h1>
            <p className="text-sm text-steel-300">
              Browse like a product catalog: image, title, owners, and progress checkpoint.
            </p>
          </div>
          <Badge>{query.data?.total ?? 0} results</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.values(PartStatus).map((status) => (
            <button
              type="button"
              key={status}
              onClick={() => toggleStatus(status)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                statusFilters.includes(status)
                  ? "border-brand-500 bg-brand-500/15 text-brand-400"
                  : "border-steel-700 bg-steel-850 text-steel-300"
              }`}
            >
              {statusLabel(status)}
            </button>
          ))}
          <div className="ml-auto w-full max-w-[220px]">
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
        </div>
      </Card>

      <div className="space-y-3">
        {query.isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="h-24 animate-pulse border-steel-700/50 bg-steel-800/70" />
          ))
        ) : query.data?.items.length ? (
          query.data.items.map((part) => (
            <Link key={part.id} href={`/parts/${part.id}`}>
              <Card className="transition hover:border-brand-500/60">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[72px_1fr_200px] md:items-center">
                  <div className="h-[72px] w-[72px] overflow-hidden rounded-md border border-steel-700 bg-steel-850">
                    {part.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/uploads/${part.photos[0].storageKey}`}
                        alt={part.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white">{part.name}</p>
                    <p className="text-sm text-steel-300">{part.partNumber}</p>
                    <p className="line-clamp-1 text-sm text-steel-300">
                      {part.description || "No description yet."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Badge className="mr-2">{statusLabel(part.status)}</Badge>
                    <Badge>
                      Progress {part.quantityComplete}/{part.quantityRequired}
                    </Badge>
                    <p className="text-xs text-steel-300">
                      {part.owners.map((owner) => owner.user.displayName).join(", ") || "Unassigned"}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))
        ) : (
          <Card>
            <p className="text-sm text-steel-300">No parts matched your current filters.</p>
          </Card>
        )}
      </div>
    </section>
  );
}
