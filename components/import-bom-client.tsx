"use client";

import { useState } from "react";

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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      | { error?: string; batchId?: string; rows?: PreviewRow[] }
      | null;
    if (!response.ok || !data?.batchId) {
      setError(data?.error ?? "Import preview failed.");
      setLoading(false);
      return;
    }
    setBatchId(data.batchId);
    setRows(data.rows ?? []);
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
    <section className="stack">
      <form className="panel stack" onSubmit={previewImport}>
        <h1 style={{ margin: 0 }}>Import Onshape BOM</h1>
        <p className="muted" style={{ margin: 0 }}>
          Upload CSV export and preview creates/updates before commit.
        </p>
        <label className="stack">
          Project
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <input type="file" name="file" accept=".csv,text/csv" required />
        <button type="submit" disabled={loading}>
          {loading ? "Parsing..." : "Preview Import"}
        </button>
      </form>

      {batchId ? (
        <div className="panel stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Preview Rows</h3>
            <button onClick={commitImport}>Commit Import</button>
          </div>
          <table className="table">
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
      ) : null}

      {message ? <p style={{ color: "var(--success)", margin: 0 }}>{message}</p> : null}
      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
    </section>
  );
}
