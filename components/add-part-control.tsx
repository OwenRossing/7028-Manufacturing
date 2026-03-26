"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusSquare, Upload, X } from "lucide-react";
import { buildSubsystemPartCode, normalizeSeasonYear, sanitizeTeamNumber } from "@/lib/part-number";
import { generateUUID } from "@/lib/uuid";

type MenuPoint = {
  x: number;
  y: number;
};

type AddMode = "MANUAL" | "IMPORT_CSV" | "ONSHAPE";

type PreviewRow = {
  rowIndex: number;
  partNumber: string | null;
  name: string | null;
  quantityNeeded: number | null;
  action: "CREATE" | "UPDATE" | "NO_CHANGE" | "ERROR";
  errorMessage: string | null;
};

type ImportSummary = {
  total: number;
  create: number;
  update: number;
  noChange: number;
  error: number;
  filteredOut: number;
  filters?: {
    team: string;
    year: string;
    robot: string;
  };
};

type WorkspaceOptions = {
  teamNumbers: string[];
  seasonYears: string[];
  robotNumbers: Array<{ teamNumber: string; seasonYear: string; robotNumber: string }>;
  subsystems: Array<{
    teamNumber: string;
    seasonYear: string;
    robotNumber: string;
    subsystemNumber: string;
    label: string | null;
  }>;
};

type UserOption = { id: string; displayName: string; email?: string };
type MeResponse = { id: string; displayName: string; isAdmin: boolean };

type OnshapeDocumentOption = {
  id: string;
  name: string;
};

type OnshapeWorkspaceOption = {
  id: string;
  name: string;
  type: string;
};

type OnshapeElementOption = {
  id: string;
  name: string;
  elementType: string;
};

function normalizeYear(value: string): string {
  return normalizeSeasonYear(value);
}

function buildPartCode(subsystem: string, part: string): string {
  return buildSubsystemPartCode(subsystem, part);
}

function formatActiveFilters(
  filters: ImportSummary["filters"] | undefined,
  fallback: { team: string; year: string; robot: string }
): string {
  const active = filters ?? fallback;
  return `Team ${active.team} / Year ${active.year} / Robot ${active.robot}`;
}

