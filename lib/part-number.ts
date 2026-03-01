export const TEAM_NUMBER_MAX_LENGTH = 12;

export const PART_NUMBER_REGEX = new RegExp(`^\\d{1,${TEAM_NUMBER_MAX_LENGTH}}-\\d{2}-\\d{1,2}-\\d{4}$`);

export function sanitizeTeamNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, TEAM_NUMBER_MAX_LENGTH);
}

export function isValidPartNumber(value: string): boolean {
  return PART_NUMBER_REGEX.test(value.trim());
}

export function partNumberHint(): string {
  return "Format must be TEAM-YY-ROBOT-SPPP, e.g. 7028-26-1-5000.";
}

export function normalizeSeasonYear(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 2) return digits.slice(-2);
  return digits;
}

export function defaultTeamNumber(): string {
  const configured = process.env.NEXT_PUBLIC_TEAM_NUMBER?.trim();
  if (configured && new RegExp(`^\\d{1,${TEAM_NUMBER_MAX_LENGTH}}$`).test(configured)) {
    return configured;
  }
  return "7028";
}

export function defaultSeasonYear(): string {
  return String(new Date().getFullYear()).slice(-2);
}

export function buildPartNumber(segments: {
  team: string;
  year: string;
  robot: string;
  partCode: string;
}): string {
  const team = sanitizeTeamNumber(segments.team);
  const year = normalizeSeasonYear(segments.year);
  const robot = segments.robot.replace(/\D/g, "").slice(0, 2);
  const partCode = segments.partCode.replace(/\D/g, "").slice(0, 4);
  return `${team}-${year}-${robot}-${partCode}`;
}

export function buildSubsystemPartCode(subsystem: string, part: string): string {
  const subsystemDigit = subsystem.replace(/\D/g, "").slice(0, 1);
  const partDigits = part.replace(/\D/g, "").slice(0, 3);
  if (!subsystemDigit || !partDigits) return "";
  return `${subsystemDigit}${partDigits.padStart(3, "0")}`;
}
