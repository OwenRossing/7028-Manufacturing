"use client";

import { PartStatus } from "@prisma/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ORDER, statusLabel } from "@/lib/status";

type BoardPart = {
  id: string;
  name: string;
  partNumber: string;
  status: PartStatus;
  priority: number;
  quantityRequired: number;
  quantityComplete: number;
  photoStorageKey?: string | null;
};

export function PartStageContext({
  currentPartId,
  currentStatus,
  parts
}: {
  currentPartId: string;
  currentStatus: PartStatus;
  parts: BoardPart[];
}) {
  const [liveParts, setLiveParts] = useState<BoardPart[]>(parts);
  useEffect(() => {
    setLiveParts(parts);
  }, [parts]);

  const moveMutation = useMutation({
    mutationFn: async ({ partId, toStatus }: { partId: string; toStatus: PartStatus }) => {
      const response = await fetch(`/api/parts/${partId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({ toStatus })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to move card.");
      }
      return data;
    },
    onMutate: ({ partId, toStatus }) => {
      const previousParts = liveParts;
      setLiveParts((prev) =>
        prev.map((item) => (item.id === partId ? { ...item, status: toStatus } : item))
      );
      return { previousParts };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousParts) {
        setLiveParts(context.previousParts);
      }
    }
  });

  const grouped = useMemo(() => {
    const byStatus: Record<PartStatus, BoardPart[]> = {
      DESIGNED: [],
      CUT: [],
      MACHINED: [],
      ASSEMBLED: [],
      VERIFIED: [],
      DONE: []
    };
    for (const part of liveParts) {
      byStatus[part.status].push(part);
    }
    for (const status of ORDER) {
      byStatus[status].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const aRemaining = Math.max(0, a.quantityRequired - a.quantityComplete);
        const bRemaining = Math.max(0, b.quantityRequired - b.quantityComplete);
        if (aRemaining !== bRemaining) return bRemaining - aRemaining;
        return a.name.localeCompare(b.name);
      });
    }
    return byStatus;
  }, [liveParts]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">Stage Context</h3>
        <p className="text-xs text-steel-300">Full board. Current part is highlighted; others are dimmed.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {ORDER.map((status) => {
          return (
            <div
              key={status}
              className="space-y-2 rounded-md border border-steel-700 bg-steel-850 p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const partId = event.dataTransfer.getData("text/plain");
                if (!partId) return;
                moveMutation.mutate({ partId, toStatus: status });
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white">{statusLabel(status)}</p>
                <Badge>{grouped[status].length}</Badge>
              </div>
              <div className="space-y-2">
                {grouped[status].length ? (
                  grouped[status].map((part) => (
                    <Link
                      key={part.id}
                      href={`/parts/${part.id}`}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", part.id)}
                      className={`clickable-surface block rounded-md bg-steel-850 p-2 ${part.id === currentPartId ? "border-accent-500 bg-accent-500/20 ring-1 ring-accent-500/40 opacity-100" : "opacity-45 grayscale-[0.35]"}`}
                    >
                      <div className="grid grid-cols-[64px_1fr] gap-2">
                        <div className="h-16 w-16 overflow-hidden rounded-md border border-steel-700 bg-steel-900">
                          {part.photoStorageKey ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/uploads/${part.photoStorageKey}`}
                              alt={part.name}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-semibold text-white">{part.name}</p>
                          <p className="line-clamp-1 text-xs text-steel-300">{part.partNumber}</p>
                          <p className="text-xs text-steel-300">
                            P{part.priority} | Qty {part.quantityComplete}/{part.quantityRequired}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-steel-300">No parts in this stage.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
