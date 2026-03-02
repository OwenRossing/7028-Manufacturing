"use client";

import { PartStatus } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronDown, X, Settings } from "lucide-react";
import {
  canonicalStatusForStage,
  stageLabel,
  STAGE_ORDER,
  statusToStage,
  type WorkflowStage
} from "@/lib/status";
import { PartListItem } from "@/types/parts";
import { queryKeys } from "@/lib/query-keys";
import { mediaUrlFromStorageKey } from "@/lib/media-url";

type PartsResponse = {
  items: PartListItem[];
  total: number;
  page: number;
  pageSize: number;
};
type MeResponse = {
  id: string;
  displayName: string;
  isAdmin: boolean;
};

type NoteMessage = {
  id: string;
  text: string;
  createdAt: string;
};
type DetailPhoto = {
  id: string;
  storageKey: string;
  mimeType?: string;
};
type PreviewMedia = {
  storageKey: string;
  mimeType?: string;
};

type PriorityTier = "ASAP" | "NORMAL" | "BACKBURNER";
type MainView = "HOME" | "STAGE" | "DETAIL" | "OVERVIEW";
type SubsystemKey = string;
const MOBILE_BREAKPOINT = 1024;
const EDGE_SWIPE_CLOSE_PX = 80;
const EDGE_SWIPE_OPEN_PX = 70;
const EDGE_SWIPE_INTENT_RATIO = 1.5;

function stageCollectionLabel(stage: WorkflowStage): string {
  return stageLabel(stage).toUpperCase();
}

