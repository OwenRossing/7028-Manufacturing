"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

type ImportMode = "CSV" | "ONSHAPE_API";

type ProjectOption = {
  id: string;
  name: string;
};

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

export function ImportBomClient({
  projects,
  defaultProjectId
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
}) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ImportMode>("CSV");
  const [teamNumber, setTeamNumber] = useState("7028");
  const [seasonYear, setSeasonYear] = useState(String(new Date().getFullYear()));
  const [robotNumber, setRobotNumber] = useState("1");
  const [documentId, setDocumentId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [elementId, setElementId] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeFilters = {
    team: summary?.filters?.team ?? (teamNumber || "7028"),
    year: summary?.filters?.year ?? (seasonYear || String(new Date().getFullYear())),
    robot: summary?.filters?.robot ?? (robotNumber || "1")
  };

  async function previewImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const response =
      mode === "CSV"
        ? await (async () => {
            const formData = new FormData(event.currentTarget);
            formData.set("projectId", projectId);
            formData.set("teamNumber", teamNumber);
            formData.set("seasonYear", seasonYear);
            formData.set("robotNumber", robotNumber);
            return fetch("/api/imports/bom", {
              method: "POST",
              body: formData
            });
          })()
        : await fetch("/api/imports/bom/onshape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              documentId,
              workspaceId,
              elementId,
              teamNumber,
              seasonYear,
              robotNumber
            })
          });
    const data = (await response.json().catch(() => null)) as
      | { error?: string; batchId?: string; rows?: PreviewRow[]; summary?: ImportSummary }
      | null;

    if (!response.ok || !data?.batchId) {
      setError(data?.error ?? "Import preview failed.");
      setLoading(false);
      return;
    }
    setBatchId(data.batchId);
    setRows(data.rows ?? []);
    setSummary(data.summary ?? null);
    setMessage("Preview generated.");
    setLoading(false);
  }

  async function commitImport() {
    if (!batchId) return;
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/imports/${batchId}/commit`, {
      method: "POST",
      headers: { "x-idempotency-key": crypto.randomUUID() }
    });
    const data = (await response.json().catch(() => null)) as { error?: string; summary?: string } | null;
    if (!response.ok) {
      setError(data?.error ?? "Commit failed.");
      return;
    }
    setMessage(data?.summary ?? "Import committed.");
  }

  async function resyncFromOnshape() {
    setLoading(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/imports/onshape/resync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": crypto.randomUUID()
      },
      body: JSON.stringify({
        projectId,
        documentId,
        workspaceId,
        elementId,
        teamNumber,
        seasonYear,
        robotNumber,
        commit: true
      })
    });
    const data = (await response.json().catch(() => null)) as
      | { error?: string; batchId?: string; summary?: ImportSummary; commit?: { alreadyCommitted?: boolean; created?: number; updated?: number } }
      | null;
    if (!response.ok) {
      setError(data?.error ?? "Onshape re-sync failed.");
      setLoading(false);
      return;
    }
    if (data?.batchId) setBatchId(data.batchId);
    if (data?.summary) setSummary(data.summary);
    setMessage(
      data?.commit
        ? data.commit.alreadyCommitted
          ? "Re-sync request already applied for this idempotency key."
          : `Re-sync committed: ${data.commit.created ?? 0} created, ${data.commit.updated ?? 0} updated.`
        : "Re-sync preview generated."
    );
    setLoading(false);
  }

  return (
    <section className="space-y-4 p-4">
      <Card className="space-y-3">
        <h1 className="text-2xl font-bold text-white">Import Onshape BOM</h1>
        <p className="text-sm text-steel-300">Preview changes from CSV export or live Onshape API before commit.</p>
        <form className="space-y-3" onSubmit={previewImport}>
          <div>
            <label className="mb-1 block text-sm text-steel-300">Source</label>
            <Select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as ImportMode);
                setBatchId(null);
                setRows([]);
                setSummary(null);
              }}
            >
              <option value="CSV">CSV Onshape Export</option>
              <option value="ONSHAPE_API">Onshape API (Assembly BOM)</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-steel-300">Project</label>
            <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
          {mode === "CSV" ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                name="file"
                accept=".csv,text/csv"
                required
                className="hidden"
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Upload CSV File
                </Button>
                <span className="text-sm text-steel-300">{fileName ?? "No file selected yet."}</span>
              </div>
            </>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-steel-300">Document ID</label>
                <input
                  type="text"
                  value={documentId}
                  onChange={(event) => setDocumentId(event.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-steel-700 bg-steel-900 px-3 text-sm text-white outline-none ring-offset-steel-950 placeholder:text-steel-500 focus-visible:ring-2 focus-visible:ring-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-steel-300">Workspace ID</label>
                <input
                  type="text"
                  value={workspaceId}
                  onChange={(event) => setWorkspaceId(event.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-steel-700 bg-steel-900 px-3 text-sm text-white outline-none ring-offset-steel-950 placeholder:text-steel-500 focus-visible:ring-2 focus-visible:ring-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-steel-300">Element ID</label>
                <input
                  type="text"
                  value={elementId}
                  onChange={(event) => setElementId(event.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-steel-700 bg-steel-900 px-3 text-sm text-white outline-none ring-offset-steel-950 placeholder:text-steel-500 focus-visible:ring-2 focus-visible:ring-brand-500"
                />
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-steel-300">Team</label>
              <input
                type="text"
                name="teamNumber"
                inputMode="numeric"
                value={teamNumber}
                onChange={(event) => setTeamNumber(event.target.value)}
                className="h-10 w-full rounded-md border border-steel-700 bg-steel-900 px-3 text-sm text-white outline-none ring-offset-steel-950 placeholder:text-steel-500 focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-steel-300">Year</label>
              <input
                type="text"
                name="seasonYear"
                inputMode="numeric"
                value={seasonYear}
                onChange={(event) => setSeasonYear(event.target.value)}
                className="h-10 w-full rounded-md border border-steel-700 bg-steel-900 px-3 text-sm text-white outline-none ring-offset-steel-950 placeholder:text-steel-500 focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-steel-300">Robot</label>
              <input
                type="text"
                name="robotNumber"
                inputMode="numeric"
                value={robotNumber}
                onChange={(event) => setRobotNumber(event.target.value)}
                className="h-10 w-full rounded-md border border-steel-700 bg-steel-900 px-3 text-sm text-white outline-none ring-offset-steel-950 placeholder:text-steel-500 focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Parsing..." : mode === "CSV" ? "Preview CSV Import" : "Preview Onshape Import"}
          </Button>
        </form>
      </Card>

      {batchId ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Preview Rows</h2>
            <div className="flex items-center gap-2">
              {mode === "ONSHAPE_API" ? (
                <Button variant="secondary" disabled={loading} onClick={resyncFromOnshape}>
                  Re-sync from Onshape
                </Button>
              ) : null}
              <Button onClick={commitImport}>Commit Import</Button>
            </div>
          </div>
          {summary ? (
            <div className="space-y-1 text-sm text-steel-300">
              <p>
                Active filter: Team {activeFilters.team}, Year {activeFilters.year}, Robot{" "}
                {activeFilters.robot}.
              </p>
              <p>
                {summary.total} preview rows. Create: {summary.create}, Update: {summary.update}, No change:{" "}
                {summary.noChange}, Errors: {summary.error}, Filtered out by prefix: {summary.filteredOut}.
              </p>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Part #</th>
                  <th>Name</th>
                  <th>Qty</th>
                  <th>Action</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowIndex}>
                    <td>{row.rowIndex}</td>
                    <td>{row.partNumber ?? "-"}</td>
                    <td>{row.name ?? "-"}</td>
                    <td>{row.quantityNeeded ?? "-"}</td>
                    <td>{row.action}</td>
                    <td>{row.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {message ? <p className="text-sm text-green-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
