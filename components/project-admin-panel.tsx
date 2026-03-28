"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { normalizeSeasonYear, sanitizeTeamNumber, TEAM_NUMBER_MAX_LENGTH } from "@/lib/part-number";

type ProjectPart = {
  id: string;
  name: string;
  partNumber: string;
  machinistId: string | null;
  collaboratorIds: string[];
  machinist: string;
  finisher: string;
};

type ProjectAdminItem = {
  id: string;
  name: string;
  season: string;
  partCount: number;
  parts: ProjectPart[];
};

type UserOption = {
  id: string;
  displayName: string;
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

export function ProjectAdminPanel({
  projects,
  config,
  users
}: {
  projects: ProjectAdminItem[];
  config: WorkspaceOptions;
  users: UserOption[];
}) {
  const [workspaceConfig, setWorkspaceConfig] = useState(config);
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [projectName, setProjectName] = useState("");
  const [projectSeason, setProjectSeason] = useState(String(new Date().getFullYear()).slice(-2));
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowFeedback, setRowFeedback] = useState<
    Record<string, { kind: "success" | "error"; text: string }>
  >({});
  const [partEdits, setPartEdits] = useState<
    Record<string, { name: string; machinistId: string; finisherId: string; collaboratorIds: string[] }>
  >({});
  const [teamNumber, setTeamNumber] = useState("");
  const [robotTeam, setRobotTeam] = useState(config.teamNumbers[0] ?? "");
  const [robotYear, setRobotYear] = useState(config.seasonYears[0] ?? String(new Date().getFullYear()).slice(-2));
  const [robotNumber, setRobotNumber] = useState("");
  const [subsystemTeam, setSubsystemTeam] = useState(config.teamNumbers[0] ?? "");
  const [subsystemYear, setSubsystemYear] = useState(config.seasonYears[0] ?? String(new Date().getFullYear()).slice(-2));
  const [subsystemRobot, setSubsystemRobot] = useState("");
  const [subsystemNumber, setSubsystemNumber] = useState("");
  const [subsystemLabel, setSubsystemLabel] = useState("");
  const [configMessage, setConfigMessage] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const robotChoices = useMemo(
    () =>
      workspaceConfig.robotNumbers
        .filter((item) => item.teamNumber === subsystemTeam && item.seasonYear === subsystemYear)
        .map((item) => item.robotNumber),
    [workspaceConfig.robotNumbers, subsystemTeam, subsystemYear]
  );

  async function createProject() {
    if (!projectName.trim()) return;
    setBusy(true);
    setCreateMessage(null);
    setCreateError(null);
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName.trim(), season: normalizeSeasonYear(projectSeason) })
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setCreateError(data?.error ?? "Failed to create project.");
      setBusy(false);
      return;
    }
    setCreateMessage("Project created.");
    setProjectName("");
    setBusy(false);
  }

  async function deleteProject(projectId: string) {
    if (!confirm("Delete this project and all its parts? This cannot be undone.")) return;
    setBusy(true);
    const response = await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: projectId })
    });
    setBusy(false);
    if (!response.ok) {
      alert("Failed to delete project.");
      return;
    }
    alert("Project deleted. Refresh page to see changes.");
  }

  function editForPart(part: ProjectPart) {
    return partEdits[part.id] ?? {
      name: part.name,
      machinistId: part.machinistId ?? "",
      finisherId: part.collaboratorIds[0] ?? "",
      collaboratorIds: [...part.collaboratorIds]
    };
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
        name: edit.name.trim()
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

    const primaryOwnerId = edit.machinistId || null;
    const collaboratorIds = edit.collaboratorIds.filter((id, index, array) => array.indexOf(id) === index);
    const ownersResponse = await fetch(`/api/parts/${part.id}/owners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryOwnerId,
        collaboratorIds
      })
    });
    const ownersData = (await ownersResponse.json().catch(() => null)) as { error?: string } | null;
    if (!ownersResponse.ok) {
      setRowFeedback((prev) => ({
        ...prev,
        [part.id]: { kind: "error", text: ownersData?.error ?? "Failed to save owners." }
      }));
      setBusy(false);
      return;
    }

    setRowFeedback((prev) => ({
      ...prev,
      [part.id]: { kind: "success", text: "Saved." }
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

  async function addConfig(payload: Record<string, string>) {
    setBusy(true);
    setConfigMessage(null);
    const response = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = (await response.json().catch(() => null)) as (WorkspaceOptions & { error?: string }) | null;
    if (!response.ok) {
      setConfigMessage(data?.error ?? "Unable to save config.");
      setBusy(false);
      return;
    }
    if (data) {
      setWorkspaceConfig(data);
      const nextTeam = data.teamNumbers[0] ?? "";
      const nextYear = data.seasonYears[0] ?? String(new Date().getFullYear()).slice(-2);
      setRobotTeam((prev) => prev || nextTeam);
      setSubsystemTeam((prev) => prev || nextTeam);
      setRobotYear((prev) => prev || nextYear);
      setSubsystemYear((prev) => prev || nextYear);
    }
    setConfigMessage("Saved.");
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
            onChange={(event) => setProjectSeason(normalizeSeasonYear(event.target.value))}
            placeholder="26"
            inputMode="numeric"
          />
          <Button onClick={createProject} disabled={busy || !projectName.trim() || projectSeason.length !== 2}>
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
            <div key={project.id} className="space-y-1">
              <Link href={`/?projectId=${project.id}`} className="block">
                <div className="clickable-surface rounded-md bg-steel-850 p-3">
                  <p className="font-medium text-white">{project.name}</p>
                  <p className="text-sm text-steel-300">Season {project.season} | {project.partCount} parts</p>
                  <p className="text-sm font-semibold text-steel-100">Open in Overview</p>
                </div>
              </Link>
              <Button
                variant="ghost"
                onClick={() => deleteProject(project.id)}
                disabled={busy}
                className="h-8 w-full"
              >
                <Trash2 className="mr-1 h-4 w-4 text-red-300" />
                Delete Project
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Part Number Configuration</h2>
        <div className="grid gap-4 md:grid-cols-3">

          {/* Team Numbers */}
          <div className="flex flex-col gap-3 rounded-md border border-steel-700 bg-steel-850 p-3">
            <p className="text-sm font-semibold text-white">Teams</p>
            <div className="flex min-h-[2rem] flex-wrap gap-1">
              {workspaceConfig.teamNumbers.length ? workspaceConfig.teamNumbers.map((team) => (
                <span key={team} className="rounded bg-steel-700 px-2 py-0.5 text-xs text-steel-100">{team}</span>
              )) : <span className="text-xs text-steel-400">None added yet</span>}
            </div>
            <div className="mt-auto flex gap-2">
              <Input
                value={teamNumber}
                onChange={(event) => setTeamNumber(sanitizeTeamNumber(event.target.value))}
                maxLength={TEAM_NUMBER_MAX_LENGTH}
                placeholder="7028"
              />
              <Button disabled={busy || !teamNumber} onClick={() => { void addConfig({ kind: "TEAM", teamNumber }); setTeamNumber(""); }}>
                Add
              </Button>
            </div>
          </div>

          {/* Robot Numbers */}
          <div className="flex flex-col gap-3 rounded-md border border-steel-700 bg-steel-850 p-3">
            <p className="text-sm font-semibold text-white">Robots</p>
            <div className="flex min-h-[2rem] flex-wrap gap-1">
              {workspaceConfig.robotNumbers.length ? workspaceConfig.robotNumbers.map((item) => (
                <span key={`${item.teamNumber}-${item.seasonYear}-${item.robotNumber}`} className="rounded bg-steel-700 px-2 py-0.5 text-xs text-steel-100">
                  {item.teamNumber}-{item.seasonYear}-{item.robotNumber}
                </span>
              )) : <span className="text-xs text-steel-400">None added yet</span>}
            </div>
            <div className="mt-auto space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Select value={robotTeam} onChange={(event) => setRobotTeam(event.target.value)}>
                  <option value="">Team</option>
                  {workspaceConfig.teamNumbers.map((team) => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </Select>
                <Input
                  value={robotYear}
                  onChange={(event) => setRobotYear(normalizeSeasonYear(event.target.value))}
                  placeholder="26"
                  inputMode="numeric"
                  maxLength={2}
                />
                <Input
                  value={robotNumber}
                  onChange={(event) => setRobotNumber(event.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="Robot #"
                  inputMode="numeric"
                />
              </div>
              <Button
                className="w-full"
                disabled={busy || !robotTeam || robotYear.length !== 2 || !robotNumber}
                onClick={() => { void addConfig({ kind: "ROBOT", teamNumber: robotTeam, seasonYear: robotYear, robotNumber }); setRobotNumber(""); }}
              >
                Add Robot
              </Button>
            </div>
          </div>

          {/* Subsystems */}
          <div className="flex flex-col gap-3 rounded-md border border-steel-700 bg-steel-850 p-3">
            <p className="text-sm font-semibold text-white">Subsystems</p>
            <div className="flex min-h-[2rem] flex-wrap gap-1">
              {workspaceConfig.subsystems.length ? workspaceConfig.subsystems.map((item) => (
                <span key={`${item.teamNumber}-${item.seasonYear}-${item.robotNumber}-${item.subsystemNumber}`} className="rounded bg-steel-700 px-2 py-0.5 text-xs text-steel-100">
                  {item.subsystemNumber}000{item.label ? ` ${item.label}` : ""}
                </span>
              )) : <span className="text-xs text-steel-400">None added yet</span>}
            </div>
            <div className="mt-auto space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Select value={subsystemTeam} onChange={(event) => setSubsystemTeam(event.target.value)}>
                  <option value="">Team</option>
                  {workspaceConfig.teamNumbers.map((team) => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </Select>
                <Input
                  value={subsystemYear}
                  onChange={(event) => setSubsystemYear(normalizeSeasonYear(event.target.value))}
                  placeholder="26"
                  inputMode="numeric"
                  maxLength={2}
                />
                <Select value={subsystemRobot} onChange={(event) => setSubsystemRobot(event.target.value)}>
                  <option value="">Robot</option>
                  {robotChoices.map((robot) => (
                    <option key={robot} value={robot}>{robot}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={subsystemNumber} onChange={(event) => setSubsystemNumber(event.target.value)}>
                  <option value="">Subsystem</option>
                  {Array.from({ length: 10 }, (_, index) => String(index)).map((value) => (
                    <option key={value} value={value}>{value}000</option>
                  ))}
                </Select>
                <Input value={subsystemLabel} onChange={(event) => setSubsystemLabel(event.target.value)} placeholder="Label" />
              </div>
              <Button
                className="w-full"
                disabled={busy || !subsystemTeam || subsystemYear.length !== 2 || !subsystemRobot || !subsystemNumber}
                onClick={() => {
                  void addConfig({ kind: "SUBSYSTEM", teamNumber: subsystemTeam, seasonYear: subsystemYear, robotNumber: subsystemRobot, subsystemNumber, label: subsystemLabel });
                  setSubsystemNumber("");
                  setSubsystemLabel("");
                }}
              >
                Add Subsystem
              </Button>
            </div>
          </div>
        </div>
        {configMessage ? <p className="text-sm text-steel-200">{configMessage}</p> : null}
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
        <p className="text-sm text-steel-300">
          Quick edit part names and ownership directly in the list.
        </p>
        <div className="hidden text-xs text-steel-300 md:grid md:grid-cols-[1.6fr_1fr_1fr_auto_auto_1.6fr]">
          <span>Name</span>
          <span>Machinist</span>
          <span>Finisher</span>
          <span>Save Changes</span>
          <span>Delete Part</span>
          <span>Result</span>
        </div>
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
                  <Select
                    value={edit.machinistId}
                    onChange={(event) => {
                      const nextMachinistId = event.target.value;
                      setPartEdits((prev) => {
                        const next = {
                          ...edit,
                          machinistId: nextMachinistId
                        };
                        if (next.finisherId && next.finisherId === nextMachinistId) {
                          next.collaboratorIds = [nextMachinistId, ...next.collaboratorIds];
                        }
                        return {
                          ...prev,
                          [part.id]: next
                        };
                      });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={edit.finisherId}
                    onChange={(event) => {
                      const nextFinisherId = event.target.value;
                      setPartEdits((prev) => ({
                        ...prev,
                        [part.id]: {
                          ...edit,
                          finisherId: nextFinisherId,
                          collaboratorIds: nextFinisherId
                            ? [nextFinisherId, ...edit.collaboratorIds.filter((id) => id !== nextFinisherId)]
                            : []
                        }
                      }));
                    }}
                  >
                    <option value="">Unassigned</option>
                    {users
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.displayName}
                        </option>
                      ))}
                  </Select>
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
                    {part.partNumber} | <Link href={`/parts/${part.id}`} className="text-accent-400 hover:text-accent-500">Open detail</Link>
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
