"use client";

import { PartStatus } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ChevronDown, X, Settings, ArrowUp } from "lucide-react";
import {
  canonicalStatusForStage,
  stageLabel,
  STAGE_ORDER,
  statusToStage,
  type WorkflowStage
} from "@/lib/status";
import { PartListItem } from "@/types/parts";

type PartsResponse = {
  items: PartListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type DiscussionMessage = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

type PriorityTier = "ASAP" | "NORMAL" | "BACKBURNER";
type MainView = "HOME" | "STAGE" | "DETAIL";
type SubsystemKey = string;

function stageCollectionLabel(stage: WorkflowStage): string {
  return stageLabel(stage).toUpperCase();
}

function stageCollectionSort(stage: WorkflowStage): number {
  if (stage === "NOT_STARTED") return 0;
  if (stage === "MACHINED") return 1;
  return 2;
}

function priorityTier(priority: number): PriorityTier {
  if (priority <= 1) return "ASAP";
  if (priority <= 3) return "NORMAL";
  return "BACKBURNER";
}

function priorityClass(priority: number): string {
  const tier = priorityTier(priority);
  if (tier === "ASAP") return "border-red-400/70 bg-red-500/15";
  if (tier === "NORMAL") return "border-emerald-400/70 bg-emerald-500/15";
  return "border-slate-400/70 bg-slate-500/15";
}

function priorityNameClass(priority: number): string {
  const tier = priorityTier(priority);
  if (tier === "ASAP") return "text-red-300";
  if (tier === "NORMAL") return "text-emerald-300";
  return "text-slate-300";
}

function matchesSearch(part: PartListItem, search: string): boolean {
  if (!search) return true;
  const haystack = [
    part.name,
    part.partNumber,
    stageLabel(statusToStage(part.status)),
    ...part.owners.map((owner) => owner.user.displayName)
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

function compareByPriority(a: PartListItem, b: PartListItem): number {
  const rank: Record<PriorityTier, number> = { ASAP: 0, NORMAL: 1, BACKBURNER: 2 };
  const diff = rank[priorityTier(a.priority)] - rank[priorityTier(b.priority)];
  if (diff !== 0) return diff;
  const aRemaining = Math.max(0, a.quantityRequired - a.quantityComplete);
  const bRemaining = Math.max(0, b.quantityRequired - b.quantityComplete);
  if (aRemaining !== bRemaining) return bRemaining - aRemaining;
  return a.name.localeCompare(b.name);
}

function subsystemFromPartNumber(partNumber: string): SubsystemKey {
  const groups = partNumber.match(/\d{4,}/g);
  const candidate = groups?.at(-1);
  if (!candidate) return "none";
  const value = Number.parseInt(candidate, 10);
  if (Number.isNaN(value) || value < 1000) return "none";
  return `subsystem-${Math.floor(value / 1000)}`;
}

function subsystemLabel(key: SubsystemKey): string {
  if (key === "none") return "No subsystem";
  const value = Number.parseInt(key.replace("subsystem-", ""), 10);
  if (Number.isNaN(value)) return "No subsystem";
  return `Subsystem ${value}`;
}

function ownerSummary(part: PartListItem): string {
  const names = part.owners.map((owner) => owner.user.displayName);
  if (!names.length) return "Unassigned";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function PartsExplorer({ currentUserId }: { currentUserId: string | null }) {
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const search = (searchParams.get("q") ?? "").trim().toLowerCase();

  const [view, setView] = useState<MainView>("HOME");
  const [activeStage, setActiveStage] = useState<WorkflowStage>("NOT_STARTED");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [stageOpen, setStageOpen] = useState<Record<WorkflowStage, boolean>>({
    COMPLETED: true,
    MACHINED: true,
    NOT_STARTED: true
  });
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [leftSearch, setLeftSearch] = useState("");
  const [leftSearchFocused, setLeftSearchFocused] = useState(false);
  const [priorityFilters, setPriorityFilters] = useState<Record<PriorityTier, boolean>>({
    ASAP: true,
    NORMAL: true,
    BACKBURNER: true
  });
  const [subsystemFilters, setSubsystemFilters] = useState<Record<string, boolean>>({});
  const [onlyMine, setOnlyMine] = useState(false);
  const [showCompactDetailHeader, setShowCompactDetailHeader] = useState(false);
  const [detailPanel, setDetailPanel] = useState<"main" | "settings">("main");
  const [editName, setEditName] = useState("");
  const [editPartNumber, setEditPartNumber] = useState("");
  const [editPriority, setEditPriority] = useState(3);
  const [editQtyRequired, setEditQtyRequired] = useState("1");
  const [editQtyComplete, setEditQtyComplete] = useState("0");
  const [discussionInput, setDiscussionInput] = useState("");
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>([]);
  const [feedback, setFeedback] = useState<{ kind: "error" | "warning"; text: string } | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    params.set("pageSize", "500");
    return params.toString();
  }, [projectId]);

  const query = useQuery({
    queryKey: ["parts", queryString],
    queryFn: async () => {
      const response = await fetch(`/api/parts?${queryString}`);
      if (!response.ok) throw new Error("Unable to load parts.");
      return (await response.json()) as PartsResponse;
    }
  });

  const [liveItems, setLiveItems] = useState<PartListItem[]>([]);
  useEffect(() => {
    setLiveItems(query.data?.items ?? []);
  }, [query.data?.items]);

  const subsystemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const part of liveItems) {
      const key = subsystemFromPartNumber(part.partNumber);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [liveItems]);

  useEffect(() => {
    setSubsystemFilters((prev) => {
      const next: Record<string, boolean> = {};
      for (const [key] of subsystemCounts) {
        next[key] = prev[key] ?? true;
      }
      return next;
    });
  }, [subsystemCounts]);

  useEffect(() => {
    if (view !== "DETAIL") {
      setShowCompactDetailHeader(false);
      return;
    }
    const node = detailScrollRef.current;
    if (!node) return;
    const onScroll = () => setShowCompactDetailHeader(node.scrollTop > 220);
    onScroll();
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [view, selectedPartId, detailPanel]);

  useEffect(() => {
    if (!query.isError) return;
    setFeedback({ kind: "error", text: "Failed to load parts. Refresh and try again." });
  }, [query.isError]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2300);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const effectiveSearch = `${search} ${leftSearch}`.trim();
  const visibleItems = useMemo(() => {
    return liveItems.filter((part) => {
      if (!matchesSearch(part, effectiveSearch)) return false;
      const tier = priorityTier(part.priority);
      if (!priorityFilters[tier]) return false;
      const subsystem = subsystemFromPartNumber(part.partNumber);
      if (subsystemFilters[subsystem] === false) return false;
      if (onlyMine && currentUserId && !part.owners.some((owner) => owner.userId === currentUserId)) return false;
      if (onlyMine && !currentUserId) return false;
      return true;
    });
  }, [liveItems, effectiveSearch, priorityFilters, subsystemFilters, onlyMine, currentUserId]);

  const sorted = useMemo(() => [...visibleItems].sort(compareByPriority), [visibleItems]);
  const selectedPart = useMemo(
    () => sorted.find((part) => part.id === selectedPartId) ?? null,
    [sorted, selectedPartId]
  );
  const selectedPrimaryOwnerName = useMemo(
    () => selectedPart?.owners.find((owner) => owner.role === "PRIMARY")?.user.displayName ?? "Unassigned",
    [selectedPart]
  );
  const selectedCollaborators = useMemo(
    () => selectedPart?.owners.filter((owner) => owner.role === "COLLABORATOR").map((owner) => owner.user.displayName) ?? [],
    [selectedPart]
  );
  const selectedCollaboratorLabel = selectedCollaborators.length
    ? selectedCollaborators.length <= 2
      ? selectedCollaborators.join(", ")
      : `${selectedCollaborators.slice(0, 2).join(", ")} +${selectedCollaborators.length - 2}`
    : "None";

  useEffect(() => {
    if (!selectedPartId && sorted.length) {
      setSelectedPartId(sorted[0].id);
    }
    if (selectedPartId && !sorted.some((part) => part.id === selectedPartId)) {
      setSelectedPartId(sorted[0]?.id ?? null);
    }
  }, [selectedPartId, sorted]);

  useEffect(() => {
    if (view !== "DETAIL") return;
    setDetailPanel("main");
  }, [selectedPartId, view]);

  useEffect(() => {
    if (!selectedPart) return;
    setEditName(selectedPart.name);
    setEditPartNumber(selectedPart.partNumber);
    setEditPriority(selectedPart.priority);
    setEditQtyRequired(String(selectedPart.quantityRequired));
    setEditQtyComplete(String(selectedPart.quantityComplete));
  }, [selectedPart]);

  useEffect(() => {
    if (!selectedPartId) {
      setDiscussionMessages([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(`part-discussion-${selectedPartId}`);
      if (!raw) {
        setDiscussionMessages([]);
        return;
      }
      const parsed = JSON.parse(raw) as DiscussionMessage[];
      setDiscussionMessages(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDiscussionMessages([]);
    }
  }, [selectedPartId]);

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
      if (!response.ok) throw new Error(data?.error ?? "Unable to move card.");
      return data;
    },
    onMutate: ({ partId, toStatus }) => {
      setFeedback(null);
      const previousItems = liveItems;
      setLiveItems((prev) => prev.map((item) => (item.id === partId ? { ...item, status: toStatus } : item)));
      return { previousItems };
    },
    onError: (error, _variables, context) => {
      if (context?.previousItems) setLiveItems(context.previousItems);
      setFeedback({ kind: "error", text: error.message || "Unable to move part. Try again." });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["parts", queryString] });
    }
  });

  const settingsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPart) throw new Error("No part selected.");
      const payload = {
        name: editName.trim(),
        partNumber: editPartNumber.trim(),
        priority: editPriority,
        quantityRequired: Number.parseInt(editQtyRequired, 10) || 1,
        quantityComplete: Number.parseInt(editQtyComplete, 10) || 0
      };
      const response = await fetch(`/api/parts/${selectedPart.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json().catch(() => null)) as { error?: string } & PartListItem;
      if (!response.ok) throw new Error(data?.error ?? "Unable to save settings.");
      return data;
    },
    onMutate: () => setFeedback(null),
    onSuccess: (updated) => {
      setLiveItems((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                name: updated.name,
                partNumber: updated.partNumber,
                priority: updated.priority,
                quantityRequired: updated.quantityRequired,
                quantityComplete: updated.quantityComplete,
                updatedAt: updated.updatedAt
              }
            : item
        )
      );
      setFeedback({ kind: "warning", text: "Settings saved." });
      void queryClient.invalidateQueries({ queryKey: ["parts", queryString] });
    },
    onError: (error: Error) => {
      setFeedback({ kind: "error", text: error.message || "Unable to save settings." });
    }
  });

  const quickQtyMutation = useMutation({
    mutationFn: async (nextComplete: number) => {
      if (!selectedPart) throw new Error("No part selected.");
      const response = await fetch(`/api/parts/${selectedPart.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantityComplete: nextComplete })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } & PartListItem;
      if (!response.ok) throw new Error(data?.error ?? "Unable to update quantity.");
      return data;
    },
    onMutate: () => setFeedback(null),
    onSuccess: (updated) => {
      setLiveItems((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                quantityComplete: updated.quantityComplete,
                updatedAt: updated.updatedAt
              }
            : item
        )
      );
      setFeedback({ kind: "warning", text: "Quantity updated." });
      void queryClient.invalidateQueries({ queryKey: ["parts", queryString] });
    },
    onError: (error: Error) => setFeedback({ kind: "error", text: error.message || "Unable to update quantity." })
  });

  function postDiscussionMessage() {
    if (!selectedPartId) return;
    const text = discussionInput.trim();
    if (!text) return;
    const message: DiscussionMessage = {
      id: crypto.randomUUID(),
      author: "You",
      text,
      createdAt: new Date().toISOString()
    };
    const next = [...discussionMessages, message];
    setDiscussionMessages(next);
    setDiscussionInput("");
    try {
      window.localStorage.setItem(`part-discussion-${selectedPartId}`, JSON.stringify(next));
    } catch {
      setFeedback({ kind: "warning", text: "Message sent for this session only." });
    }
  }

  const byStage = useMemo(() => {
    const grouped: Record<WorkflowStage, PartListItem[]> = {
      NOT_STARTED: [],
      MACHINED: [],
      COMPLETED: []
    };
    for (const part of sorted) {
      grouped[statusToStage(part.status)].push(part);
    }
    return grouped;
  }, [sorted]);

  const whatsNew = sorted.slice(0, 3);
  const myParts = (currentUserId
    ? sorted.filter((part) => part.owners.some((owner) => owner.userId === currentUserId))
    : sorted
  ).slice(0, 10);

  const stageItems = useMemo(
    () => sorted.filter((part) => statusToStage(part.status) === activeStage),
    [sorted, activeStage]
  );

  return (
    <section className="grid h-[calc(100dvh-104px)] grid-cols-1 overflow-hidden lg:grid-cols-[392px_1fr]">
      <aside className="flex h-full flex-col border-r border-[#0e141b] bg-[#24282f]">
        <div className="bg-[#171d25] px-2 pb-3 pt-2">
          <button
            type="button"
            onClick={() => setView("HOME")}
            className="mb-2 h-11 w-full rounded-[3px] bg-[#25272d] px-3 text-left text-[15px] font-normal text-[#c7d5e0] hover:bg-[#3e4047]"
          >
            Home
          </button>

          <div className="relative mb-2">
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setTypeMenuOpen((prev) => !prev)}
                className="inline-flex h-11 items-center justify-between rounded-[3px] bg-[#25272d] px-3 text-left text-[15px] font-normal text-[#c7d5e0]"
              >
                <span>Parts and Filters</span>
                <ChevronDown className="h-4 w-4 text-[#8f98a0]" />
              </button>
            </div>
            {typeMenuOpen ? (
              <div className="absolute left-0 top-full z-10 mt-1 w-full border border-[#5a6473] bg-[#3d4a5d] p-2 text-sm text-[#c7d5e0]">
                <label className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={onlyMine}
                    onChange={() => setOnlyMine((prev) => !prev)}
                  />
                  <span>Show only my parts</span>
                  {currentUserId ? (
                    <span className="text-[#8f98a0]">
                      ({liveItems.filter((item) => item.owners.some((owner) => owner.userId === currentUserId)).length})
                    </span>
                  ) : null}
                </label>
                <hr className="my-2 border-[#778090]" />
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#a8b6c7]">Priority</p>
                <label className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={priorityFilters.ASAP}
                    onChange={() => setPriorityFilters((prev) => ({ ...prev, ASAP: !prev.ASAP }))}
                  />
                  <span>ASAP</span>
                  <span className="text-[#8f98a0]">
                    ({liveItems.filter((item) => priorityTier(item.priority) === "ASAP").length})
                  </span>
                </label>
                <label className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={priorityFilters.NORMAL}
                    onChange={() => setPriorityFilters((prev) => ({ ...prev, NORMAL: !prev.NORMAL }))}
                  />
                  <span>Normal</span>
                  <span className="text-[#8f98a0]">
                    ({liveItems.filter((item) => priorityTier(item.priority) === "NORMAL").length})
                  </span>
                </label>
                <label className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={priorityFilters.BACKBURNER}
                    onChange={() => setPriorityFilters((prev) => ({ ...prev, BACKBURNER: !prev.BACKBURNER }))}
                  />
                  <span>Backburner</span>
                  <span className="text-[#8f98a0]">
                    ({liveItems.filter((item) => priorityTier(item.priority) === "BACKBURNER").length})
                  </span>
                </label>
                <hr className="my-2 border-[#778090]" />
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#a8b6c7]">Subsystem</p>
                {subsystemCounts.map(([key, count]) => (
                  <label key={key} className="mb-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={subsystemFilters[key] ?? true}
                      onChange={() =>
                        setSubsystemFilters((prev) => ({
                          ...prev,
                          [key]: !(prev[key] ?? true)
                        }))
                      }
                    />
                    <span>{subsystemLabel(key)}</span>
                    <span className="text-[#8f98a0]">({count})</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mb-2 flex h-11 items-center rounded-[3px] bg-[#25272d] px-3">
            <div className={`flex h-9 w-full items-center gap-2 rounded-[3px] px-2 ${
              leftSearchFocused
                ? "bg-[#1d2026] shadow-[inset_0_1px_2px_rgba(0,0,0,0.65),inset_0_-1px_0_rgba(255,255,255,0.04)]"
                : "bg-[#23262d]"
            }`}>
              <Search className="h-5 w-5 text-[#98a8b9]" />
              <input
                value={leftSearch}
                onChange={(event) => setLeftSearch(event.target.value)}
                onFocus={() => setLeftSearchFocused(true)}
                onBlur={() => setLeftSearchFocused(false)}
                placeholder="Search by Name"
                className="w-full bg-transparent text-[15px] italic text-[#c7d5e0] outline-none placeholder:text-[#8d9cad]"
              />
              {leftSearch ? (
                <button
                  type="button"
                  onClick={() => setLeftSearch("")}
                  className="text-[#8f98a0] hover:text-[#c7d5e0]"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="px-1 pb-1 text-[11px] text-[#8f98a0]">
            Priority colors: <span className="text-red-300">ASAP</span>, <span className="text-emerald-300">Normal</span>, <span className="text-slate-300">Backburner</span>
          </div>
          {onlyMine && !currentUserId ? (
            <p className="mx-1 rounded-[3px] border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-200">
              Sign in to use "Show only my parts."
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto pb-3">
          {[...STAGE_ORDER].sort((a, b) => stageCollectionSort(a) - stageCollectionSort(b)).map((stage) => {
            const items = byStage[stage];
            const stageActive = view === "STAGE" && activeStage === stage;
            const open = stageOpen[stage];
            return (
              <div
                key={stage}
                className="border-t border-[#223548]"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  const partId = event.dataTransfer.getData("text/plain");
                  if (!partId) return;
                  moveMutation.mutate({ partId, toStatus: canonicalStatusForStage(stage) });
                }}
              >
                <div className={`flex items-center bg-gradient-to-r from-[#243850]/30 via-[#1f3046]/42 to-[#24282f] ${stageActive ? "text-[#cae4fb]" : "text-[#cae4fb]"}`}>
                  <button
                    type="button"
                    onClick={() => setStageOpen((prev) => ({ ...prev, [stage]: !prev[stage] }))}
                    className="inline-flex h-6 w-6 items-center justify-center text-[15px] text-[#7a8a9b] hover:text-[#cae4fb]"
                  >
                    {open ? "-" : "+"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveStage(stage);
                      setView("STAGE");
                    }}
                    className="flex flex-1 items-center justify-between pr-3 text-left text-[11px] font-semibold tracking-wide hover:text-[#cae4fb]"
                  >
                    <span>{stageCollectionLabel(stage)}</span>
                    <span className="text-[11px] text-[#7a8a9b]">({items.length})</span>
                  </button>
                </div>
                <div className={open ? "block" : "hidden"}>
                  {items.map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", part.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => {
                        setSelectedPartId(part.id);
                        setView("DETAIL");
                        setDetailPanel("main");
                      }}
                      className={`mr-2 flex w-[calc(100%-8px)] items-center gap-2 px-5 py-[3px] text-left ${
                        selectedPartId === part.id && view === "DETAIL"
                          ? "bg-[#3e4e69] text-[#cae4fb]"
                          : "text-[#c7d5e0] hover:bg-[#2a3d55]"
                      }`}
                    >
                      <span className="h-4 w-4 overflow-hidden bg-[#2a475e]">
                        {part.photos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/uploads/${part.photos[0].storageKey}`} alt={part.name} className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <div className="min-w-0">
                        <span className={`line-clamp-1 block text-[15px] leading-tight ${priorityNameClass(part.priority)}`}>{part.name}</span>
                        <span className="line-clamp-1 block text-[11px] text-[#7f8ea0]">{part.partNumber}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="h-full overflow-hidden bg-steel-850">
        {feedback ? (
          <div className="pointer-events-none fixed right-4 top-[62px] z-[60]">
            <div
              className={`rounded-[3px] border px-3 py-2 text-sm shadow-lg ${
                feedback.kind === "error"
                  ? "border-red-500/40 bg-red-500/90 text-red-50"
                  : "border-yellow-500/40 bg-yellow-500/90 text-[#1d2026]"
              }`}
            >
              {feedback.text}
            </div>
          </div>
        ) : null}
        {!query.isError && sorted.length === 0 ? (
          <div className="mx-4 mt-4 rounded-[3px] border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
            No parts match the current filters/search.
          </div>
        ) : null}
        {view === "HOME" ? (
          <div className="h-full space-y-5 overflow-y-auto p-4">
            <section>
              <h2 className="mb-2 text-3xl font-semibold text-steel-100">Most Important</h2>
              <div className="grid gap-3 xl:grid-cols-3">
                {whatsNew.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => {
                      setSelectedPartId(part.id);
                      setView("DETAIL");
                      setDetailPanel("main");
                    }}
                    className={`overflow-hidden border text-left ${priorityClass(part.priority)}`}
                  >
                    <div className="relative h-40">
                      {part.photos[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/uploads/${part.photos[0].storageKey}`} alt={part.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-steel-800" />
                      )}
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-1 text-xl font-semibold text-white">{part.name}</p>
                      <p className="line-clamp-1 text-sm text-steel-300">{part.partNumber}</p>
                      <p className="line-clamp-1 text-sm text-steel-300">Owners: {ownerSummary(part)}</p>
                      <p className="text-sm text-steel-300">
                        Stage: {stageLabel(statusToStage(part.status))} | Qty {part.quantityComplete}/{part.quantityRequired}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              {!whatsNew.length ? <p className="text-sm text-steel-300">No parts to show in Most Important yet.</p> : null}
            </section>

            <section>
              <h3 className="mb-2 text-3xl font-semibold text-steel-100">My Parts</h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {myParts.map((part, index) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => {
                      setSelectedPartId(part.id);
                      setView("DETAIL");
                      setDetailPanel("main");
                    }}
                    className={`relative overflow-hidden border text-left ${priorityClass(part.priority)} ${
                      index === 0 ? "h-[202px] min-w-[414px]" : "h-[202px] min-w-[180px]"
                    }`}
                  >
                    {part.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/uploads/${part.photos[0].storageKey}`} alt={part.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-steel-800" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.82))] p-3">
                      <p className="line-clamp-1 text-base font-semibold text-white">{part.name}</p>
                      <p className="line-clamp-1 text-xs text-steel-300">{part.partNumber}</p>
                      <p className="line-clamp-1 text-xs text-steel-300">{ownerSummary(part)}</p>
                      <p className="text-xs text-steel-200">Qty {part.quantityComplete}/{part.quantityRequired}</p>
                    </div>
                  </button>
                ))}
              </div>
              {!myParts.length ? <p className="text-sm text-steel-300">No parts assigned yet.</p> : null}
            </section>
          </div>
        ) : view === "STAGE" ? (
          <div className="h-full overflow-y-auto p-4">
            <h2 className="mb-3 text-3xl font-semibold text-steel-100">{stageLabel(activeStage).toUpperCase()}</h2>
            <div
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                const partId = event.dataTransfer.getData("text/plain");
                if (!partId) return;
                moveMutation.mutate({ partId, toStatus: canonicalStatusForStage(activeStage) });
              }}
            >
              {stageItems.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", part.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => {
                    setSelectedPartId(part.id);
                    setView("DETAIL");
                  }}
                  className={`relative overflow-hidden border text-left ${priorityClass(part.priority)}`}
                >
                  <div className="aspect-[3/4] bg-steel-800">
                    {part.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/uploads/${part.photos[0].storageKey}`} alt={part.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="relative min-h-[102px] space-y-1 bg-[linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.55))] p-3">
                    <p className="line-clamp-1 text-base font-semibold text-white">{part.name}</p>
                    <p className="line-clamp-1 text-xs text-steel-300">{part.partNumber}</p>
                    <p className="line-clamp-1 text-xs text-steel-300">{ownerSummary(part)}</p>
                    <p className="text-xs text-steel-300">Stage: {stageLabel(statusToStage(part.status))}</p>
                    <span className="absolute right-3 top-3 rounded-full border border-white/25 bg-black/50 px-2 py-0.5 text-xs text-white">
                      {part.quantityComplete}/{part.quantityRequired}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {!stageItems.length ? <p className="mt-3 text-sm text-steel-300">No parts in this stage right now.</p> : null}
          </div>
        ) : selectedPart ? (
          <div ref={detailScrollRef} className="relative h-full overflow-y-auto bg-[#242830]">
            {showCompactDetailHeader ? (
              <div className="sticky top-0 z-30 border-y border-[#31465f] bg-[linear-gradient(90deg,rgba(27,40,56,0.94),rgba(38,49,64,0.94),rgba(27,40,56,0.94))] px-5 py-2 backdrop-blur-sm">
              <div className="grid grid-cols-[max-content_minmax(0,1fr)_max-content] items-center gap-3 overflow-hidden">
                <div className="relative inline-flex h-11 min-w-[156px] items-center rounded-[2px] border border-[#2f6eb6] bg-[#1a9fff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <span className="pointer-events-none absolute left-3 text-lg font-semibold tracking-wide">
                    {stageLabel(statusToStage(selectedPart.status))}
                  </span>
                  <select
                    value={statusToStage(selectedPart.status)}
                    onChange={(event) =>
                      moveMutation.mutate({
                        partId: selectedPart.id,
                        toStatus: canonicalStatusForStage(event.target.value as WorkflowStage)
                      })
                    }
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 outline-none"
                  >
                    {STAGE_ORDER.map((stage) => (
                      <option key={stage} value={stage} className="bg-[#1d2633] text-[#d6e4f2]">
                        {stageLabel(stage)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-white" />
                </div>
                <div className="flex min-w-0 items-center gap-2 text-[#c7d5e0]">
                  <div className="h-7 w-7 overflow-hidden rounded-[2px] bg-[#2a475e]">
                    {selectedPart.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/uploads/${selectedPart.photos[0].storageKey}`} alt={selectedPart.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-2xl">{selectedPart.name}</p>
                    <p className="truncate text-xs text-[#9fb0c2]">{selectedPart.partNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailPanel("settings")}
                    className={`inline-flex h-9 w-[124px] items-center justify-center gap-2 rounded-[4px] border px-2 ${
                      detailPanel === "settings"
                        ? "border-[#1a9fff] bg-[#1a9fff]/25 text-[#c7e7ff]"
                        : "border-[#435266] bg-[#3a4659] text-[#c7d5e0] hover:bg-[#4a5970]"
                    }`}
                  >
                    <Settings className="h-5 w-5" />
                    <span className="text-xs font-semibold">Settings</span>
                  </button>
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#435266] bg-[#3a4659] text-[#c7d5e0] hover:bg-[#4a5970]"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                </div>
              </div>
              </div>
            ) : null}

            <div className="relative h-[360px] overflow-hidden border-b border-[#31465f]">
              {selectedPart.photos[0] ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/uploads/${selectedPart.photos[0].storageKey}`}
                    alt={selectedPart.name}
                    className="absolute inset-0 h-full w-full scale-105 object-cover blur-2xl opacity-35"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/uploads/${selectedPart.photos[0].storageKey}`}
                    alt={selectedPart.name}
                    className="absolute inset-0 h-full w-full object-cover opacity-95"
                  />
                </>
              ) : (
                <div className="h-full w-full bg-[#1f2630]" />
              )}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(109,163,217,0.18),transparent_45%),linear-gradient(180deg,rgba(36,40,48,0.15)_15%,rgba(36,40,48,0.72)_68%,rgba(36,40,48,0.94)_100%)]" />
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-24">
                <h2 className="text-6xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">{selectedPart.name}</h2>
                <p className="mt-1 text-base text-[#c7d5e0] drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">{selectedPart.partNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-[max-content_minmax(0,1fr)_max-content] border-b border-[#31465f] bg-[linear-gradient(90deg,rgba(24,34,48,0.96),rgba(43,54,71,0.92),rgba(24,34,48,0.96))] backdrop-blur-sm">
              <div className="m-3">
                <div className="relative inline-flex h-12 min-w-[156px] items-center rounded-[2px] border border-[#2f6eb6] bg-[#1a9fff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <span className="pointer-events-none absolute left-3 text-xl font-semibold tracking-wide">
                    {stageLabel(statusToStage(selectedPart.status))}
                  </span>
                  <select
                    value={statusToStage(selectedPart.status)}
                    onChange={(event) =>
                      moveMutation.mutate({
                        partId: selectedPart.id,
                        toStatus: canonicalStatusForStage(event.target.value as WorkflowStage)
                      })
                    }
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 outline-none"
                  >
                    {STAGE_ORDER.map((stage) => (
                      <option key={stage} value={stage} className="bg-[#1d2633] text-[#d6e4f2]">
                        {stageLabel(stage)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 px-2 py-2 text-center lg:grid-cols-4">
                <div className="rounded-[3px] bg-[rgba(19,27,39,0.45)] py-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#9aa8b8]">Owner</p>
                  <p className="whitespace-normal break-words px-2 text-base leading-tight text-[#d6e4f2]">{selectedPrimaryOwnerName}</p>
                </div>
                <div className="rounded-[3px] bg-[rgba(19,27,39,0.45)] py-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#9aa8b8]">Collaborators</p>
                  <p className="whitespace-normal break-words px-2 text-base leading-tight text-[#d6e4f2]">{selectedCollaboratorLabel}</p>
                </div>
                <div className="rounded-[3px] bg-[rgba(19,27,39,0.45)] py-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#9aa8b8]">Copies</p>
                  <p className="text-base text-[#d6e4f2]">{selectedPart.quantityComplete}/{selectedPart.quantityRequired}</p>
                </div>
                <div className="rounded-[3px] bg-[rgba(19,27,39,0.45)] py-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#9aa8b8]">Due Date</p>
                  <p className="text-base text-[#d6e4f2]">Not set</p>
                </div>
              </div>
              <div className="mr-4 flex items-center gap-2">
                <button
                  onClick={() => setDetailPanel("settings")}
                  className={`inline-flex h-9 w-[124px] items-center justify-center gap-2 rounded-[4px] border px-2 ${
                    detailPanel === "settings"
                      ? "border-[#1a9fff] bg-[#1a9fff]/25 text-[#c7e7ff]"
                      : "border-[#435266] bg-[#3a4659] text-[#c7d5e0] hover:bg-[#4a5970]"
                  }`}
                >
                  <Settings className="h-5 w-5" />
                  <span className="text-xs font-semibold">Settings</span>
                </button>
              </div>
            </div>

            {detailPanel === "main" ? (
              <div className="space-y-5 bg-[radial-gradient(circle_at_20%_20%,rgba(97,132,170,0.15),transparent_50%)] p-4">
                <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
                  <div className="space-y-4">
                    <div className="border-t border-[#31465f] pt-4">
                      <p className="text-lg text-[#99a9ba]">Status</p>
                      <div className="mt-3 border border-[#31465f] bg-[linear-gradient(120deg,rgba(39,51,67,0.65),rgba(28,38,52,0.85))] p-4">
                        <p className="text-xl text-[#e5eef7]">Current: {stageLabel(statusToStage(selectedPart.status))}</p>
                        <p className="text-base text-[#9fb0c2]">{selectedPart.partNumber}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {STAGE_ORDER.map((stage) => (
                            <button
                              key={stage}
                              type="button"
                              onClick={() =>
                                moveMutation.mutate({
                                  partId: selectedPart.id,
                                  toStatus: canonicalStatusForStage(stage)
                                })
                              }
                              className={`border px-2 py-1 text-sm ${
                                stage === statusToStage(selectedPart.status)
                                  ? "border-[#1a9fff] bg-[#1a9fff]/20 text-[#7cc5ff]"
                                  : "border-[#31465f] bg-[#1d2633] text-[#9aa8b8] hover:bg-[#243244]"
                              }`}
                            >
                              {stageLabel(stage)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
                      <h4 className="text-2xl font-semibold text-[#d6e4f2]">Collaborators</h4>
                      <p className="mt-3 text-lg text-[#9fb0c2]">
                        {selectedPart.owners.length} collaborators assigned
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedPart.owners.slice(0, 6).map((owner) => (
                          <span key={owner.userId} className="border border-[#31465f] bg-[#2d3a4d] px-2 py-1 text-sm text-[#d6e4f2]">
                            {owner.user.displayName}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
                      <h4 className="text-2xl font-semibold text-[#d6e4f2]">Quantity Tracking</h4>
                      <p className="mt-2 text-lg text-[#9fb0c2]">
                        Completed {selectedPart.quantityComplete}/{selectedPart.quantityRequired}
                      </p>
                      <p className="text-sm text-[#9fb0c2]">
                        Remaining: {Math.max(0, selectedPart.quantityRequired - selectedPart.quantityComplete)}
                      </p>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#1c2635]">
                        <div
                          className="h-full bg-[#1a9fff]"
                          style={{
                            width: `${Math.min(
                              100,
                              selectedPart.quantityRequired
                                ? Math.round((selectedPart.quantityComplete / selectedPart.quantityRequired) * 100)
                                : 0
                            )}%`
                          }}
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            quickQtyMutation.mutate(Math.max(0, selectedPart.quantityComplete - 1))
                          }
                          className="rounded-[3px] border border-[#31465f] bg-[#1d2633] px-2 py-1 text-[#c7d5e0] hover:bg-[#243244]"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            quickQtyMutation.mutate(
                              Math.min(selectedPart.quantityRequired, selectedPart.quantityComplete + 1)
                            )
                          }
                          className="rounded-[3px] border border-[#31465f] bg-[#1d2633] px-2 py-1 text-[#c7d5e0] hover:bg-[#243244]"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                    <div className="border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
                      <h4 className="text-2xl font-semibold text-[#d6e4f2]">Progress</h4>
                      <p className="mt-2 text-lg text-[#9fb0c2]">
                        {selectedPart.quantityRequired
                          ? Math.round((selectedPart.quantityComplete / selectedPart.quantityRequired) * 100)
                          : 0}
                        % complete
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-[#31465f] bg-[linear-gradient(120deg,rgba(39,51,67,0.65),rgba(28,38,52,0.85))] p-4">
                  <h3 className="text-2xl font-semibold text-[#d6e4f2]">Discussion</h3>
                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-[3px] border border-[#31465f] bg-[#1a2230] p-3">
                    {discussionMessages.length ? (
                      discussionMessages.map((message) => (
                        <div key={message.id} className="rounded-[3px] border border-[#2e3f55] bg-[#223044] px-3 py-2">
                          <p className="text-xs text-[#9fb0c2]">
                            {message.author} • {new Date(message.createdAt).toLocaleString()}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#d6e4f2]">{message.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#9fb0c2]">No messages yet. Start the discussion below.</p>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <textarea
                      value={discussionInput}
                      onChange={(event) => setDiscussionInput(event.target.value)}
                      placeholder="Type a message for collaborators..."
                      className="min-h-[72px] flex-1 resize-y rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 py-2 text-sm text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                    />
                    <button
                      type="button"
                      onClick={postDiscussionMessage}
                      className="h-fit rounded-[3px] border border-[#1a9fff] bg-[#1a9fff]/15 px-3 py-2 text-sm text-[#7cc5ff] hover:bg-[#1a9fff]/25"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 bg-[radial-gradient(circle_at_20%_20%,rgba(97,132,170,0.15),transparent_50%)] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-semibold text-[#d6e4f2]">Part Settings</h3>
                  <button
                    type="button"
                    onClick={() => setDetailPanel("main")}
                    className="rounded-[3px] border border-[#435266] bg-[#3a4659] px-3 py-1 text-sm text-[#c7d5e0] hover:bg-[#4a5970]"
                  >
                    Back to Detail
                  </button>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
                    <p className="text-sm uppercase tracking-wide text-[#9aa8b8]">Identity</p>
                    <label className="mt-2 block text-xs text-[#9aa8b8]">Name</label>
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="mt-1 h-10 w-full rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                    />
                    <label className="mt-3 block text-xs text-[#9aa8b8]">Part ID</label>
                    <input
                      value={editPartNumber}
                      onChange={(event) => setEditPartNumber(event.target.value)}
                      className="mt-1 h-10 w-full rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                    />
                    <label className="mt-3 block text-xs text-[#9aa8b8]">Priority</label>
                    <select
                      value={priorityTier(editPriority)}
                      onChange={(event) =>
                        setEditPriority(event.target.value === "ASAP" ? 1 : event.target.value === "NORMAL" ? 3 : 5)
                      }
                      className="mt-1 h-10 w-full rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                    >
                      <option value="ASAP">ASAP</option>
                      <option value="NORMAL">Normal</option>
                      <option value="BACKBURNER">Backburner</option>
                    </select>
                  </div>
                  <div className="border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
                    <p className="text-sm uppercase tracking-wide text-[#9aa8b8]">Ownership</p>
                    <p className="mt-2 text-lg text-[#d6e4f2]">Owner: {selectedPrimaryOwnerName}</p>
                    <p className="text-base text-[#9fb0c2]">Collaborators: {selectedCollaboratorLabel}</p>
                  </div>
                  <div className="border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
                    <p className="text-sm uppercase tracking-wide text-[#9aa8b8]">Quantity</p>
                    <label className="mt-2 block text-xs text-[#9aa8b8]">Required</label>
                    <input
                      value={editQtyRequired}
                      onChange={(event) => setEditQtyRequired(event.target.value.replace(/\D/g, ""))}
                      className="mt-1 h-10 w-full rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                      inputMode="numeric"
                    />
                    <label className="mt-3 block text-xs text-[#9aa8b8]">Completed</label>
                    <input
                      value={editQtyComplete}
                      onChange={(event) => setEditQtyComplete(event.target.value.replace(/\D/g, ""))}
                      className="mt-1 h-10 w-full rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
                    <p className="text-sm uppercase tracking-wide text-[#9aa8b8]">Actions</p>
                    <button
                      type="button"
                      onClick={() => settingsMutation.mutate()}
                      disabled={settingsMutation.isPending}
                      className="mt-2 inline-flex rounded-[3px] border border-[#1a9fff] bg-[#1a9fff]/15 px-3 py-1 text-sm text-[#7cc5ff] hover:bg-[#1a9fff]/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {settingsMutation.isPending ? "Saving..." : "Save Settings"}
                    </button>
                    <p className="mt-2 text-xs text-[#9fb0c2]">Edits save directly without leaving this view.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-2xl text-steel-300">No part selected.</div>
        )}
      </div>
    </section>
  );
}

