import { PartStatus } from "@prisma/client";

const ORDER: PartStatus[] = [
  "DESIGNED",
  "CUT",
  "MACHINED",
  "ASSEMBLED",
  "VERIFIED",
  "DONE"
];

export function canTransition(from: PartStatus, to: PartStatus): boolean {
  if (from === to) {
    return true;
  }
  const fromIndex = ORDER.indexOf(from);
  const toIndex = ORDER.indexOf(to);
  return fromIndex >= 0 && toIndex >= 0 && Math.abs(toIndex - fromIndex) <= 1;
}

export function statusLabel(status: PartStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}