export function AddPartControl({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProjectId = searchParams.get("projectId");
  const [menuPoint, setMenuPoint] = useState<MenuPoint | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>("MANUAL");
  const [info, setInfo] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantityRequired, setQuantityRequired] = useState("1");
  const [quantityComplete, setQuantityComplete] = useState("0");
  const [priority, setPriority] = useState("3");
  const [teamNumber, setTeamNumber] = useState("7028");
  const [seasonYear, setSeasonYear] = useState("26");
  const [robotNumber, setRobotNumber] = useState("1");
  const [subsystemNumber, setSubsystemNumber] = useState("");
  const [partSequence, setPartSequence] = useState("");
  const [machinistId, setMachinistId] = useState("");
  const [finisherId, setFinisherId] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [config, setConfig] = useState<WorkspaceOptions | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importTeamNumber, setImportTeamNumber] = useState("7028");
  const [importSeasonYear, setImportSeasonYear] = useState("26");
  const [importRobotNumber, setImportRobotNumber] = useState("1");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [manualOnshapeIds, setManualOnshapeIds] = useState(false);
  const [documentQuery, setDocumentQuery] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [elementId, setElementId] = useState("");
  const [documents, setDocuments] = useState<OnshapeDocumentOption[]>([]);
  const [workspaces, setWorkspaces] = useState<OnshapeWorkspaceOption[]>([]);
  const [elements, setElements] = useState<OnshapeElementOption[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingElements, setLoadingElements] = useState(false);
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    function onGlobalClick() {
      setMenuPoint(null);
    }
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuPoint(null);
        setWizardOpen(false);
      }
    }
    window.addEventListener("click", onGlobalClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("click", onGlobalClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  useEffect(() => {
    void fetch("/api/me")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load current user role.");
        return (await response.json()) as MeResponse;
      })
      .catch(() => {})
      .finally(() => setRoleLoaded(true));

    void fetch("/api/config/options")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load options.");
        return (await response.json()) as WorkspaceOptions;
      })
      .then((data) => {
        setConfig(data);
        if (data.teamNumbers.length) setTeamNumber((prev) => prev || data.teamNumbers[0]);
        if (data.seasonYears.length) setSeasonYear((prev) => prev || data.seasonYears[data.seasonYears.length - 1]);
        if (data.teamNumbers.length) setImportTeamNumber((prev) => prev || data.teamNumbers[0]);
        if (data.seasonYears.length) setImportSeasonYear((prev) => prev || data.seasonYears[data.seasonYears.length - 1]);
      })
      .catch(() => {
        setConfig(null);
      });

    void fetch("/api/users")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load users.");
        return (await response.json()) as { items: UserOption[] };
      })
      .then((data) => setUsers(data.items ?? []))
      .catch(() => setUsers([]));
  }, []);

  const menuStyle = useMemo(() => {
    if (!menuPoint) return undefined;
    const width = 260;
    const height = 140;
    const x = Math.min(menuPoint.x, window.innerWidth - width - 8);
    const y = Math.max(8, menuPoint.y - height - 8);
    return { left: x, top: y };
  }, [menuPoint]);

  const partCode = useMemo(
    () => buildPartCode(subsystemNumber, partSequence),
    [subsystemNumber, partSequence]
  );
  const fullYear = useMemo(() => normalizeYear(seasonYear), [seasonYear]);
  const partNumberPreview = useMemo(() => {
    const team = sanitizeTeamNumber(teamNumber);
    const robot = robotNumber.replace(/\D/g, "").slice(0, 2);
    if (!team || !fullYear || !robot || !partCode) return "";
    return `${team}-${fullYear}-${robot}-${partCode}`;
  }, [teamNumber, fullYear, robotNumber, partCode]);

  const robotOptions = useMemo(() => {
    if (!config) return [];
    return config.robotNumbers
      .filter((item) => item.teamNumber === teamNumber && item.seasonYear === fullYear)
      .map((item) => item.robotNumber);
  }, [config, teamNumber, fullYear]);
  const teamOptions = config?.teamNumbers?.length ? config.teamNumbers : [teamNumber || "7028"];
  const yearOptions = config?.seasonYears?.length ? config.seasonYears : [seasonYear || normalizeYear(String(new Date().getFullYear()))];
  const importRobotOptions = useMemo(() => {
    if (!config?.robotNumbers?.length) return [importRobotNumber || "1"];
    const filtered = config.robotNumbers
      .filter((item) => item.teamNumber === importTeamNumber && item.seasonYear === normalizeYear(importSeasonYear))
      .map((item) => item.robotNumber);
    return filtered.length ? filtered : [importRobotNumber || "1"];
  }, [config?.robotNumbers, importRobotNumber, importSeasonYear, importTeamNumber]);

  const subsystemOptions = useMemo(() => {
    if (!config) return [];
    return config.subsystems.filter(
      (item) =>
        item.teamNumber === teamNumber &&
        item.seasonYear === fullYear &&
        item.robotNumber === robotNumber
    );
  }, [config, teamNumber, fullYear, robotNumber]);

  function openMenu(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setMenuPoint({ x: event.clientX, y: event.clientY });
  }

  function openWizard(nextMode: AddMode) {
    setMode(nextMode);
    setInfo(null);
    setBatchId(null);
    setRows([]);
    setSummary(null);
    setSelectorError(null);
    setWizardOpen(true);
    setMenuPoint(null);
  }

  useEffect(() => {
    if (!wizardOpen || mode !== "ONSHAPE" || manualOnshapeIds) return;

    const timeout = setTimeout(() => {
      void (async () => {
        setLoadingDocuments(true);
        setSelectorError(null);
        try {
          const query = documentQuery.trim();
          const response = await fetch(
            query ? `/api/onshape/documents?q=${encodeURIComponent(query)}` : "/api/onshape/documents"
          );
          const data = (await response.json().catch(() => null)) as
            | { error?: string; items?: OnshapeDocumentOption[] }
            | null;
          if (!response.ok) {
            throw new Error(data?.error ?? "Failed to load Onshape documents.");
          }
          setDocuments(data?.items ?? []);
        } catch (fetchError) {
          setSelectorError(fetchError instanceof Error ? fetchError.message : "Failed to load Onshape documents.");
          setDocuments([]);
        } finally {
          setLoadingDocuments(false);
        }
      })();
    }, 300);

    return () => clearTimeout(timeout);
  }, [documentQuery, manualOnshapeIds, mode, wizardOpen]);

  useEffect(() => {
    if (!wizardOpen || mode !== "ONSHAPE" || manualOnshapeIds) return;
    if (!documentId) {
      setWorkspaces([]);
      setWorkspaceId("");
      setElements([]);
      setElementId("");
      return;
    }

    void (async () => {
      setLoadingWorkspaces(true);
      setSelectorError(null);
      try {
        const response = await fetch(`/api/onshape/documents/${encodeURIComponent(documentId)}/workspaces`);
        const data = (await response.json().catch(() => null)) as
          | { error?: string; items?: OnshapeWorkspaceOption[] }
          | null;
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load Onshape workspaces.");
        }
        setWorkspaces(data?.items ?? []);
      } catch (fetchError) {
        setSelectorError(fetchError instanceof Error ? fetchError.message : "Failed to load Onshape workspaces.");
        setWorkspaces([]);
      } finally {
        setLoadingWorkspaces(false);
      }
    })();
  }, [documentId, manualOnshapeIds, mode, wizardOpen]);

  useEffect(() => {
    if (!wizardOpen || mode !== "ONSHAPE" || manualOnshapeIds) return;
    if (!documentId || !workspaceId) {
      setElements([]);
      setElementId("");
      return;
    }

    void (async () => {
      setLoadingElements(true);
      setSelectorError(null);
      try {
        const response = await fetch(
          `/api/onshape/documents/${encodeURIComponent(documentId)}/workspaces/${encodeURIComponent(workspaceId)}/elements`
        );
        const data = (await response.json().catch(() => null)) as
          | { error?: string; items?: OnshapeElementOption[] }
          | null;
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load Onshape elements.");
        }
        setElements(data?.items ?? []);
      } catch (fetchError) {
        setSelectorError(fetchError instanceof Error ? fetchError.message : "Failed to load Onshape elements.");
        setElements([]);
      } finally {
        setLoadingElements(false);
      }
    })();
  }, [documentId, manualOnshapeIds, mode, workspaceId, wizardOpen]);

  async function submitManual() {
    if (!activeProjectId) {
      setInfo("Select a project first.");
      return;
    }
    if (!name.trim()) {
      setInfo("Part name is required.");
      return;
    }
    if (!partNumberPreview) {
      setInfo("Complete Team/Year/Robot/Subsystem/Part fields.");
      return;
    }

    setManualBusy(true);
    setInfo(null);
    const response = await fetch("/api/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: activeProjectId,
        partNumber: partNumberPreview,
        name: name.trim(),
        description: description.trim() || null,
        quantityRequired: Number.parseInt(quantityRequired, 10) || 1,
        quantityComplete: Number.parseInt(quantityComplete, 10) || 0,
        priority: Number.parseInt(priority, 10) || 3,
        primaryOwnerId: machinistId || undefined,
        collaboratorIds: finisherId ? [finisherId] : []
      })
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setInfo(data?.error ?? "Unable to create part.");
      setManualBusy(false);
      return;
    }

    setManualBusy(false);
    setWizardOpen(false);
    setName("");
    setDescription("");
    setSubsystemNumber("");
    setPartSequence("");
    setMachinistId("");
    setFinisherId("");
    router.refresh();
  }

  async function previewCsv() {
    if (!activeProjectId) {
      setInfo("Select a project first.");
      return;
    }
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setInfo("Choose a CSV file first.");
      return;
    }
    setPreviewBusy(true);
    setInfo(null);
    const formData = new FormData();
    formData.set("projectId", activeProjectId);
    formData.set("file", file);
    formData.set("teamNumber", importTeamNumber);
    formData.set("seasonYear", importSeasonYear);
    formData.set("robotNumber", importRobotNumber);
    const response = await fetch("/api/imports/bom", { method: "POST", body: formData });
    const data = (await response.json().catch(() => null)) as
      | { error?: string; batchId?: string; rows?: PreviewRow[]; summary?: ImportSummary }
      | null;
    if (!response.ok || !data?.batchId) {
      setInfo(data?.error ?? "Preview failed.");
      setPreviewBusy(false);
      return;
    }
    setBatchId(data.batchId);
    setRows(data.rows ?? []);
    setSummary(data.summary ?? null);
    setPreviewBusy(false);
  }

  async function commitCsv() {
    if (!batchId) return;
    setCommitBusy(true);
    setInfo(null);
    const response = await fetch(`/api/imports/${batchId}/commit`, {
      method: "POST",
      headers: { "x-idempotency-key": generateUUID() }
    });
    const data = (await response.json().catch(() => null)) as { error?: string; summary?: string } | null;
    if (!response.ok) {
      setInfo(data?.error ?? "Commit failed.");
      setCommitBusy(false);
      return;
    }
    setCommitBusy(false);
    setWizardOpen(false);
    router.refresh();
  }

  async function previewOnshape() {
    if (!activeProjectId) {
      setInfo("Select a project first.");
      return;
    }
    if (!documentId.trim() || !workspaceId.trim() || !elementId.trim()) {
      setInfo("Select document, workspace, and assembly element first.");
      return;
    }

    setPreviewBusy(true);
    setInfo(null);
    const response = await fetch("/api/imports/bom/onshape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: activeProjectId,
        documentId,
        workspaceId,
        elementId,
        teamNumber: importTeamNumber,
        seasonYear: importSeasonYear,
        robotNumber: importRobotNumber
      })
    });
    const data = (await response.json().catch(() => null)) as
      | { error?: string; batchId?: string; rows?: PreviewRow[]; summary?: ImportSummary }
      | null;
    if (!response.ok || !data?.batchId) {
      setInfo(data?.error ?? "Onshape preview failed.");
      setPreviewBusy(false);
      return;
    }
    setBatchId(data.batchId);
    setRows(data.rows ?? []);
    setSummary(data.summary ?? null);
    setPreviewBusy(false);
  }

  return (
    <>
      <button onClick={openMenu} className={className}>
        <PlusSquare className="h-4 w-4" />
        <span>Add Part</span>
      </button>

      {menuPoint ? (
        <div
          className="fixed z-[70] w-[260px] border border-rim-soft bg-surface-hover text-ink-alt shadow-2xl"
          style={menuStyle}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={() => openWizard("MANUAL")} className="block w-full px-6 py-4 text-left hover:bg-surface-hover">
            Manual
          </button>
          <button
            onClick={() => openWizard("ONSHAPE")}
            className="block w-full px-6 py-4 text-left hover:bg-surface-hover"
          >
            Grab From Onshape
          </button>
          <button
            onClick={() => openWizard("IMPORT_CSV")}
            className="block w-full px-6 py-4 text-left hover:bg-surface-hover"
          >
            Import BOM CSV
          </button>
        </div>
      ) : null}

      {wizardOpen ? (
        <div className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:items-center sm:p-4">
          <div className="my-4 max-h-[92dvh] w-full max-w-[760px] overflow-hidden rounded-[6px] border border-rim-soft bg-surface-raised shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:my-0">
            <div className="flex items-center justify-between border-b border-rim-soft px-6 py-4">
              <div>
                <h2 className="text-2xl font-semibold text-ink-alt">
                  {mode === "MANUAL" ? "Manual Add" : mode === "IMPORT_CSV" ? "Import BOM CSV" : "Grab From Onshape"}
                </h2>
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                className="rounded-[3px] border border-rim-btn bg-surface-btn p-2 text-ink-alt hover:bg-surface-btn-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(92dvh-96px)] space-y-4 overflow-y-auto px-6 py-4 [overscroll-behavior:contain] [touch-action:pan-y]">
              {mode === "MANUAL" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-ink-label">Part Name</label>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-ink-label">Team #</label>
                    <select
                      value={teamNumber}
                      onChange={(event) => setTeamNumber(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                    >
                      {teamOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-ink-label">Year (25, 26...)</label>
                    <select
                      value={seasonYear}
                      onChange={(event) => setSeasonYear(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                    >
                      {yearOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-ink-label">Robot #</label>
                    <select
                      value={robotNumber}
                      onChange={(event) => setRobotNumber(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                    >
                      {(robotOptions.length ? robotOptions : [robotNumber || "1"]).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-ink-label">Subsystem #</label>
                    {subsystemOptions.length ? (
                      <select
                        value={subsystemNumber}
                        onChange={(event) => setSubsystemNumber(event.target.value)}
                        className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                      >
                        <option value="">Select subsystem</option>
                        {subsystemOptions.map((item) => (
                          <option key={item.subsystemNumber} value={item.subsystemNumber}>
                            {item.subsystemNumber}000{item.label ? ` - ${item.label}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={subsystemNumber}
                        onChange={(event) => setSubsystemNumber(event.target.value.replace(/\D/g, "").slice(0, 1))}
                        className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                        inputMode="numeric"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-ink-label">Part #</label>
                    <input
                      value={partSequence}
                      onChange={(event) => setPartSequence(event.target.value.replace(/\D/g, "").slice(0, 3))}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-ink-label">Generated Part ID</label>
                    <input
                      value={partNumberPreview}
                      readOnly
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-[#1b222d] px-3 text-ink-alt"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-ink-label">Priority</label>
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                    >
                      <option value="1">ASAP</option>
                      <option value="3">Normal</option>
                      <option value="5">Backburner</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-ink-label">Quantity Required</label>
                    <input
                      value={quantityRequired}
                      onChange={(event) => setQuantityRequired(event.target.value.replace(/\D/g, ""))}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-ink-label">Quantity Complete</label>
                    <input
                      value={quantityComplete}
                      onChange={(event) => setQuantityComplete(event.target.value.replace(/\D/g, ""))}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-ink-label">Material / Notes</label>
                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-ink-label">Machinist</label>
                    <select
                      value={machinistId}
                      onChange={(event) => setMachinistId(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-ink-label">Finisher</label>
                    <select
                      value={finisherId}
                      onChange={(event) => setFinisherId(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {mode === "IMPORT_CSV" ? (
                <div className="space-y-3">
                  <p className="text-xs text-ink-label">
                    CSV and Onshape API previews can differ if source fields differ or Team/Year/Robot filters exclude rows.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm text-ink-label">Team #</label>
                      <select
                        value={importTeamNumber}
                        onChange={(event) => setImportTeamNumber(event.target.value)}
                        className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                      >
                        {teamOptions.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-ink-label">Year</label>
                      <select
                        value={importSeasonYear}
                        onChange={(event) => setImportSeasonYear(event.target.value)}
                        className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                      >
                        {yearOptions.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-ink-label">Robot #</label>
                      <select
                        value={importRobotNumber}
                        onChange={(event) => setImportRobotNumber(event.target.value)}
                        className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                      >
                        {importRobotOptions.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-[4px] border border-rim-soft bg-surface-modal px-3 py-2 text-ink-alt hover:bg-surface-card"
                  >
                    <Upload className="h-4 w-4" />
                    Choose CSV
                  </button>
                  <p className="text-sm text-ink-label">{fileName ?? "No file selected."}</p>
                  {summary ? (
                    <p className="text-sm text-ink-label">
                      Rows: {summary.total}, Create: {summary.create}, Update: {summary.update}, No change:{" "}
                      {summary.noChange}, Errors: {summary.error}, Filtered out: {summary.filteredOut}. Active filter:{" "}
                      {formatActiveFilters(summary.filters, {
                        team: importTeamNumber,
                        year: importSeasonYear,
                        robot: importRobotNumber
                      })}
                    </p>
                  ) : null}
                  {rows.length ? (
                    <div className="max-h-48 overflow-y-auto rounded-[4px] border border-rim-soft bg-surface-modal p-2 text-xs text-ink-alt">
                      {rows.slice(0, 18).map((row) => (
                        <p key={row.rowIndex}>
                          #{row.rowIndex} {row.partNumber ?? "-"} {row.name ?? "-"} ({row.action})
                          {row.errorMessage ? ` - ${row.errorMessage}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mode === "ONSHAPE" ? (
                <div className="space-y-3">
                  <p className="text-xs text-ink-label">
                    Onshape API and CSV export previews may not match when payload shape differs or Team/Year/Robot filters drop rows.
                  </p>
                  <label className="flex items-center gap-2 text-sm text-ink-label">
                    <input
                      type="checkbox"
                      checked={manualOnshapeIds}
                      onChange={(event) => setManualOnshapeIds(event.target.checked)}
                    />
                    Enter IDs manually
                  </label>
                  {manualOnshapeIds ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm text-ink-label">Document ID</label>
                        <input
                          value={documentId}
                          onChange={(event) => setDocumentId(event.target.value)}
                          className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-ink-label">Workspace ID</label>
                        <input
                          value={workspaceId}
                          onChange={(event) => setWorkspaceId(event.target.value)}
                          className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-ink-label">Assembly Element ID</label>
                        <input
                          value={elementId}
                          onChange={(event) => setElementId(event.target.value)}
                          className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1 block text-sm text-ink-label">Search Documents</label>
                        <input
                          value={documentQuery}
                          onChange={(event) => setDocumentQuery(event.target.value)}
                          placeholder="Start typing a document name"
                          className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-sm text-ink-label">Document</label>
                          <select
                            value={documentId}
                            onChange={(event) => {
                              setDocumentId(event.target.value);
                              setWorkspaceId("");
                              setElementId("");
                              setWorkspaces([]);
                              setElements([]);
                            }}
                            className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                            disabled={loadingDocuments}
                          >
                            <option value="">{loadingDocuments ? "Loading documents..." : "Select document"}</option>
                            {documents.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm text-ink-label">Workspace</label>
                          <select
                            value={workspaceId}
                            onChange={(event) => {
                              setWorkspaceId(event.target.value);
                              setElementId("");
                              setElements([]);
                            }}
                            className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                            disabled={!documentId || loadingWorkspaces}
                          >
                            <option value="">
                              {!documentId ? "Pick document first" : loadingWorkspaces ? "Loading workspaces..." : "Select workspace"}
                            </option>
                            {workspaces.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm text-ink-label">Assembly Element</label>
                          <select
                            value={elementId}
                            onChange={(event) => setElementId(event.target.value)}
                            className="h-10 w-full rounded-[3px] border border-rim-soft bg-surface-modal px-3 text-ink-alt outline-none focus:border-rim-brand"
                            disabled={!workspaceId || loadingElements}
                          >
                            <option value="">
                              {!workspaceId ? "Pick workspace first" : loadingElements ? "Loading elements..." : "Select assembly element"}
                            </option>
                            {elements.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                  {selectorError ? (
                    <p className="rounded-[3px] border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm text-red-200">
                      {selectorError}
                    </p>
                  ) : null}
                  {!manualOnshapeIds && !loadingElements && workspaceId && !elements.length ? (
                    <p className="text-sm text-ink-label">No assembly elements found in this workspace.</p>
                  ) : null}
                  {summary ? (
                    <p className="text-sm text-ink-label">
                      Rows: {summary.total}, Create: {summary.create}, Update: {summary.update}, No change:{" "}
                      {summary.noChange}, Errors: {summary.error}, Filtered out: {summary.filteredOut}. Active filter:{" "}
                      {formatActiveFilters(summary.filters, {
                        team: importTeamNumber,
                        year: importSeasonYear,
                        robot: importRobotNumber
                      })}
                    </p>
                  ) : null}
                  {rows.length ? (
                    <div className="max-h-48 overflow-y-auto rounded-[4px] border border-rim-soft bg-surface-modal p-2 text-xs text-ink-alt">
                      {rows.slice(0, 18).map((row) => (
                        <p key={row.rowIndex}>
                          #{row.rowIndex} {row.partNumber ?? "-"} {row.name ?? "-"} ({row.action})
                          {row.errorMessage ? ` - ${row.errorMessage}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {info ? (
                <p className="rounded-[3px] border border-yellow-500/40 bg-yellow-500/15 px-3 py-2 text-sm text-yellow-100">
                  {info}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-rim-soft px-6 py-4">
              <button
                onClick={() => setWizardOpen(false)}
                className="rounded-[4px] border border-rim-btn bg-surface-btn px-4 py-2 text-ink-alt hover:bg-surface-btn-hover"
              >
                Cancel
              </button>
              {mode === "MANUAL" ? (
                <button
                  onClick={submitManual}
                  disabled={manualBusy}
                  className="rounded-[4px] border border-rim-brand-dark bg-brand-600 px-4 py-2 text-white hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {manualBusy ? "Creating..." : "Create Part"}
                </button>
              ) : null}
              {mode === "IMPORT_CSV" ? (
                <>
                  <button
                    onClick={previewCsv}
                    disabled={previewBusy}
                    className="rounded-[4px] border border-rim-soft bg-surface-modal px-4 py-2 text-ink-alt hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {previewBusy ? "Previewing..." : "Preview"}
                  </button>
                  <button
                    onClick={commitCsv}
                    disabled={!batchId || commitBusy}
                    className="rounded-[4px] border border-rim-brand-dark bg-brand-600 px-4 py-2 text-white hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {commitBusy ? "Committing..." : "Commit"}
                  </button>
                </>
              ) : null}
              {mode === "ONSHAPE" ? (
                <>
                  <button
                    onClick={previewOnshape}
                    disabled={previewBusy}
                    className="rounded-[4px] border border-rim-soft bg-surface-modal px-4 py-2 text-ink-alt hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {previewBusy ? "Previewing..." : "Preview"}
                  </button>
                  <button
                    onClick={commitCsv}
                    disabled={!batchId || commitBusy}
                    className="rounded-[4px] border border-rim-brand-dark bg-brand-600 px-4 py-2 text-white hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {commitBusy ? "Committing..." : "Commit"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
