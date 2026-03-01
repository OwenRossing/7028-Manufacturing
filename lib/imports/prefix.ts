import { sanitizeTeamNumber } from "@/lib/part-number";

export type ImportPrefixFilters = {
  team: string;
  year: string;
  robot: string;
};

function normalizeYear(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 2) return digits.slice(-2);
  return digits;
}

export function normalizeImportPrefixFilters(input: Partial<ImportPrefixFilters>): ImportPrefixFilters {
  return {
    team: sanitizeTeamNumber(input.team ?? "") || "7028",
    year: normalizeYear(input.year ?? "") || String(new Date().getFullYear()).slice(-2),
    robot: (input.robot ?? "").replace(/\D/g, "") || "1"
  };
}

export function matchesPartPrefix(
  partNumber: string | undefined,
  filters: ImportPrefixFilters
): boolean {
  if (!partNumber) return false;
  if (!filters.team) return false;

  const normalized = partNumber.replace(/[–—−]/g, "-").replace(/\s+/g, "").toUpperCase();
  const yearDigits = filters.year.replace(/\D/g, "");
  const yearCandidates = new Set<string>([yearDigits]);
  if (yearDigits.length === 4) yearCandidates.add(yearDigits.slice(-2));
  if (yearDigits.length === 2) yearCandidates.add(`20${yearDigits}`);

  if (filters.team && yearCandidates.size > 0 && filters.robot) {
    for (const year of yearCandidates) {
      const fullPrefix = `${filters.team}-${year}-${filters.robot}`.toUpperCase();
      const legacyPrefix = `${filters.team}-${year}-R${filters.robot}`.toUpperCase();
      if (normalized.startsWith(fullPrefix) || normalized.startsWith(legacyPrefix)) {
        return true;
      }
    }
    return false;
  }
  if (filters.team && yearCandidates.size > 0) {
    for (const year of yearCandidates) {
      if (normalized.startsWith(`${filters.team}-${year}`.toUpperCase())) return true;
    }
    return false;
  }
  return normalized.startsWith(filters.team.toUpperCase());
}