function stageCollectionSort(stage: WorkflowStage): number {
  if (stage === "UNASSIGNED") return 0;
  if (stage === "ASSIGNED") return 1;
  if (stage === "MACHINED") return 2;
  return 3;
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

function isVideoStorageKey(storageKey: string | null | undefined): boolean {
  if (!storageKey) return false;
  return /\.(mp4|webm|ogg|mov|m4v|avi)$/i.test(storageKey);
}

function crewSummary(part: PartListItem): string {
  const names = part.owners.map((owner) => owner.user.displayName);
  if (!names.length) return "Unassigned";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function PartsExplorer({ currentUserId }: { currentUserId: string | null }) {
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const installBarRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const closeSwipeActiveRef = useRef(false);
  const closeSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const openSwipeActiveRef = useRef(false);
  const openSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const previousProjectIdRef = useRef<string | null>(null);
  const previousListViewRef = useRef<MainView>("HOME");
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const projectId = searchParams.get("projectId");
  const partIdFromQuery = searchParams.get("partId");
  const activeTab = searchParams.get("tab");
  const search = (searchParams.get("q") ?? "").trim().toLowerCase();

  const [view, setView] = useState<MainView>("HOME");
  const [activeStage, setActiveStage] = useState<WorkflowStage>("ASSIGNED");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [stageOpen, setStageOpen] = useState<Record<WorkflowStage, boolean>>({
    COMPLETED: true,
    MACHINED: true,
    ASSIGNED: true,
    UNASSIGNED: true
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
  const [noteInput, setNoteInput] = useState("");
  const [noteMessages, setNoteMessages] = useState<NoteMessage[]>([]);
  const [feedback, setFeedback] = useState<{ kind: "error" | "warning"; text: string } | null>(null);
  const [detailPhotos, setDetailPhotos] = useState<DetailPhoto[]>([]);
  const [previewMedia, setPreviewMedia] = useState<PreviewMedia | null>(null);
  const [viewportWidth, setViewportWidth] = useState(MOBILE_BREAKPOINT);
  const [mobileDetailSwipeOffset, setMobileDetailSwipeOffset] = useState(0);
  const mobileActive = viewportWidth < MOBILE_BREAKPOINT;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    params.set("pageSize", "500");
    return params.toString();
  }, [projectId]);

  const query = useQuery({
    queryKey: queryKeys.parts.list(queryString),
    queryFn: async () => {
      const response = await fetch(`/api/parts?${queryString}`);
      if (!response.ok) throw new Error("Unable to load parts.");
      return (await response.json()) as PartsResponse;
    },
    refetchInterval: 10_000
  });
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await fetch("/api/me");
      if (!response.ok) throw new Error("Unable to load current user.");
      return (await response.json()) as MeResponse;
    },
    enabled: Boolean(currentUserId)
  });
  const isAdmin = Boolean(meQuery.data?.isAdmin);

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
    const root = detailScrollRef.current;
    const target = installBarRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Show the compact header only after the install/stage bar leaves view.
        setShowCompactDetailHeader(!entry.isIntersecting || entry.intersectionRatio < 0.98);
      },
      { root, threshold: [0, 0.5, 0.98, 1] }
    );
    observer.observe(target);
    return () => observer.disconnect();
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

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewMedia(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

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
  const selectedPrimaryOwnerId = useMemo(
    () => selectedPart?.owners.find((owner) => owner.role === "PRIMARY")?.userId ?? null,
    [selectedPart]
  );
  const selectedCollaborators = useMemo(
    () => selectedPart?.owners.filter((owner) => owner.role === "COLLABORATOR").map((owner) => owner.user.displayName) ?? [],
    [selectedPart]
  );
  const selectedCollaboratorIds = useMemo(
    () => selectedPart?.owners.filter((owner) => owner.role === "COLLABORATOR").map((owner) => owner.userId) ?? [],
    [selectedPart]
  );
  const selectedCollaboratorLabel = selectedCollaborators.length
    ? selectedCollaborators.length <= 2
      ? selectedCollaborators.join(", ")
      : `${selectedCollaborators.slice(0, 2).join(", ")} +${selectedCollaborators.length - 2}`
    : "None";
  const selectedFinisherName = selectedCollaborators.length ? selectedCollaboratorLabel : "Unassigned";
  const canEditPart = useCallback(
    (part: PartListItem | null) =>
      Boolean(part && (isAdmin || (currentUserId && part.owners.some((owner) => owner.userId === currentUserId)))),
    [currentUserId, isAdmin]
  );
  const canEditSelectedPart = canEditPart(selectedPart);
  const readOnlyReason = !currentUserId
    ? "Read-only: sign in to claim or edit this part."
    : "Read-only: claim machinist or finisher, or ask an assigned user/admin.";
  const canClaimMachinist = Boolean(currentUserId && selectedPart && !selectedPrimaryOwnerId);
  const canClaimFinisher = Boolean(
    currentUserId &&
      selectedPart &&
      selectedCollaboratorIds.length === 0
  );

  const stageForItem = (part: PartListItem): WorkflowStage => statusToStage(part.status, part.owners.length > 0);

  useEffect(() => {
    if (activeTab === "overview" || activeTab === "community") {
      setView("OVERVIEW");
      return;
    }
    if (activeTab === "board") {
      setView("STAGE");
      return;
    }
    setView((prev) => (prev === "OVERVIEW" ? "HOME" : prev));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab || partIdFromQuery) return;
    const nextParams = new URLSearchParams(paramsString);
    nextParams.set("tab", "board");
    const nextHref = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextHref, { scroll: false });
  }, [activeTab, paramsString, partIdFromQuery, pathname, router]);

  useEffect(() => {
    if (activeTab === "overview" || activeTab === "community" || activeTab === "board") return;
    if (partIdFromQuery || (mobileActive && view === "DETAIL" && Boolean(selectedPartId))) {
      setView("DETAIL");
      return;
    }
    setView((prev) => (prev === "DETAIL" ? "HOME" : prev));
  }, [activeTab, mobileActive, partIdFromQuery, selectedPartId, view]);

  useEffect(() => {
    if (partIdFromQuery) {
      setSelectedPartId(partIdFromQuery);
      return;
    }
    if (!selectedPartId && sorted.length) {
      setSelectedPartId(sorted[0].id);
      return;
    }
    if (selectedPartId && !sorted.some((part) => part.id === selectedPartId)) {
      setSelectedPartId(sorted[0]?.id ?? null);
    }
  }, [partIdFromQuery, selectedPartId, sorted]);

  useEffect(() => {
    if (view !== "DETAIL") return;
    setDetailPanel("main");
  }, [selectedPartId, view]);

  useEffect(() => {
    const apply = () => setViewportWidth(window.innerWidth);
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  useEffect(() => {
    const previousProjectId = previousProjectIdRef.current;
    if (!previousProjectId) {
      previousProjectIdRef.current = projectId;
      return;
    }
    if (previousProjectId !== projectId && partIdFromQuery) {
      const nextParams = new URLSearchParams(paramsString);
      nextParams.delete("partId");
      const nextHref = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
      router.replace(nextHref, { scroll: false });
    }
    previousProjectIdRef.current = projectId;
  }, [paramsString, partIdFromQuery, pathname, projectId, router]);

  useEffect(() => {
    if (!selectedPartId) {
      setDetailPhotos([]);
      return;
    }
    let active = true;
    void fetch(`/api/parts/${selectedPartId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load photos.");
        return (await response.json()) as { photos?: DetailPhoto[] };
      })
      .then((data) => {
        if (!active) return;
        setDetailPhotos(data.photos ?? []);
      })
      .catch(() => {
        if (!active) return;
        setDetailPhotos([]);
      });
    return () => {
      active = false;
    };
  }, [selectedPartId]);

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
      setNoteMessages([]);
      return;
    }
    try {
      const raw =
        window.localStorage.getItem(`part-notes-${selectedPartId}`) ??
        window.localStorage.getItem(`part-discussion-${selectedPartId}`);
      if (!raw) {
        setNoteMessages([]);
        return;
      }
      const parsed = JSON.parse(raw) as NoteMessage[];
      setNoteMessages(Array.isArray(parsed) ? parsed : []);
    } catch {
      setNoteMessages([]);
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics.all });
    }
  });

  const settingsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPart) throw new Error("No part selected.");
      if (!canEditSelectedPart) throw new Error(readOnlyReason);
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics.all });
    },
    onError: (error: Error) => {
      setFeedback({ kind: "error", text: error.message || "Unable to save settings." });
    }
  });

  const quickQtyMutation = useMutation({
    mutationFn: async (nextComplete: number) => {
      if (!selectedPart) throw new Error("No part selected.");
      if (!canEditSelectedPart) throw new Error(readOnlyReason);
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics.all });
    },
    onError: (error: Error) => setFeedback({ kind: "error", text: error.message || "Unable to update quantity." })
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedPart) throw new Error("No part selected.");
      if (!canEditSelectedPart) throw new Error(readOnlyReason);
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(`/api/parts/${selectedPart.id}/photos`, { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; photo?: { id: string; storageKey: string; mimeType?: string } }
        | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to upload file.");
      return data?.photo ?? null;
    },
    onMutate: () => setFeedback(null),
    onSuccess: (photo) => {
      if (photo) {
        setDetailPhotos((prev) => [{ id: photo.id, storageKey: photo.storageKey, mimeType: photo.mimeType }, ...prev]);
        if (selectedPart && !photoForPart(selectedPart)) setThumbnail(selectedPart.id, photo.storageKey);
      }
      setFeedback({ kind: "warning", text: "File uploaded." });
      void queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics.all });
    },
    onError: (error: Error) => setFeedback({ kind: "error", text: error.message || "Unable to upload file." })
  });

  const claimMachinistMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPart) throw new Error("No part selected.");
      const response = await fetch(`/api/parts/${selectedPart.id}/claim-machinist`, {
        method: "POST"
      });
      const data = (await response.json().catch(() => null)) as (PartListItem & { error?: string }) | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to claim machinist.");
      return data;
    },
    onMutate: () => setFeedback(null),
    onSuccess: (updated) => {
      if (updated?.id) {
        setLiveItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      }
      setFeedback({ kind: "warning", text: "Machinist claimed." });
      void queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics.all });
    },
    onError: (error: Error) => setFeedback({ kind: "error", text: error.message || "Unable to claim machinist." })
  });

  const claimFinisherMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPart) throw new Error("No part selected.");
      const response = await fetch(`/api/parts/${selectedPart.id}/claim-finisher`, {
        method: "POST"
      });
      const data = (await response.json().catch(() => null)) as (PartListItem & { error?: string }) | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to claim finisher.");
      return data;
    },
    onMutate: () => setFeedback(null),
    onSuccess: (updated) => {
      if (updated?.id) {
        setLiveItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      }
      setFeedback({ kind: "warning", text: "Finisher claimed." });
      void queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics.all });
    },
    onError: (error: Error) => setFeedback({ kind: "error", text: error.message || "Unable to claim finisher." })
  });

  function requestStageMove(partId: string, toStatus: PartStatus, targetStage?: WorkflowStage) {
    const item = liveItems.find((part) => part.id === partId);
    if (!item) return;
    if (!canEditPart(item)) {
      setFeedback({ kind: "warning", text: readOnlyReason });
      return;
    }
    if (targetStage === "UNASSIGNED" && item.owners.length > 0) {
      setFeedback({ kind: "warning", text: "Clear machinist/finisher in settings before moving to Unassigned." });
      return;
    }
    if (targetStage === "ASSIGNED" && item.owners.length === 0) {
      setFeedback({ kind: "warning", text: "Assign a machinist before moving to Assigned." });
      return;
    }
    if (item.status === toStatus) return;
    const goingCompleted = statusToStage(toStatus) === "COMPLETED";
    if (goingCompleted && item.photos.length === 0) {
      setFeedback({ kind: "warning", text: "Upload a photo before marking this part completed." });
      return;
    }
    moveMutation.mutate({ partId, toStatus });
  }

  function photoForPart(part: PartListItem | null): string | null {
    if (!part) return null;
    return part.thumbnailStorageKey ?? part.photos[0]?.storageKey ?? null;
  }

  async function setThumbnail(partId: string, storageKey: string) {
    const item = liveItems.find((part) => part.id === partId) ?? null;
    if (!canEditPart(item)) {
      setFeedback({ kind: "warning", text: readOnlyReason });
      return;
    }
    setFeedback(null);
    const response = await fetch(`/api/parts/${partId}/thumbnail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageKey })
    });
    const data = (await response.json().catch(() => null)) as
      | { error?: string; storageKey?: string | null }
      | null;
    if (!response.ok) {
      setFeedback({ kind: "error", text: data?.error ?? "Unable to set thumbnail." });
      return;
    }
    setLiveItems((prev) =>
      prev.map((item) =>
        item.id === partId
            ? {
                ...item,
                thumbnailStorageKey: data?.storageKey ?? storageKey
              }
            : item
      )
    );
    setFeedback({ kind: "warning", text: "Thumbnail updated." });
    void queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
  }

  function isVideoPhoto(photo: DetailPhoto): boolean {
    return Boolean(photo.mimeType?.startsWith("video/")) || isVideoStorageKey(photo.storageKey);
  }

  function isVideoPreview(media: PreviewMedia | null): boolean {
    if (!media) return false;
    return Boolean(media.mimeType?.startsWith("video/")) || isVideoStorageKey(media.storageKey);
  }

  function openMediaPreview(photo: DetailPhoto) {
    setPreviewMedia({ storageKey: photo.storageKey, mimeType: photo.mimeType });
  }

  const setPartIdQuery = useCallback((nextPartId: string | null, historyMode: "push" | "replace") => {
    const nextParams = new URLSearchParams(paramsString);
    if (nextPartId) nextParams.set("partId", nextPartId);
    else nextParams.delete("partId");
    const nextHref = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    if (historyMode === "push") router.push(nextHref, { scroll: false });
    else router.replace(nextHref, { scroll: false });
  }, [paramsString, pathname, router]);

  function openPartDetail(partId: string) {
    if (view !== "DETAIL") {
      previousListViewRef.current = view;
    }
    setSelectedPartId(partId);
    setView("DETAIL");
    setDetailPanel("main");
    if (!mobileActive) {
      setPartIdQuery(partId, "push");
    }
  }

  function closeMobileDetail() {
    const fallbackView = previousListViewRef.current === "DETAIL" ? "HOME" : previousListViewRef.current;
    setView(fallbackView);
    if (!mobileActive) {
      setPartIdQuery(null, "replace");
    }
  }

  function postNoteMessage() {
    if (!selectedPartId) return;
    const text = noteInput.trim();
    if (!text) return;
    const message: NoteMessage = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() };
    const next = [...noteMessages, message];
    setNoteMessages(next);
    setNoteInput("");
    try {
      window.localStorage.setItem(`part-notes-${selectedPartId}`, JSON.stringify(next));
    } catch {
      setFeedback({ kind: "warning", text: "Note added for this session only." });
    }
  }

  const byStage = useMemo(() => {
    const grouped: Record<WorkflowStage, PartListItem[]> = {
      UNASSIGNED: [],
      ASSIGNED: [],
      MACHINED: [],
      COMPLETED: []
    };
    for (const part of sorted) {
      grouped[stageForItem(part)].push(part);
    }
    return grouped;
  }, [sorted]);

  const mostImportant = sorted.slice(0, 3);
  const myParts = (currentUserId
    ? sorted.filter((part) => part.owners.some((owner) => owner.userId === currentUserId))
    : sorted
  ).slice(0, 10);

  const stageItems = useMemo(() => sorted.filter((part) => stageForItem(part) === activeStage), [sorted, activeStage]);
  const mobileDetailOpen = mobileActive && view === "DETAIL" && Boolean(selectedPartId);
  const mobileBoardMode = mobileActive && activeTab === "board";
  const mobileListMenuOpen = mobileBoardMode && view === "HOME" && !mobileDetailOpen;
  const communityLeaderboard = useMemo(() => {
    const counts = new Map<string, { total: number; completed: number }>();
    for (const part of sorted) {
      for (const owner of part.owners) {
        const existing = counts.get(owner.user.displayName) ?? { total: 0, completed: 0 };
        existing.total += 1;
        if (stageForItem(part) === "COMPLETED") existing.completed += 1;
        counts.set(owner.user.displayName, existing);
      }
    }
    return Array.from(counts.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.completed - a.completed || b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [sorted]);

  useEffect(() => {
    if (!partIdFromQuery || query.isPending) return;
    const exists = sorted.some((part) => part.id === partIdFromQuery);
    if (exists) return;
    setFeedback({ kind: "warning", text: "Part not found." });
    setPartIdQuery(null, "replace");
  }, [partIdFromQuery, query.isPending, setPartIdQuery, sorted]);

  function onDetailTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!mobileDetailOpen) return;
    const touch = event.touches[0];
    if (!touch) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, button, a, [role='button']")) return;
    closeSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    closeSwipeActiveRef.current = true;
  }

  function onDetailTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!mobileDetailOpen || !closeSwipeActiveRef.current) return;
    const start = closeSwipeStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dx <= 0) {
      closeSwipeActiveRef.current = false;
      return;
    }
    if (Math.abs(dx) <= Math.abs(dy) * EDGE_SWIPE_INTENT_RATIO) {
      closeSwipeActiveRef.current = false;
      setMobileDetailSwipeOffset(0);
      return;
    }
    setMobileDetailSwipeOffset(Math.max(0, dx));
  }

  function onDetailTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!mobileDetailOpen) return;
    const start = closeSwipeStartRef.current;
    const touch = event.changedTouches[0];
    closeSwipeStartRef.current = null;
    if (!closeSwipeActiveRef.current || !start || !touch) {
      closeSwipeActiveRef.current = false;
      return;
    }
    closeSwipeActiveRef.current = false;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    setMobileDetailSwipeOffset(0);
    if (dx >= EDGE_SWIPE_CLOSE_PX && Math.abs(dx) > Math.abs(dy) * EDGE_SWIPE_INTENT_RATIO) {
      closeMobileDetail();
    }
  }

  function onBoardTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!mobileBoardMode || view !== "STAGE" || !selectedPartId) return;
    const touch = event.touches[0];
    if (!touch || touch.clientX > 28) return;
    openSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    openSwipeActiveRef.current = true;
  }

  function onBoardTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!openSwipeActiveRef.current) return;
    const start = openSwipeStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dx <= 0 || Math.abs(dx) <= Math.abs(dy) * EDGE_SWIPE_INTENT_RATIO) {
      openSwipeActiveRef.current = false;
    }
  }

  function onBoardTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!openSwipeActiveRef.current) return;
    const start = openSwipeStartRef.current;
    const touch = event.changedTouches[0];
    openSwipeStartRef.current = null;
    openSwipeActiveRef.current = false;
    if (!start || !touch || !selectedPartId) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dx >= EDGE_SWIPE_OPEN_PX && Math.abs(dx) > Math.abs(dy) * EDGE_SWIPE_INTENT_RATIO) {
      openPartDetail(selectedPartId);
    }
  }

  return (
    <section className="relative grid h-[calc(100dvh-104px)] min-h-0 overflow-hidden grid-cols-1 grid-rows-[1fr] lg:grid-cols-[392px_1fr] lg:grid-rows-1">
      <aside
        className={`relative z-30 h-full min-h-0 flex-col border-r border-[#0e141b] bg-[#24282f] ${
          mobileListMenuOpen
            ? "absolute inset-0 flex w-full border-r-0"
            : "hidden lg:flex"
        } ${mobileListMenuOpen ? "z-10" : ""}`}
      >
        <div className={`bg-[#171d25] px-2 pb-3 pt-2 ${mobileBoardMode && mobileDetailOpen ? "hidden" : ""}`}>
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
                <span>Filters</span>
                <ChevronDown className="h-4 w-4 text-[#8f98a0]" />
              </button>
            </div>
            {typeMenuOpen ? (
              <div className="absolute left-0 top-full z-[70] mt-1 w-full border border-[#5a6473] bg-[#3d4a5d] p-2 text-sm text-[#c7d5e0]">
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
              Sign in to use &quot;Show only my parts.&quot;
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
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
                    requestStageMove(partId, canonicalStatusForStage(stage), stage);
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
                        openPartDetail(part.id);
                      }}
                      className={`mr-2 flex w-[calc(100%-8px)] items-center gap-2 px-5 py-[3px] text-left ${
                        selectedPartId === part.id && view === "DETAIL"
                          ? "bg-[#3e4e69] text-[#cae4fb]"
                          : "text-[#c7d5e0] hover:bg-[#2a3d55]"
                      }`}
                    >
                      <span className="h-4 w-4 overflow-hidden bg-[#2a475e]">
                        {part.photos[0] ? (
                          isVideoStorageKey(part.photos[0].storageKey) ? (
                            <div className="flex h-full w-full items-center justify-center bg-[#1b2431] text-[10px] text-[#9fb0c2]">V</div>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrlFromStorageKey(part.photos[0].storageKey)} alt={part.name} className="h-full w-full object-cover" />
                          )
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className={`line-clamp-1 block text-[15px] leading-tight ${priorityNameClass(part.priority)}`}>{part.name}</span>
                        <span className="line-clamp-1 block text-[11px] text-[#7f8ea0]">{part.partNumber}</span>
                      </div>
                      <span className="rounded-full border border-white/20 bg-black/35 px-2 py-0.5 text-[10px] text-[#d6e4f2]">
                        {part.quantityComplete}/{part.quantityRequired}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
      <div
        className={`h-full min-h-0 overflow-hidden bg-steel-850 ${
          mobileListMenuOpen ? "hidden" : ""
        } ${
          mobileActive && view === "DETAIL"
            ? "absolute inset-0 z-30 w-full border-l-0 shadow-none transition-transform duration-200 ease-out"
            : ""
        } ${
          mobileActive && view === "DETAIL" && !mobileDetailOpen ? "translate-x-full pointer-events-none" : ""
        } relative z-10`}
        style={mobileDetailOpen ? { transform: `translateX(${mobileDetailSwipeOffset}px)` } : undefined}
        onTouchStart={onBoardTouchStart}
        onTouchMove={onBoardTouchMove}
        onTouchEnd={onBoardTouchEnd}
      >
        {mobileBoardMode && view !== "HOME" && !mobileDetailOpen ? (
          <div className="px-3 pt-3 lg:hidden">
            <button
              type="button"
              onClick={() => setView("HOME")}
              className="rounded-[3px] border border-[#324960] bg-[#222c38] px-3 py-1.5 text-xs font-semibold text-[#c7d5e0]"
            >
              Parts menu
            </button>
          </div>
        ) : null}
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {mostImportant.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => {
                      openPartDetail(part.id);
                    }}
                    className={`relative h-[184px] overflow-hidden border text-left ${priorityClass(part.priority)}`}
                  >
                    {part.photos[0] && !isVideoStorageKey(part.photos[0].storageKey) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrlFromStorageKey(part.photos[0].storageKey)} alt={part.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-steel-800" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.86))] p-2">
                      <p className="line-clamp-1 text-sm font-semibold text-white">{part.name}</p>
                      <p className="line-clamp-1 text-xs text-steel-300">{part.partNumber}</p>
                      <p className="line-clamp-1 text-xs text-steel-300">Crew: {crewSummary(part)}</p>
                      <p className="text-xs text-steel-200">Qty {part.quantityComplete}/{part.quantityRequired}</p>
                    </div>
                  </button>
                ))}
              </div>
              {!mostImportant.length ? <p className="text-sm text-steel-300">No parts to show in Most Important yet.</p> : null}
            </section>

            <section>
              <h3 className="mb-2 text-3xl font-semibold text-steel-100">My Parts</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {myParts.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => {
                      openPartDetail(part.id);
                    }}
                    className={`relative h-[184px] overflow-hidden border text-left ${priorityClass(part.priority)}`}
                  >
                    {part.photos[0] && !isVideoStorageKey(part.photos[0].storageKey) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrlFromStorageKey(part.photos[0].storageKey)} alt={part.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-steel-800" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.86))] p-2">
                      <p className="line-clamp-1 text-sm font-semibold text-white">{part.name}</p>
                      <p className="line-clamp-1 text-xs text-steel-300">{part.partNumber}</p>
                      <p className="line-clamp-1 text-xs text-steel-300">{crewSummary(part)}</p>
                      <p className="text-xs text-steel-200">Qty {part.quantityComplete}/{part.quantityRequired}</p>
                    </div>
                  </button>
                ))}
              </div>
              {!myParts.length ? <p className="text-sm text-steel-300">No parts assigned yet.</p> : null}
            </section>
          </div>
        ) : view === "OVERVIEW" ? (
          <div className="h-full overflow-y-auto p-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <section className="rounded-[3px] border border-[#31465f] bg-[linear-gradient(120deg,rgba(39,51,67,0.65),rgba(28,38,52,0.85))] p-4">
                <h2 className="text-3xl font-semibold text-steel-100">Season Progress</h2>
                <p className="mt-2 text-sm text-steel-300">
                  {sorted.filter((part) => stageForItem(part) === "COMPLETED").length} of {sorted.length} parts completed
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#1c2635]">
                  <div
                    className="h-full bg-[#1a9fff]"
                    style={{
                      width: `${sorted.length ? Math.round((sorted.filter((part) => stageForItem(part) === "COMPLETED").length / sorted.length) * 100) : 0}%`
                    }}
                  />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {(["UNASSIGNED", "ASSIGNED", "MACHINED", "COMPLETED"] as WorkflowStage[]).map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => {
                        setActiveStage(stage);
                        setView("STAGE");
                      }}
                      className="rounded-[3px] border border-[#31465f] bg-[#202a38] px-3 py-2 text-left hover:bg-[#263344]"
                    >
                      <p className="text-xs uppercase tracking-wide text-[#9fb0c2]">{stageLabel(stage)}</p>
                      <p className="text-xl font-semibold text-[#d6e4f2]">{byStage[stage].length}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <h3 className="text-xl font-semibold text-steel-100">Progress By Subsystem</h3>
                  <div className="mt-2 space-y-2">
                    {subsystemCounts.map(([key]) => {
                      const items = sorted.filter((part) => subsystemFromPartNumber(part.partNumber) === key);
                      const done = items.filter((part) => stageForItem(part) === "COMPLETED").length;
                      const pct = items.length ? Math.round((done / items.length) * 100) : 0;
                      return (
                        <div key={key} className="rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 py-2">
                          <div className="flex items-center justify-between text-sm text-[#d6e4f2]">
                            <span>{subsystemLabel(key)}</span>
                            <span>{done}/{items.length}</span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#101721]">
                            <div className="h-full bg-[#1a9fff]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
              <section className="rounded-[3px] border border-[#31465f] bg-[linear-gradient(120deg,rgba(39,51,67,0.65),rgba(28,38,52,0.85))] p-4">
                <h3 className="text-2xl font-semibold text-steel-100">Leaderboard</h3>
                <p className="text-sm text-steel-300">Top contributors this season.</p>
                <div className="mt-3 space-y-2">
                  {communityLeaderboard.map((person, index) => (
                    <div key={person.name} className="rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 py-2">
                      <p className="text-sm text-[#d6e4f2]">{index + 1}. {person.name}</p>
                      <p className="text-xs text-[#9fb0c2]">
                        Completed: {person.completed} | Assigned: {person.total}
                      </p>
                    </div>
                  ))}
                  {!communityLeaderboard.length ? <p className="text-sm text-steel-300">No contributor stats yet.</p> : null}
                </div>
              </section>
            </div>
          </div>
        ) : view === "STAGE" ? (
          <div className="h-full overflow-y-auto p-4 pb-6">
            <h2 className="mb-3 text-3xl font-semibold text-steel-100">{stageLabel(activeStage).toUpperCase()}</h2>
            <div
              className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6"
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                const partId = event.dataTransfer.getData("text/plain");
                if (!partId) return;
                requestStageMove(partId, canonicalStatusForStage(activeStage));
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
                    openPartDetail(part.id);
                  }}
                  className={`relative overflow-hidden border text-left ${priorityClass(part.priority)}`}
                >
                  {part.photos[0] && !isVideoStorageKey(part.photos[0].storageKey) ? (
                    <div className="h-28 bg-steel-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrlFromStorageKey(part.photos[0].storageKey)} alt={part.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-14 bg-steel-800/70" />
                  )}
                  <div className="relative min-h-[88px] space-y-0.5 bg-[linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.55))] p-2.5">
                    <p className="line-clamp-1 text-sm font-semibold text-white">{part.name}</p>
                    <p className="line-clamp-1 text-xs text-steel-300">{part.partNumber}</p>
                    <p className="line-clamp-1 text-xs text-steel-300">{crewSummary(part)}</p>
                    <p className="text-xs text-steel-300">Stage: {stageLabel(stageForItem(part))}</p>
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
          <div
            ref={detailScrollRef}
            className="relative h-full overflow-y-auto bg-[#242830] pb-16 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onTouchStart={onDetailTouchStart}
            onTouchMove={onDetailTouchMove}
            onTouchEnd={onDetailTouchEnd}
          >
            {showCompactDetailHeader && !mobileActive ? (
              <div className="sticky top-0 z-30 border-y border-[#31465f] bg-[linear-gradient(90deg,rgba(27,40,56,0.94),rgba(38,49,64,0.94),rgba(27,40,56,0.94))] px-5 py-2 backdrop-blur-sm">
              <div className="grid grid-cols-[max-content_minmax(0,1fr)_max-content] items-center gap-3 overflow-hidden max-lg:grid-cols-1">
                <div className="relative inline-flex h-11 min-w-[156px] items-center rounded-[2px] border border-[#2f6eb6] bg-[#1a9fff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <span className="pointer-events-none absolute left-3 text-lg font-semibold tracking-wide">
                    {stageLabel(statusToStage(selectedPart.status))}
                  </span>
                  <select
                    value={statusToStage(selectedPart.status)}
                    onChange={(event) =>
                      requestStageMove(
                        selectedPart.id,
                        canonicalStatusForStage(event.target.value as WorkflowStage)
                      )
                    }
                    disabled={!canEditSelectedPart || moveMutation.isPending}
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
                    {photoForPart(selectedPart) ? (
                      isVideoStorageKey(photoForPart(selectedPart)) ? (
                        <div className="flex h-full w-full items-center justify-center bg-[#1b2431] text-[10px] text-[#9fb0c2]">V</div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrlFromStorageKey(photoForPart(selectedPart))} alt={selectedPart.name} className="h-full w-full object-cover" />
                      )
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-2xl">{selectedPart.name}</p>
                    <p className="truncate text-xs text-[#9fb0c2]">{selectedPart.partNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => detailScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                  className="inline-flex h-9 min-w-[144px] items-center justify-center rounded-[4px] border border-[#435266] bg-[#3a4659] px-3 text-xs font-semibold text-[#c7d5e0] hover:bg-[#4a5970]"
                >
                  Scroll To Top
                </button>
              </div>
              </div>
            ) : null}

            <div className="relative h-[360px] overflow-hidden border-b border-[#31465f]">
              {photoForPart(selectedPart) ? (
                <>
                  {isVideoStorageKey(photoForPart(selectedPart)) ? (
                    <video
                      src={mediaUrlFromStorageKey(photoForPart(selectedPart))}
                      className="absolute inset-0 h-full w-full object-cover opacity-85"
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaUrlFromStorageKey(photoForPart(selectedPart))}
                        alt={selectedPart.name}
                        className="absolute inset-0 h-full w-full scale-105 object-cover blur-2xl opacity-35"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaUrlFromStorageKey(photoForPart(selectedPart))}
                        alt={selectedPart.name}
                        className="absolute inset-0 h-full w-full object-cover opacity-95"
                      />
                    </>
                  )}
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

            <div
              ref={installBarRef}
              className="grid grid-cols-[max-content_minmax(0,1fr)_max-content] border-b border-[#31465f] bg-[linear-gradient(90deg,rgba(24,34,48,0.96),rgba(43,54,71,0.92),rgba(24,34,48,0.96))] backdrop-blur-sm max-lg:grid-cols-1"
            >
              <div className="m-3 flex items-center gap-2">
                <div className="relative inline-flex h-12 min-w-[156px] items-center rounded-[2px] border border-[#2f6eb6] bg-[#1a9fff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <span className="pointer-events-none absolute left-3 text-xl font-semibold tracking-wide">
                    {stageLabel(statusToStage(selectedPart.status))}
                  </span>
                  <select
                    value={statusToStage(selectedPart.status)}
                    onChange={(event) =>
                      requestStageMove(
                        selectedPart.id,
                        canonicalStatusForStage(event.target.value as WorkflowStage)
                      )
                    }
                    disabled={!canEditSelectedPart || moveMutation.isPending}
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
                <button
                  onClick={() => setDetailPanel((prev) => (prev === "settings" ? "main" : "settings"))}
                  className={`inline-flex h-12 items-center justify-center gap-2 rounded-[4px] border px-3 lg:hidden ${
                    detailPanel === "settings"
                      ? "border-[#1a9fff] bg-[#1a9fff]/25 text-[#c7e7ff]"
                      : "border-[#435266] bg-[#3a4659] text-[#c7d5e0] hover:bg-[#4a5970]"
                  }`}
                >
                  <Settings className="h-5 w-5" />
                  <span className="text-xs font-semibold">Settings</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 px-2 py-2 text-center lg:grid-cols-4">
                <div className="rounded-[3px] bg-[rgba(19,27,39,0.45)] py-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#9aa8b8]">Machinist</p>
                  <p className="whitespace-normal break-words px-2 text-base leading-tight text-[#d6e4f2]">{selectedPrimaryOwnerName}</p>
                  {canClaimMachinist ? (
                    <div className="mt-2 px-2">
                      <button
                        type="button"
                        onClick={() => claimMachinistMutation.mutate()}
                        disabled={claimMachinistMutation.isPending}
                        className="w-full rounded-[3px] border border-[#1a9fff] bg-[#1a9fff]/15 px-2 py-1 text-xs text-[#7cc5ff] hover:bg-[#1a9fff]/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {claimMachinistMutation.isPending ? "Claiming..." : "Claim Machinist"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[3px] bg-[rgba(19,27,39,0.45)] py-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#9aa8b8]">Finisher</p>
                  <p className="whitespace-normal break-words px-2 text-base leading-tight text-[#d6e4f2]">{selectedFinisherName}</p>
                  {canClaimFinisher ? (
                    <div className="mt-2 px-2">
                      <button
                        type="button"
                        onClick={() => claimFinisherMutation.mutate()}
                        disabled={claimFinisherMutation.isPending}
                        className="w-full rounded-[3px] border border-[#1a9fff] bg-[#1a9fff]/15 px-2 py-1 text-xs text-[#7cc5ff] hover:bg-[#1a9fff]/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {claimFinisherMutation.isPending ? "Claiming..." : "Claim Finisher"}
                      </button>
                    </div>
                  ) : null}
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
              <div className="mr-4 hidden items-center gap-2 lg:flex">
                <button
                  onClick={() => setDetailPanel((prev) => (prev === "settings" ? "main" : "settings"))}
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
            {!canEditSelectedPart ? <p className="px-4 py-2 text-xs text-[#9fb0c2]">{readOnlyReason}</p> : null}

            {detailPanel === "main" ? (
              <div className="space-y-5 bg-[radial-gradient(circle_at_20%_20%,rgba(97,132,170,0.15),transparent_50%)] p-4">
                <div className="grid gap-5 xl:grid-cols-[320px]">
                  <div className="space-y-4 xl:justify-self-end">
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
                          disabled={!canEditSelectedPart || quickQtyMutation.isPending}
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
                          disabled={!canEditSelectedPart || quickQtyMutation.isPending}
                          className="rounded-[3px] border border-[#31465f] bg-[#1d2633] px-2 py-1 text-[#c7d5e0] hover:bg-[#243244]"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-[#31465f] bg-[linear-gradient(120deg,rgba(39,51,67,0.65),rgba(28,38,52,0.85))] p-4">
                  <h3 className="text-2xl font-semibold text-[#d6e4f2]">Photos</h3>
                  <p className="mt-1 text-sm text-[#9fb0c2]">Upload images or videos. Set thumbnail in Settings.</p>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      uploadPhotoMutation.mutate(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={!canEditSelectedPart || uploadPhotoMutation.isPending}
                    className="mt-3 rounded-[3px] border border-[#1a9fff] bg-[#1a9fff]/15 px-3 py-2 text-sm text-[#7cc5ff] hover:bg-[#1a9fff]/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadPhotoMutation.isPending ? "Uploading..." : "Upload Photo/Video"}
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {detailPhotos.map((photo) => (
                      <div key={photo.id} className="rounded-[3px] border border-[#31465f] bg-[#1d2633] p-1">
                        {isVideoPhoto(photo) ? (
                          <button type="button" onClick={() => openMediaPreview(photo)} className="w-full">
                            <video
                              src={mediaUrlFromStorageKey(photo.storageKey)}
                              className="h-24 w-full rounded-[2px] object-cover"
                              muted
                            />
                          </button>
                        ) : (
                          <button type="button" onClick={() => openMediaPreview(photo)} className="w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={mediaUrlFromStorageKey(photo.storageKey)}
                              alt="Part media"
                              className="h-24 w-full rounded-[2px] object-cover"
                            />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!detailPhotos.length ? <p className="mt-2 text-xs text-[#9fb0c2]">No media uploaded yet.</p> : null}
                </div>

                <div className="border border-[#31465f] bg-[linear-gradient(120deg,rgba(39,51,67,0.65),rgba(28,38,52,0.85))] p-4">
                  <h3 className="text-2xl font-semibold text-[#d6e4f2]">Notes</h3>
                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-[3px] border border-[#31465f] bg-[#1a2230] p-3">
                    {noteMessages.length ? (
                      noteMessages.map((message) => (
                        <div key={message.id} className="rounded-[3px] border border-[#374b64] bg-[#202c3c] px-3 py-2">
                          <p className="text-xs uppercase tracking-wide text-[#8ea6bc]">
                            {new Date(message.createdAt).toLocaleString()}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#d6e4f2]">{message.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#9fb0c2]">No notes yet.</p>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <textarea
                      value={noteInput}
                      onChange={(event) => setNoteInput(event.target.value)}
                      placeholder="Add a note..."
                      className="min-h-[72px] flex-1 resize-y rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 py-2 text-sm text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                    />
                    <button
                      type="button"
                      onClick={postNoteMessage}
                      className="h-fit rounded-[3px] border border-[#1a9fff] bg-[#1a9fff]/15 px-3 py-2 text-sm text-[#7cc5ff] hover:bg-[#1a9fff]/25"
                    >
                      Add Note
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
                      disabled={!canEditSelectedPart}
                      className="mt-1 h-10 w-full rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                    />
                    <label className="mt-3 block text-xs text-[#9aa8b8]">Part Number</label>
                    <input
                      value={editPartNumber}
                      onChange={(event) => setEditPartNumber(event.target.value)}
                      disabled={!canEditSelectedPart}
                      className="mt-1 h-10 w-full rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                    />
                    <label className="mt-3 block text-xs text-[#9aa8b8]">Priority</label>
                    <select
                      value={priorityTier(editPriority)}
                      onChange={(event) =>
                        setEditPriority(event.target.value === "ASAP" ? 1 : event.target.value === "NORMAL" ? 3 : 5)
                      }
                      disabled={!canEditSelectedPart}
                      className="mt-1 h-10 w-full rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                    >
                      <option value="ASAP">ASAP</option>
                      <option value="NORMAL">Normal</option>
                      <option value="BACKBURNER">Backburner</option>
                    </select>
                  </div>
                  <div className="border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
                    <p className="text-sm uppercase tracking-wide text-[#9aa8b8]">Roles</p>
                    <p className="mt-2 text-lg text-[#d6e4f2]">Machinist: {selectedPrimaryOwnerName}</p>
                    <p className="text-base text-[#9fb0c2]">Finisher(s): {selectedCollaboratorLabel}</p>
                  </div>
                  <div className="border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
                    <p className="text-sm uppercase tracking-wide text-[#9aa8b8]">Quantity</p>
                    <label className="mt-2 block text-xs text-[#9aa8b8]">Required</label>
                    <input
                      value={editQtyRequired}
                      onChange={(event) => setEditQtyRequired(event.target.value.replace(/\D/g, ""))}
                      disabled={!canEditSelectedPart}
                      className="mt-1 h-10 w-full rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                      inputMode="numeric"
                    />
                    <label className="mt-3 block text-xs text-[#9aa8b8]">Completed</label>
                    <input
                      value={editQtyComplete}
                      onChange={(event) => setEditQtyComplete(event.target.value.replace(/\D/g, ""))}
                      disabled={!canEditSelectedPart}
                      className="mt-1 h-10 w-full rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 text-[#d6e4f2] outline-none focus:border-[#1a9fff]"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="xl:col-span-2 border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
                    <p className="text-sm uppercase tracking-wide text-[#9aa8b8]">Photos</p>
                    <p className="mt-1 text-xs text-[#9fb0c2]">Pick which image is used as the part thumbnail.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {detailPhotos.map((photo) => {
                        const active = photoForPart(selectedPart) === photo.storageKey;
                        return (
                          <div
                            key={photo.id}
                            className={`rounded-[3px] border p-1 ${
                              active ? "border-[#1a9fff] bg-[#1a9fff]/15" : "border-[#31465f] bg-[#1d2633]"
                            }`}
                          >
                            {isVideoPhoto(photo) ? (
                              <button type="button" onClick={() => openMediaPreview(photo)} className="w-full">
                                <video
                                  src={mediaUrlFromStorageKey(photo.storageKey)}
                                  className="h-20 w-full rounded-[2px] object-cover"
                                  muted
                                />
                              </button>
                            ) : (
                              <button type="button" onClick={() => openMediaPreview(photo)} className="w-full">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={mediaUrlFromStorageKey(photo.storageKey)}
                                  alt="Part photo"
                                  className="h-20 w-full rounded-[2px] object-cover"
                                />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setThumbnail(selectedPart.id, photo.storageKey)}
                              disabled={!canEditSelectedPart}
                              className={`mt-1 w-full rounded-[2px] border px-2 py-1 text-xs ${
                                active
                                  ? "border-[#1a9fff] bg-[#1a9fff]/25 text-[#d7efff]"
                                  : "border-[#435266] bg-[#3a4659] text-[#c7d5e0] hover:bg-[#4a5970]"
                              }`}
                            >
                              {active ? "Thumbnail" : "Set Thumbnail"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {!detailPhotos.length ? (
                      <p className="mt-2 text-xs text-[#9fb0c2]">No photos uploaded yet.</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => settingsMutation.mutate()}
                    disabled={!canEditSelectedPart || settingsMutation.isPending}
                    className="inline-flex rounded-[3px] border border-[#1a9fff] bg-[#1a9fff]/15 px-4 py-2 text-sm text-[#7cc5ff] hover:bg-[#1a9fff]/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {settingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-2xl text-steel-300">No part selected.</div>
        )}
        {previewMedia ? (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"
            onClick={() => setPreviewMedia(null)}
          >
            <div
              className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[4px] border border-[#3b4c63] bg-[#121923]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewMedia(null)}
                className="absolute right-2 top-2 z-10 rounded-[3px] border border-[#435266] bg-[#2a3748] p-1 text-[#c7d5e0] hover:bg-[#3a495e]"
              >
                <X className="h-4 w-4" />
              </button>
              {isVideoPreview(previewMedia) ? (
                <video
                  src={mediaUrlFromStorageKey(previewMedia.storageKey)}
                  controls
                  autoPlay
                  className="max-h-[92vh] w-full bg-black object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrlFromStorageKey(previewMedia.storageKey)}
                  alt="Part media preview"
                  className="max-h-[92vh] w-full bg-black object-contain"
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

