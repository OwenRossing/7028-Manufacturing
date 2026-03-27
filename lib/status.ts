import { PartStatus } from "@prisma/client";

export const ORDER: PartStatus[] = [
  "DESIGNED",
  "CUT",
  "MACHINED",
  "ASSEMBLED",
  "VERIFIED",
  "DONE"
];

export type WorkflowStage = "UNASSIGNED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export const STAGE_ORDER: WorkflowStage[] = [
  "UNASSIGNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED"
];

const STAGE_TO_STATUSES: Record<WorkflowStage, PartStatus[]> = {
  UNASSIGNED: ["DESIGNED"],
  ASSIGNED: ["DESIGNED"],
  IN_PROGRESS: ["CUT", "MACHINED", "ASSEMBLED", "VERIFIED"],
  COMPLETED: ["DONE"]
};

const STAGE_TO_CANONICAL_STATUS: Record<WorkflowStage, PartStatus> = {
  UNASSIGNED: "DESIGNED",
  ASSIGNED: "DESIGNED",
  IN_PROGRESS: "MACHINED",
  COMPLETED: "DONE"
};

export function statusToStage(status: PartStatus, hasOwners = true): WorkflowStage {
  if (status === "DESIGNED") return hasOwners ? "ASSIGNED" : "UNASSIGNED";
  if (status === "CUT" || status === "MACHINED" || status === "ASSEMBLED" || status === "VERIFIED") return "IN_PROGRESS";
  return "COMPLETED";
}

export function stageLabel(stage: WorkflowStage): string {
  if (stage === "UNASSIGNED") return "Unassigned";
  if (stage === "ASSIGNED") return "Assigned";
  if (stage === "IN_PROGRESS") return "In Progress";
  return "Completed";
}

export function statusesForStage(stage: WorkflowStage): PartStatus[] {
  return STAGE_TO_STATUSES[stage];
}

export function canonicalStatusForStage(stage: WorkflowStage): PartStatus {
  return STAGE_TO_CANONICAL_STATUS[stage];
}

export function nextStatus(current: PartStatus): PartStatus | null {
  const currentStage = statusToStage(current, true);
  const stageIndex = STAGE_ORDER.indexOf(currentStage);
  if (stageIndex < 0 || stageIndex === STAGE_ORDER.length - 1) {
    return null;
  }
  return canonicalStatusForStage(STAGE_ORDER[stageIndex + 1]);
}

export function canTransition(from: PartStatus, to: PartStatus): boolean {
  if (from === to) {
    return true;
  }
  const allowed: Record<PartStatus, PartStatus[]> = {
    DESIGNED: ["CUT", "MACHINED", "DONE"],
    CUT: ["DESIGNED", "MACHINED", "DONE"],
    MACHINED: ["DESIGNED", "CUT", "ASSEMBLED", "VERIFIED", "DONE"],
    ASSEMBLED: ["DESIGNED", "MACHINED", "VERIFIED", "DONE"],
    VERIFIED: ["DESIGNED", "MACHINED", "DONE"],
    DONE: ["DESIGNED", "MACHINED"]
  };
  return allowed[from].includes(to);
}

export function statusLabel(status: PartStatus): string {
  return stageLabel(statusToStage(status));
}
