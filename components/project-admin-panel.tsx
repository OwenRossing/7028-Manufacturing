"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type ProjectPart = {
  id: string;
  name: string;
  partNumber: string;
  quantityRequired: number;
  quantityComplete: number;
};

type ProjectAdminItem = {
  id: string;
  name: string;
  season: string;
  partCount: number;
  parts: ProjectPart[];
};

export function ProjectAdminPanel({ projects }: { projects: ProjectAdminItem[] }) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [projectName, setProjectName] = useState("");
  const [projectSeason, setProjectSeason] = useState(String(new Date().getFullYear()));
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowFeedback, setRowFeedback] = useState<
    Record<string, { kind: "success" | "error"; text: string }>
  >({});
  const [partEdits, setPartEdits] = useState<Record<string, { name: string; quantityRequired: string; quantityComplete: string }>>({});

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  async function createProject() {
    if (!projectName.trim()) return;
    setBusy(true);
    setCreateMessage(null);
    setCreateError(null);
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName.trim(), season: projectSeason })
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setCreateError(data?.error ?? "Failed to create project.");
      setBusy(false);
      return;
    }
    setCreateMessage("Project created. Refresh to load it into project selector.");
    setProjectName("");
    setBusy(false);
  }

  function editForPart(part: ProjectPart) {
    return (
      partEdits[part.id] ?? {
        name: part.name,
        quantityRequired: String(part.quantityRequired),
        quantityComplete: String(part.quantityComplete)
      }
    );
  }

  async function savePart(part: ProjectPart) {
    const edit = editForPart(part);
    setBusy(true);
    setRowFeedback((prev) => {
      const next = { ...prev };
      delete next[part.id];
      return next;
    });
    const response = await fetch(`/api/parts/${part.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: edit.name.trim(),
        quantityRequired: Number.parseInt(edit.quantityRequired, 10) || 1,
        quantityComplete: Number.parseInt(edit.quantityComplete, 10) || 0
      })
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setRowFeedback((prev) => ({
        ...prev,
        [part.id]: { kind: "error", text: data?.error ?? "Failed to save part." }
      }));
      setBusy(false);
      return;
    }
    setRowFeedback((prev) => ({
      ...prev,
      [part.id]: { kind: "success", text: "Saved. Refresh list to confirm." }
    }));
    setBusy(false);
  }

  async function deletePart(partId: string) {
    setBusy(true);
    setRowFeedback((prev) => {
      const next = { ...prev };
      delete next[partId];
      return next;
    });
    const response = await fetch(`/api/parts/${partId}`, { method: "DELETE" });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setRowFeedback((prev) => ({
        ...prev,
        [partId]: { kind: "error", text: data?.error ?? "Failed to delete part." }
      }));
      setBusy(false);
      return;
    }
    setRowFeedback((prev) => ({
      ...prev,
      [partId]: { kind: "success", text: "Deleted. Refresh list to clear row." }
    }));
    setBusy(false);
  }

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Create Project</h2>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
          <Input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Project name"
          />
          <Input
            value={projectSeason}
            onChange={(event) => setProjectSeason(event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="2026"
            inputMode="numeric"
          />
          <Button onClick={createProject} disabled={busy || !projectName.trim() || projectSeason.length !== 4}>
            Create
          </Button>
        </div>
        {createMessage ? <p className="text-sm text-green-400">{createMessage}</p> : null}
        {createError ? <p className="text-sm text-red-400">{createError}</p> : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Projects</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} href={`/?projectId=${project.id}`} className="block">
              <div className="clickable-surface rounded-md bg-steel-850 p-3">
                <p className="font-medium text-white">{project.name}</p>
                <p className="text-sm text-steel-300">Season {project.season} | {project.partCount} parts</p>
                <p className="text-sm font-semibold text-steel-100">Open in Overview</p>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">Part Administration</h2>
          <div className="w-64">
            <Select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-sm text-steel-300">Quick edit names/quantities and remove parts. Destructive actions are immediate.</p>
        <div className="space-y-2">
          {selectedProject?.parts.length ? (
            selectedProject.parts.map((part) => {
              const edit = editForPart(part);
              const feedback = rowFeedback[part.id];
              return (
                <div key={part.id} className="clickable-surface grid gap-2 rounded-md bg-steel-850 p-3 md:grid-cols-[1.6fr_1fr_1fr_auto_auto_1.6fr]">
                  <Input
                    value={edit.name}
                    onChange={(event) =>
                      setPartEdits((prev) => ({
                        ...prev,
                        [part.id]: { ...edit, name: event.target.value }
                      }))
                    }
                  />
                  <Input
                    value={edit.quantityRequired}
                    inputMode="numeric"
                    onChange={(event) =>
                      setPartEdits((prev) => ({
                        ...prev,
                        [part.id]: { ...edit, quantityRequired: event.target.value.replace(/\D/g, "") }
                      }))
                    }
                  />
                  <Input
                    value={edit.quantityComplete}
                    inputMode="numeric"
                    onChange={(event) =>
                      setPartEdits((prev) => ({
                        ...prev,
                        [part.id]: { ...edit, quantityComplete: event.target.value.replace(/\D/g, "") }
                      }))
                    }
                  />
                  <Button variant="secondary" onClick={() => savePart(part)} disabled={busy}>
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => deletePart(part.id)} disabled={busy} title="Delete part">
                    <Trash2 className="h-4 w-4 text-red-300" />
                  </Button>
                  <div className="flex items-center">
                    {feedback ? (
                      <p className={`text-xs ${feedback.kind === "error" ? "text-red-400" : "text-green-400"}`}>
                        {feedback.text}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-xs text-steel-300 md:col-span-6">
                    {part.partNumber} | <Link href={`/parts/${part.id}`} className="text-brand-400 hover:text-brand-300">Open detail</Link>
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-steel-300">No parts found for selected project.</p>
          )}
        </div>
      </Card>

    </section>
  );
}
