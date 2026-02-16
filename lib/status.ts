import { PartStatus } from "@prisma/client";

export const ORDER: PartStatus[] = [
  "DESIGNED",
  "CUT",
  "MACHINED",
  "ASSEMBLED",
  "VERIFIED",
  "DONE"
];

export type WorkflowStage = "NOT_STARTED" | "MACHINED" | "COMPLETED";

export const STAGE_ORDER: WorkflowStage[] = [
  "NOT_STARTED",
  "MACHINED",
  "COMPLETED"
];

const STAGE_TO_STATUSES: Record<WorkflowStage, PartStatus[]> = {
  NOT_STARTED: ["DESIGNED"],
  MACHINED: ["CUT", "MACHINED", "ASSEMBLED", "VERIFIED"],
  COMPLETED: ["DONE"]
};

const STAGE_TO_CANONICAL_STATUS: Record<WorkflowStage, PartStatus> = {
  NOT_STARTED: "DESIGNED",
  MACHINED: "MACHINED",
  COMPLETED: "DONE"
};

export function statusToStage(status: PartStatus): WorkflowStage {
  if (status === "DESIGNED") return "NOT_STARTED";
  if (status === "CUT" || status === "MACHINED" || status === "ASSEMBLED" || status === "VERIFIED") return "MACHINED";
  return "COMPLETED";
}

export function stageLabel(stage: WorkflowStage): string {
  if (stage === "NOT_STARTED") return "Not Started";
  if (stage === "MACHINED") return "Machined";
  return "Completed";
}

export function statusesForStage(stage: WorkflowStage): PartStatus[] {
  return STAGE_TO_STATUSES[stage];
}

export function canonicalStatusForStage(stage: WorkflowStage): PartStatus {
  return STAGE_TO_CANONICAL_STATUS[stage];
}

export function nextStatus(current: PartStatus): PartStatus | null {
  const currentStage = statusToStage(current);
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
  const fromIndex = ORDER.indexOf(from);
  const toIndex = ORDER.indexOf(to);
  return fromIndex >= 0 && toIndex >= 0;
}

export function statusLabel(status: PartStatus): string {
  return stageLabel(statusToStage(status));
}
