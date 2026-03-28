import { BomImportProvider } from "@/lib/bom/provider";
import { BomRowError, NormalizedBomRow, ParseCsvBomResult } from "@/lib/bom/types";

function parseCSV(content: string): { rows: string[][]; errors: string[] } {
  const rows: string[][] = [];
  const errors: string[] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      if (char === "\r" && next === "\n") {
        i++;
      }
    } else {
      currentCell += char;
    }
  }

  if (inQuotes) {
    errors.push("CSV has unclosed quotes. Check your file formatting.");
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return { rows, errors };
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
  if (parsed <= 0) {
    errors.push({
      row,
      column,
      message: `Quantity value "${trimmed}" must be greater than 0.`,
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
    const { rows: csvRows, errors: parseErrors } = parseCSV(content);

    if (csvRows.length < 2) {
      return {
        rows: [],
        errors: parseErrors.map((msg) => ({
          row: 1,
          column: "global",
          message: msg
        }))
      };
    }

    const headers = csvRows[0];
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
    const errors: BomRowError[] = parseErrors.map((msg) => ({
      row: 1,
      column: "global",
      message: msg
    }));

    csvRows.slice(1).forEach((values, index) => {
      const csvRow = index + 2;
      const raw: Record<string, string> = {};
      headers.forEach((header, headerIndex) => {
        raw[header] = values[headerIndex] ?? "";
      });

      const partNumber = (partNumberHeader ? raw[partNumberHeader] : "").trim();
      const nameRaw = (nameHeader ? raw[nameHeader] : "").trim();
      const name = nameRaw || partNumber;
      const quantityRaw = quantityHeader ? raw[quantityHeader] : undefined;
      const errorsBeforeQuantity = errors.length;
      const quantityNeeded = parseQuantity(quantityRaw, csvRow, quantityHeader, errors);
      const externalKey = externalKeyHeader ? raw[externalKeyHeader]?.trim() : undefined;

      if (!partNumber) {
        return;
      }

      if (!name) {
        errors.push({
          row: csvRow,
          column: nameHeader,
          message: "Part name is required.",
          raw: nameHeader ? raw[nameHeader] : ""
        });
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
