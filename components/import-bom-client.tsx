"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function previewImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("projectId", projectId);

    const response = await fetch("/api/imports/bom", {
      method: "POST",
      body: formData
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

  return (
    <section className="space-y-4 p-4">
      <Card className="space-y-3">
        <h1 className="text-2xl font-bold text-white">Import Onshape BOM</h1>
        <p className="text-sm text-steel-300">Upload CSV export and preview changes before commit.</p>
        <form className="space-y-3" onSubmit={previewImport}>
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
          <input ref={fileInputRef} type="file" name="file" accept=".csv,text/csv" required className="hidden" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Upload CSV File
            </Button>
            <span className="text-sm text-steel-300">{fileName ?? "No file selected yet."}</span>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Parsing..." : "Preview Import"}
          </Button>
        </form>
      </Card>

      {batchId ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Preview Rows</h2>
            <Button onClick={commitImport}>Commit Import</Button>
          </div>
          {summary ? (
            <p className="text-sm text-steel-300">
              {summary.total} rows after filtering. Create: {summary.create}, Update: {summary.update}, No change:{" "}
              {summary.noChange}, Errors: {summary.error}, Filtered out: {summary.filteredOut}.
            </p>
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
