"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusSquare, Upload, X } from "lucide-react";

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

type UserOption = { id: string; displayName: string; email: string };

function normalizeYear(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

function buildPartCode(subsystem: string, part: string): string {
  const subsystemDigits = subsystem.replace(/\D/g, "").slice(0, 2);
  const partDigits = part.replace(/\D/g, "").slice(0, 3);
  if (!subsystemDigits || !partDigits) return "";
  const combined = `${subsystemDigits}${partDigits}`.slice(0, 4);
  return combined.padStart(4, "0");
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
    const team = teamNumber.replace(/\D/g, "").slice(0, 4);
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
    setWizardOpen(true);
    setMenuPoint(null);
  }

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
      headers: { "x-idempotency-key": crypto.randomUUID() }
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

  return (
    <>
      <button onClick={openMenu} className={className}>
        <PlusSquare className="h-4 w-4" />
        <span>Add Part</span>
      </button>

      {menuPoint ? (
        <div
          className="fixed z-[70] w-[260px] border border-[#4a5160] bg-[#3d4450] text-[#dcdedf] shadow-2xl"
          style={menuStyle}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={() => openWizard("MANUAL")} className="block w-full px-6 py-4 text-left hover:bg-[#4a5160]">
            Manual
          </button>
          <button onClick={() => openWizard("ONSHAPE")} className="block w-full px-6 py-4 text-left hover:bg-[#4a5160]">
            Grab From Onshape
          </button>
          <button onClick={() => openWizard("IMPORT_CSV")} className="block w-full px-6 py-4 text-left hover:bg-[#4a5160]">
            Import BOM CSV
          </button>
        </div>
      ) : null}

      {wizardOpen ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[92dvh] w-full max-w-[760px] overflow-hidden rounded-[6px] border border-[#3f4a5b] bg-[#2b313d] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between border-b border-[#3f4a5b] px-6 py-4">
              <div>
                <h2 className="text-2xl font-semibold text-[#dcdedf]">
                  {mode === "MANUAL" ? "Manual Add" : mode === "IMPORT_CSV" ? "Import BOM CSV" : "Grab From Onshape"}
                </h2>
                <p className="text-sm text-[#9aa8b8]">
                  {mode === "MANUAL"
                    ? "Set fields and create the part."
                    : mode === "IMPORT_CSV"
                    ? "Upload CSV, preview changes, then commit."
                    : "Direct Onshape API import (coming next)."}
                </p>
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                className="rounded-[3px] border border-[#4b5668] bg-[#364052] p-2 text-[#dcdedf] hover:bg-[#445065]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(92dvh-148px)] space-y-4 overflow-y-auto px-6 py-4">
              {mode === "MANUAL" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Part Name</label>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Team #</label>
                    {config?.teamNumbers?.length ? (
                      <select
                        value={teamNumber}
                        onChange={(event) => setTeamNumber(event.target.value)}
                        className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                      >
                        {config.teamNumbers.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={teamNumber}
                        onChange={(event) => setTeamNumber(event.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                        inputMode="numeric"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Year (25, 26...)</label>
                    {config?.seasonYears?.length ? (
                      <select
                        value={seasonYear}
                        onChange={(event) => setSeasonYear(event.target.value)}
                        className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                      >
                        {config.seasonYears.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={seasonYear}
                        onChange={(event) => setSeasonYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                        inputMode="numeric"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Robot #</label>
                    {robotOptions.length ? (
                      <select
                        value={robotNumber}
                        onChange={(event) => setRobotNumber(event.target.value)}
                        className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                      >
                        {robotOptions.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={robotNumber}
                        onChange={(event) => setRobotNumber(event.target.value.replace(/\D/g, "").slice(0, 2))}
                        className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                        inputMode="numeric"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Subsystem #</label>
                    {subsystemOptions.length ? (
                      <select
                        value={subsystemNumber}
                        onChange={(event) => setSubsystemNumber(event.target.value)}
                        className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                      >
                        <option value="">Select subsystem</option>
                        {subsystemOptions.map((item) => (
                          <option key={item.subsystemNumber} value={item.subsystemNumber}>
                            {item.subsystemNumber}{item.label ? ` - ${item.label}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={subsystemNumber}
                        onChange={(event) => setSubsystemNumber(event.target.value.replace(/\D/g, "").slice(0, 2))}
                        className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                        inputMode="numeric"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Part #</label>
                    <input
                      value={partSequence}
                      onChange={(event) => setPartSequence(event.target.value.replace(/\D/g, "").slice(0, 3))}
                      className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Generated Part ID</label>
                    <input
                      value={partNumberPreview}
                      readOnly
                      className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#1b222d] px-3 text-[#dcdedf]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Priority</label>
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                    >
                      <option value="1">ASAP</option>
                      <option value="3">Normal</option>
                      <option value="5">Backburner</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Quantity Required</label>
                    <input
                      value={quantityRequired}
                      onChange={(event) => setQuantityRequired(event.target.value.replace(/\D/g, ""))}
                      className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Quantity Complete</label>
                    <input
                      value={quantityComplete}
                      onChange={(event) => setQuantityComplete(event.target.value.replace(/\D/g, ""))}
                      className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Material / Notes</label>
                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Machinist</label>
                    <select
                      value={machinistId}
                      onChange={(event) => setMachinistId(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#9aa8b8]">Finisher</label>
                    <select
                      value={finisherId}
                      onChange={(event) => setFinisherId(event.target.value)}
                      className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                    >
                      <option value="">Unassigned</option>
                      {users.filter((user) => user.id !== machinistId).map((user) => (
                        <option key={user.id} value={user.id}>{user.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {mode === "IMPORT_CSV" ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm text-[#9aa8b8]">Team #</label>
                      {config?.teamNumbers?.length ? (
                        <select
                          value={importTeamNumber}
                          onChange={(event) => setImportTeamNumber(event.target.value)}
                          className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                        >
                          {config.teamNumbers.map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={importTeamNumber}
                          onChange={(event) => setImportTeamNumber(event.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                          inputMode="numeric"
                        />
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-[#9aa8b8]">Year</label>
                      {config?.seasonYears?.length ? (
                        <select
                          value={importSeasonYear}
                          onChange={(event) => setImportSeasonYear(event.target.value)}
                          className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                        >
                          {config.seasonYears.map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={importSeasonYear}
                          onChange={(event) => setImportSeasonYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                          inputMode="numeric"
                        />
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-[#9aa8b8]">Robot #</label>
                      {config?.robotNumbers?.length ? (
                        <select
                          value={importRobotNumber}
                          onChange={(event) => setImportRobotNumber(event.target.value)}
                          className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                        >
                          {config.robotNumbers
                            .filter((item) => item.teamNumber === importTeamNumber && item.seasonYear === normalizeYear(importSeasonYear))
                            .map((item) => (
                              <option key={`${item.teamNumber}-${item.seasonYear}-${item.robotNumber}`} value={item.robotNumber}>
                                {item.robotNumber}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <input
                          value={importRobotNumber}
                          onChange={(event) => setImportRobotNumber(event.target.value.replace(/\D/g, "").slice(0, 2))}
                          className="h-10 w-full rounded-[3px] border border-[#3f4a5b] bg-[#202833] px-3 text-[#dcdedf] outline-none focus:border-[#1a9fff]"
                          inputMode="numeric"
                        />
                      )}
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
                    className="inline-flex items-center gap-2 rounded-[4px] border border-[#3f4a5b] bg-[#202833] px-3 py-2 text-[#dcdedf] hover:bg-[#273140]"
                  >
                    <Upload className="h-4 w-4" />
                    Choose CSV
                  </button>
                  <p className="text-sm text-[#9aa8b8]">{fileName ?? "No file selected."}</p>
                  {summary ? (
                    <p className="text-sm text-[#9aa8b8]">
                      Rows: {summary.total}, Create: {summary.create}, Update: {summary.update}, No change:{" "}
                      {summary.noChange}, Errors: {summary.error}
                    </p>
                  ) : null}
                  {rows.length ? (
                    <div className="max-h-48 overflow-y-auto rounded-[4px] border border-[#3f4a5b] bg-[#202833] p-2 text-xs text-[#dcdedf]">
                      {rows.slice(0, 18).map((row) => (
                        <p key={row.rowIndex}>
                          #{row.rowIndex} {row.partNumber ?? "-"} {row.name ?? "-"} ({row.action})
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mode === "ONSHAPE" ? (
                <p className="rounded-[3px] border border-yellow-500/40 bg-yellow-500/15 px-3 py-2 text-sm text-yellow-100">
                  Onshape API import is not wired yet. Use Import BOM CSV in this modal for now.
                </p>
              ) : null}

              {info ? (
                <p className="rounded-[3px] border border-yellow-500/40 bg-yellow-500/15 px-3 py-2 text-sm text-yellow-100">
                  {info}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#3f4a5b] px-6 py-4">
              <button
                onClick={() => setWizardOpen(false)}
                className="rounded-[4px] border border-[#4b5668] bg-[#364052] px-4 py-2 text-[#dcdedf] hover:bg-[#445065]"
              >
                Cancel
              </button>
              {mode === "MANUAL" ? (
                <button
                  onClick={submitManual}
                  disabled={manualBusy}
                  className="rounded-[4px] border border-[#2f6eb6] bg-[#1a9fff] px-4 py-2 text-white hover:bg-[#3aaeff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {manualBusy ? "Creating..." : "Create Part"}
                </button>
              ) : null}
              {mode === "IMPORT_CSV" ? (
                <>
                  <button
                    onClick={previewCsv}
                    disabled={previewBusy}
                    className="rounded-[4px] border border-[#3f4a5b] bg-[#202833] px-4 py-2 text-[#dcdedf] hover:bg-[#273140] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {previewBusy ? "Previewing..." : "Preview"}
                  </button>
                  <button
                    onClick={commitCsv}
                    disabled={!batchId || commitBusy}
                    className="rounded-[4px] border border-[#2f6eb6] bg-[#1a9fff] px-4 py-2 text-white hover:bg-[#3aaeff] disabled:cursor-not-allowed disabled:opacity-60"
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
