import { BomRowError, ParseCsvBomResult } from "@/lib/bom/types";
import { OnshapeClient } from "@/lib/onshape/client";
import { OnshapeBomRequest } from "@/lib/onshape/types";

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

export class OnshapeBomProvider {
  constructor(private readonly client: OnshapeClient) {}

  async fetchAndNormalize(request: OnshapeBomRequest): Promise<ParseCsvBomResult> {
    const result = await this.client.fetchAssemblyBom(request);
    const errors: BomRowError[] = [];
    const rows = result.rows.flatMap((row) => {
      const partNumber = row.partNumber?.trim();
      const name = row.name?.trim();
      const quantityNeeded = parseQuantity(row.quantityNeeded, row.rowIndex, errors);

      if (!partNumber) {
        errors.push({
          row: row.rowIndex,
          column: "partNumber",
          message: "Part number is required.",
          raw: JSON.stringify(row.raw)
        });
      }
      if (!name) {
        errors.push({
          row: row.rowIndex,
          column: "name",
          message: "Part name is required.",
          raw: JSON.stringify(row.raw)
        });
      }

      if (!partNumber || !name) return [];

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
            onshapePartId: row.partId ?? row.itemId ?? ""
          }
        }
      ];
    });

    return { rows, errors };
  }
}
