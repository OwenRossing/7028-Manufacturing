import { BomRowError, ParseCsvBomResult } from "@/lib/bom/types";
import { OnshapeClient } from "@/lib/onshape/client";
import { OnshapeBomRequest } from "@/lib/onshape/types";

function toScalarText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function buildOnshapeImportNotes(raw: Record<string, unknown>): string | null {
  const candidates: Array<[label: string, keys: string[]]> = [
    ["Color", ["color", "colour", "appearance"]],
    ["Material", ["material"]],
    ["Finish", ["finish", "surfacefinish", "surface_finish"]],
    ["Treatment", ["treatment", "heat_treatment"]],
    ["Coating", ["coating", "coat"]]
  ];

  const entries: string[] = [];
  const lowered = new Map(Object.keys(raw).map((key) => [key.toLowerCase(), key]));
  for (const [label, keys] of candidates) {
    for (const key of keys) {
      const matchedKey = lowered.get(key);
      if (!matchedKey) continue;
      const value = toScalarText(raw[matchedKey]);
      if (!value) continue;
      entries.push(`${label}: ${value}`);
      break;
    }
  }

  if (!entries.length) return null;
  return `Onshape notes: ${entries.join(" | ")}`;
}

function parseQuantity(value: number | undefined, row: number, errors: BomRowError[]): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) {
    errors.push({
      row,
      column: "quantity",
      message: "Quantity is not numeric."
    });
    return undefined;
  }
  if (value < 0) {
    errors.push({
      row,
      column: "quantity",
      message: "Quantity cannot be negative."
    });
    return undefined;
  }
  if (!Number.isInteger(value)) {
    errors.push({
      row,
      column: "quantity",
      message: `Quantity "${value}" must be a whole number.`
    });
    return undefined;
  }
  return value;
}

function normalizePartNumber(value: string | undefined): string | null {
  if (!value) return null;
  const compact = value
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return null;
  const matched = compact.match(/\d{1,12}-\d{2}-\d{1,2}-\d{4}/);
  if (matched) return matched[0];
  return compact;
}

export class OnshapeBomProvider {
  constructor(private readonly client: OnshapeClient) {}

  async fetchAndNormalize(request: OnshapeBomRequest): Promise<ParseCsvBomResult> {
    const result = await this.client.fetchAssemblyBom(request);
    const errors: BomRowError[] = [];
    let droppedMissingPartNumber = 0;
    const rows = result.rows.flatMap((row) => {
      const partNumber = normalizePartNumber(row.partNumber);
      const name = row.name?.trim() || partNumber;
      const quantityNeeded = parseQuantity(row.quantityNeeded, row.rowIndex, errors);

      if (!partNumber) {
        // Ignore BOM lines without part numbers so purchased/hardware lines
        // do not block preview for valid team part rows.
        droppedMissingPartNumber += 1;
        return [];
      }
      if (!name) {
        errors.push({
          row: row.rowIndex,
          column: "name",
          message: "Part name is required.",
          raw: JSON.stringify(row.raw)
        });
      }

      if (!name) return [];

      return [
        {
          rowIndex: row.rowIndex,
          externalKey: row.partId ?? row.itemId,
          partNumber,
          name,
          quantityNeeded,
          raw: {
            ...row.raw,
            onshapeDocumentId: request.documentId,
            onshapeWorkspaceId: request.workspaceId,
            onshapeElementId: request.elementId,
            onshapePartId: row.partId ?? row.itemId ?? "",
            onshapeImportNotes: buildOnshapeImportNotes(row.raw)
          }
        }
      ];
    });

    if (result.rows.length > 0 && rows.length === 0) {
      errors.push({
        row: 1,
        column: "global",
        message:
          `Onshape returned ${result.rows.length} BOM rows, but all were dropped because ` +
          `"Part number" was empty/missing. Fill the Part Number property in Onshape ` +
          `(or change importer rules). Dropped=${droppedMissingPartNumber}.`
      });
    }

    return { rows, errors };
  }
}
