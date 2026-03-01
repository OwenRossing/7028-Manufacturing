"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { queryKeys } from "@/lib/query-keys";
import {
  buildPartNumber,
  defaultSeasonYear,
  defaultTeamNumber,
  isValidPartNumber,
  normalizeSeasonYear,
  partNumberHint,
  sanitizeTeamNumber,
  TEAM_NUMBER_MAX_LENGTH
} from "@/lib/part-number";

type ProjectOption = {
  id: string;
  name: string;
};

type UserOption = {
  id: string;
  displayName: string;
};
type WorkspaceOptions = {
  teamNumbers: string[];
  seasonYears: string[];
  robotNumbers: Array<{ teamNumber: string; seasonYear: string; robotNumber: string }>;
};

type WizardState = {
  projectId: string;
  partNumberTeam: string;
  partNumberYear: string;
  partNumberRobot: string;
  partNumberCode: string;
  name: string;
  description: string;
  quantityRequired: string;
  quantityComplete: string;
  priority: number;
  primaryOwnerId: string;
  collaboratorIds: string[];
};

export function AddPartWizard({
  projects,
  users
}: {
  projects: ProjectOption[];
  users: UserOption[];
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "manual">("choose");
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<WorkspaceOptions | null>(null);
  const [state, setState] = useState<WizardState>({
    projectId: projects[0]?.id ?? "",
    partNumberTeam: defaultTeamNumber(),
    partNumberYear: defaultSeasonYear(),
    partNumberRobot: "1",
    partNumberCode: "",
    name: "",
    description: "",
    quantityRequired: "1",
    quantityComplete: "0",
    priority: 2,
    primaryOwnerId: "",
    collaboratorIds: []
  });

  const partNumber = useMemo(
    () =>
      buildPartNumber({
        team: state.partNumberTeam,
        year: state.partNumberYear,
        robot: state.partNumberRobot,
        partCode: state.partNumberCode
      }),
    [state.partNumberCode, state.partNumberRobot, state.partNumberTeam, state.partNumberYear]
  );
  const robotOptions = useMemo(
    () =>
      config?.robotNumbers?.filter(
        (item) => item.teamNumber === state.partNumberTeam && item.seasonYear === state.partNumberYear
      ) ?? [],
    [config?.robotNumbers, state.partNumberTeam, state.partNumberYear]
  );

  useEffect(() => {
    void fetch("/api/config/options")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load config.");
        return (await response.json()) as WorkspaceOptions;
      })
      .then((data) => setConfig(data))
      .catch(() => setConfig(null));
  }, []);

  const createPartMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...state,
          quantityRequired: Number.parseInt(state.quantityRequired, 10) || 1,
          quantityComplete: Number.parseInt(state.quantityComplete, 10) || 0,
          partNumber,
          primaryOwnerId: state.primaryOwnerId || undefined
        })
      });
      const data = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create part.");
      }
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.parts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics.all });
      if (data?.id) {
        router.push(`/parts/${data.id}`);
      } else {
        router.push("/");
      }
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
    }
  });

  function next() {
    setError(null);
    if (mode !== "manual") return;
    if (step === 1) {
      if (!state.projectId || !state.name.trim() || !isValidPartNumber(partNumber)) {
        setError(`Complete required fields. ${partNumberHint()}`);
        return;
      }
    }
    if (step === 2) {
      const quantityRequired = Number.parseInt(state.quantityRequired, 10);
      const quantityComplete = Number.parseInt(state.quantityComplete, 10);
      if (Number.isNaN(quantityRequired) || quantityRequired < 1 || Number.isNaN(quantityComplete) || quantityComplete < 0) {
        setError("Set valid quantities before continuing.");
        return;
      }
    }
    if (step < 3) {
      setStep((prev) => prev + 1);
    }
  }

  function back() {
    setError(null);
    if (mode === "manual" && step === 1) {
      setMode("choose");
      return;
    }
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  }

  return (
    <section className="space-y-4 p-4">
      <Card className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Add Part Wizard</h1>
        <p className="text-sm text-steel-300">Start with BOM upload or continue with manual part entry.</p>
        {mode === "manual" ? (
          <div className="flex gap-2 text-xs">
            {[1, 2, 3].map((value) => (
              <span
                key={value}
                className={`rounded-full px-2 py-1 ${value === step ? "bg-accent-500 text-black" : "bg-steel-800 text-steel-300"}`}
              >
                Step {value}
              </span>
            ))}
          </div>
        ) : null}
      </Card>

      {mode === "choose" ? (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Do you already have a BOM to upload?</h2>
          {!projects.length ? (
            <p className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
              Create a project first in Settings before adding or importing parts.
            </p>
          ) : null}
          <div>
            <label className="mb-1 block text-sm text-steel-300">Project</label>
            <Select
              value={state.projectId}
              onChange={(event) => setState((prev) => ({ ...prev, projectId: event.target.value }))}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              className="clickable-surface rounded-md bg-steel-850 p-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => router.push(`/import?projectId=${state.projectId}`)}
              disabled={!state.projectId}
            >
              <p className="text-base font-semibold text-white">Yes, upload BOM</p>
              <p className="text-sm text-steel-300">Best for importing many parts quickly.</p>
            </button>
            <button
              type="button"
              className="clickable-surface rounded-md bg-steel-850 p-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                setMode("manual");
                setStep(1);
              }}
              disabled={!state.projectId}
            >
              <p className="text-base font-semibold text-white">No, add manually</p>
              <p className="text-sm text-steel-300">Use guided 3-step wizard for one-off parts.</p>
            </button>
          </div>
        </Card>
      ) : null}

      {mode === "manual" && step === 1 ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Identity</h2>
          <label className="block text-sm text-steel-300">Project</label>
          <Select
            value={state.projectId}
            onChange={(event) => setState((prev) => ({ ...prev, projectId: event.target.value }))}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          <label className="block text-sm text-steel-300">Part number</label>
          <div className="grid gap-2 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-steel-300">Team</label>
              {config?.teamNumbers?.length ? (
                <Select
                  value={state.partNumberTeam}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      partNumberTeam: event.target.value
                    }))
                  }
                >
                  {config.teamNumbers.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={state.partNumberTeam}
                  inputMode="numeric"
                  maxLength={TEAM_NUMBER_MAX_LENGTH}
                  placeholder="7028"
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      partNumberTeam: sanitizeTeamNumber(event.target.value)
                    }))
                  }
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-steel-300">Year</label>
              {config?.seasonYears?.length ? (
                <Select
                  value={state.partNumberYear}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      partNumberYear: event.target.value
                    }))
                  }
                >
                  {config.seasonYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={state.partNumberYear}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder={defaultSeasonYear()}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      partNumberYear: normalizeSeasonYear(event.target.value)
                    }))
                  }
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-steel-300">Robot #</label>
              {robotOptions.length ? (
                <Select
                  value={state.partNumberRobot}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      partNumberRobot: event.target.value
                    }))
                  }
                >
                  {robotOptions.map((item) => (
                    <option key={`${item.teamNumber}-${item.seasonYear}-${item.robotNumber}`} value={item.robotNumber}>
                      {item.robotNumber}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={state.partNumberRobot}
                  inputMode="numeric"
                  placeholder="1"
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      partNumberRobot: event.target.value.replace(/\D/g, "")
                    }))
                  }
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-steel-300">Part Code</label>
              <Input
                value={state.partNumberCode}
                inputMode="numeric"
                maxLength={4}
                placeholder="1001"
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    partNumberCode: event.target.value.replace(/\D/g, "").slice(0, 4)
                  }))
                }
              />
            </div>
          </div>
          <p className="text-xs text-steel-300">{partNumberHint()}</p>
          <p className="text-xs text-steel-300">
            Auto-built: <span className="font-semibold text-white">{partNumber}</span>
          </p>
          <label className="block text-sm text-steel-300">Part name</label>
          <Input
            value={state.name}
            placeholder="Shooter side plate"
            onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
          />
        </Card>
      ) : null}

      {mode === "manual" && step === 2 ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Manufacturing Settings</h2>
          <label className="block text-sm text-steel-300">Description</label>
          <Input
            value={state.description}
            onChange={(event) => setState((prev) => ({ ...prev, description: event.target.value }))}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm text-steel-300">Quantity required</label>
              <Input
                type="text"
                inputMode="numeric"
                value={state.quantityRequired}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    quantityRequired: event.target.value.replace(/\D/g, "")
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm text-steel-300">Quantity complete</label>
              <Input
                type="text"
                inputMode="numeric"
                value={state.quantityComplete}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    quantityComplete: event.target.value.replace(/\D/g, "")
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm text-steel-300">Priority</label>
              <Select
                value={String(state.priority)}
                onChange={(event) => setState((prev) => ({ ...prev, priority: Number(event.target.value) }))}
              >
                <option value="1">1 - High</option>
                <option value="2">2 - Medium</option>
                <option value="3">3 - Standard</option>
                <option value="4">4 - Low</option>
                <option value="5">5 - Backlog</option>
              </Select>
            </div>
          </div>
        </Card>
      ) : null}

      {mode === "manual" && step === 3 ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Roles & Review</h2>
          <label className="block text-sm text-steel-300">Machinist</label>
          <Select
            value={state.primaryOwnerId}
            onChange={(event) => setState((prev) => ({ ...prev, primaryOwnerId: event.target.value }))}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </Select>
          <label className="block text-sm text-steel-300">Finishers (optional)</label>
          <div className="space-y-2 rounded-md border border-steel-700 bg-steel-850 p-3">
            <p className="text-xs text-steel-300">
              Pick everyone helping on this part.
            </p>
            <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
              {users
                .map((user) => {
                  const checked = state.collaboratorIds.includes(user.id);
                  return (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center justify-between rounded-md border border-steel-700 px-3 py-2 text-sm text-white hover:bg-steel-800"
                    >
                      <span>{user.displayName}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setState((prev) => ({
                            ...prev,
                            collaboratorIds: checked
                              ? prev.collaboratorIds.filter((id) => id !== user.id)
                              : [...prev.collaboratorIds, user.id]
                          }))
                        }
                      />
                    </label>
                  );
                })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.collaboratorIds.length ? (
              users
                .filter((user) => state.collaboratorIds.includes(user.id))
                .map((user) => (
                  <span key={user.id} className="rounded-full border border-steel-700 bg-steel-800 px-2 py-1 text-xs text-steel-200">
                    {user.displayName}
                  </span>
                ))
            ) : (
              <span className="text-xs text-steel-300">No finisher selected.</span>
            )}
          </div>
          <div className="rounded-md border border-steel-700 bg-steel-850 p-3 text-sm text-steel-300">
            <p className="font-semibold text-white">{state.name || "Unnamed part"}</p>
            <p>{isValidPartNumber(partNumber) ? partNumber : "No part number"}</p>
            <p>
              Qty {state.quantityComplete || "0"}/{state.quantityRequired || "0"}
            </p>
          </div>
        </Card>
      ) : null}

      {mode === "manual" ? (
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={back} disabled={createPartMutation.isPending}>
            {step === 1 ? "Back to Import Choice" : "Back"}
          </Button>
          {step < 3 ? (
            <Button onClick={next}>Next</Button>
          ) : (
            <Button onClick={() => createPartMutation.mutate()} disabled={createPartMutation.isPending}>
              {createPartMutation.isPending ? "Creating..." : "Create Part"}
            </Button>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
