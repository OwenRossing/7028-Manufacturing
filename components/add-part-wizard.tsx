"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildPartNumber,
  defaultSeasonYear,
  defaultTeamNumber,
  isValidPartNumber,
  partNumberHint
} from "@/lib/part-number";

type ProjectOption = {
  id: string;
  name: string;
};

type UserOption = {
  id: string;
  displayName: string;
};

type WizardState = {
  projectId: string;
  partNumberTeam: string;
  partNumberYear: string;
  partNumberRobot: string;
  partNumberCode: string;
  name: string;
  description: string;
  quantityRequired: number;
  quantityComplete: number;
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
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<WizardState>({
    projectId: projects[0]?.id ?? "",
    partNumberTeam: defaultTeamNumber(),
    partNumberYear: defaultSeasonYear(),
    partNumberRobot: "1",
    partNumberCode: "",
    name: "",
    description: "",
    quantityRequired: 1,
    quantityComplete: 0,
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

  const createPartMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...state,
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
      void queryClient.invalidateQueries({ queryKey: ["parts"] });
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
    if (step === 1) {
      if (!state.projectId || !state.name.trim() || !isValidPartNumber(partNumber)) {
        setError(`Complete required fields. ${partNumberHint()}`);
        return;
      }
    }
    if (step < 3) {
      setStep((prev) => prev + 1);
    }
  }

  function back() {
    setError(null);
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  }

  return (
    <section className="space-y-4">
      <Card className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Add Part Wizard</h1>
        <p className="text-sm text-steel-300">
          Manual-first workflow, designed so Onshape import can prefill this flow later.
        </p>
        <div className="flex gap-2 text-xs">
          {[1, 2, 3].map((value) => (
            <span
              key={value}
              className={`rounded-full px-2 py-1 ${value === step ? "bg-brand-500 text-black" : "bg-steel-800 text-steel-300"}`}
            >
              Step {value}
            </span>
          ))}
        </div>
      </Card>

      {step === 1 ? (
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
              <Input
                value={state.partNumberTeam}
                inputMode="numeric"
                maxLength={4}
                placeholder="7028"
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    partNumberTeam: event.target.value.replace(/\D/g, "").slice(0, 4)
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-steel-300">Year</label>
              <Input
                value={state.partNumberYear}
                inputMode="numeric"
                maxLength={4}
                placeholder={defaultSeasonYear()}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    partNumberYear: event.target.value.replace(/\D/g, "").slice(0, 4)
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-steel-300">Robot #</label>
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

      {step === 2 ? (
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
                type="number"
                min={1}
                value={state.quantityRequired}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, quantityRequired: Number(event.target.value) || 1 }))
                }
              />
            </div>
            <div>
              <label className="block text-sm text-steel-300">Quantity complete</label>
              <Input
                type="number"
                min={0}
                value={state.quantityComplete}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, quantityComplete: Number(event.target.value) || 0 }))
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

      {step === 3 ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Ownership & Review</h2>
          <label className="block text-sm text-steel-300">Primary owner</label>
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
          <label className="block text-sm text-steel-300">Collaborators (optional)</label>
          <select
            multiple
            className="h-36 w-full rounded-md border border-steel-700 bg-steel-850 p-2 text-sm text-white"
            value={state.collaboratorIds}
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
              setState((prev) => ({ ...prev, collaboratorIds: selected }));
            }}
          >
            {users
              .filter((user) => user.id !== state.primaryOwnerId)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
          </select>
          <div className="rounded-md border border-steel-700 bg-steel-850 p-3 text-sm text-steel-300">
            <p className="font-semibold text-white">{state.name || "Unnamed part"}</p>
            <p>{isValidPartNumber(partNumber) ? partNumber : "No part number"}</p>
            <p>
              Qty {state.quantityComplete}/{state.quantityRequired}
            </p>
          </div>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={back} disabled={step === 1 || createPartMutation.isPending}>
          Back
        </Button>
        {step < 3 ? (
          <Button onClick={next}>Next</Button>
        ) : (
          <Button onClick={() => createPartMutation.mutate()} disabled={createPartMutation.isPending}>
            {createPartMutation.isPending ? "Creating..." : "Create Part"}
          </Button>
        )}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
