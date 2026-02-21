import { BomImportProvider } from "@/lib/bom/provider";
import { BomRowError, NormalizedBomRow, ParseCsvBomResult } from "@/lib/bom/types";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeader(headers: string[], candidates: string[]): string | undefined {
  const byNormalized = new Map(headers.map((header) => [normalizeFieldName(header), header]));
  for (const candidate of candidates) {
    const found = byNormalized.get(normalizeFieldName(candidate));
    if (found) return found;
  }
  return undefined;
}

function parseQuantity(
  rawValue: string | undefined,
  row: number,
  column: string | undefined,
  errors: BomRowError[]
): number | undefined {
  if (!rawValue?.trim()) return undefined;
  const trimmed = rawValue.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    errors.push({
      row,
      column,
      message: `Quantity value "${trimmed}" is not numeric.`,
      raw: rawValue
    });
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    errors.push({
      row,
      column,
      message: `Quantity value "${trimmed}" is not finite.`,
      raw: rawValue
    });
    return undefined;
  }
  if (parsed < 0) {
    errors.push({
      row,
      column,
      message: `Quantity value "${trimmed}" cannot be negative.`,
      raw: rawValue
    });
    return undefined;
  }
  if (!Number.isInteger(parsed)) {
    errors.push({
      row,
      column,
      message: `Quantity value "${trimmed}" must be a whole number.`,
      raw: rawValue
    });
    return undefined;
  }
  return parsed;
}

export class CsvOnshapeBomProvider implements BomImportProvider {
  parseCsvBom(content: string): ParseCsvBomResult {
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      return { rows: [], errors: [] };
    }

    const headers = parseCsvLine(lines[0]);
    const partNumberHeader = findHeader(headers, [
      "Part Number",
      "PartNumber",
      "Number",
      "Item Number",
      "Part"
    ]);
    const nameHeader = findHeader(headers, ["Name", "Part Name", "Description"]);
    const quantityHeader = findHeader(headers, ["Quantity", "Qty", "QTY", "Count"]);
    const externalKeyHeader = findHeader(headers, ["ID", "Item ID", "Key"]);

    const rows: NormalizedBomRow[] = [];
    const errors: BomRowError[] = [];

    lines.slice(1).forEach((line, index) => {
      const csvRow = index + 2;
      const values = parseCsvLine(line);
      const raw: Record<string, string> = {};
      headers.forEach((header, headerIndex) => {
        raw[header] = values[headerIndex] ?? "";
      });

      const partNumber = (partNumberHeader ? raw[partNumberHeader] : "").trim();
      const name = (nameHeader ? raw[nameHeader] : "").trim();
      const quantityRaw = quantityHeader ? raw[quantityHeader] : undefined;
      const errorsBeforeQuantity = errors.length;
      const quantityNeeded = parseQuantity(quantityRaw, csvRow, quantityHeader, errors);
      const externalKey = externalKeyHeader ? raw[externalKeyHeader]?.trim() : undefined;

      if (!partNumber) {
        errors.push({
          row: csvRow,
          column: partNumberHeader,
          message: "Part number is required.",
          raw: partNumberHeader ? raw[partNumberHeader] : line
        });
      }

      if (!name) {
        errors.push({
          row: csvRow,
          column: nameHeader,
          message: "Part name is required.",
          raw: nameHeader ? raw[nameHeader] : line
        });
      }

      if (!partNumber || !name) {
        return;
      }
      if (errors.length > errorsBeforeQuantity) {
        return;
      }

      rows.push({
        rowIndex: csvRow,
        externalKey,
        partNumber,
        name,
        quantityNeeded,
        raw
      });
    });

    return { rows, errors };
  }
}
