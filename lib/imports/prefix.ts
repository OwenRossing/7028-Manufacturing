export type ImportPrefixFilters = {
  team: string;
  year: string;
  robot: string;
};

function normalizeYear(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function normalizeImportPrefixFilters(input: Partial<ImportPrefixFilters>): ImportPrefixFilters {
  return {
    team: (input.team ?? "").replace(/\D/g, "").slice(0, 4) || "7028",
    year: normalizeYear(input.year ?? "") || String(new Date().getFullYear()),
    robot: (input.robot ?? "").replace(/\D/g, "") || "1"
  };
}

export function matchesPartPrefix(
  partNumber: string | undefined,
  filters: ImportPrefixFilters
): boolean {
  if (!partNumber) return false;
  if (!filters.team) return false;

  const normalized = partNumber.toUpperCase();
  const fullPrefix = `${filters.team}-${filters.year}-${filters.robot}`;
  const legacyPrefix = `${filters.team}-${filters.year}-R${filters.robot}`;
  if (filters.team && filters.year && filters.robot) {
    return (
      normalized.startsWith(fullPrefix.toUpperCase()) ||
      normalized.startsWith(legacyPrefix.toUpperCase())
    );
  }
  if (filters.team && filters.year) return normalized.startsWith(`${filters.team}-${filters.year}`.toUpperCase());
  return normalized.startsWith(filters.team.toUpperCase());
}
