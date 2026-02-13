export const PART_NUMBER_REGEX = /^\d{4}-\d{4}-R\d+-\d{4}$/;

export function isValidPartNumber(value: string): boolean {
  return PART_NUMBER_REGEX.test(value.trim());
}

export function partNumberHint(): string {
  return "Format must be TEAM-YEAR-ROBOT-PARTCODE, e.g. 7028-2026-R1-1001.";
}

export function defaultTeamNumber(): string {
  const configured = process.env.NEXT_PUBLIC_TEAM_NUMBER?.trim();
  if (configured && /^\d{4}$/.test(configured)) {
    return configured;
  }
  return "7028";
}

export function defaultSeasonYear(): string {
  return String(new Date().getFullYear());
}

export function buildPartNumber(segments: {
  team: string;
  year: string;
  robot: string;
  partCode: string;
}): string {
  const team = segments.team.replace(/\D/g, "").slice(0, 4);
  const year = segments.year.replace(/\D/g, "").slice(0, 4);
  const robot = segments.robot.replace(/\D/g, "");
  const partCode = segments.partCode.replace(/\D/g, "").slice(0, 4);
  return `${team}-${year}-R${robot}-${partCode}`;
}
