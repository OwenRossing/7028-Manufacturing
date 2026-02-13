export const PART_NUMBER_REGEX = /^\d{4}-\d{4}-R\d+-\d{4}$/;

export function isValidPartNumber(value: string): boolean {
  return PART_NUMBER_REGEX.test(value.trim());
}

export function partNumberHint(): string {
  return "Format must be TEAM-YEAR-ROBOT-PARTCODE, e.g. 7028-2026-R1-1001.";
}
