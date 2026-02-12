import { BomImportProvider } from "@/lib/bom/provider";
import { NormalizedBomRow } from "@/lib/bom/types";

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

function pickValue(raw: Record<string, string>, candidates: string[]): string | undefined {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(raw)) {
    normalized.set(normalizeFieldName(key), value);
  }
  for (const candidate of candidates) {
    const value = normalized.get(normalizeFieldName(candidate));
    if (value) {
      return value;
    }
  }
  return undefined;
}

export class CsvOnshapeBomProvider implements BomImportProvider {
  parse(content: string): NormalizedBomRow[] {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const headers = parseCsvLine(lines[0]);
    const rows: NormalizedBomRow[] = [];

    lines.slice(1).forEach((line, index) => {
      const values = parseCsvLine(line);
      const raw: Record<string, string> = {};
      headers.forEach((header, headerIndex) => {
        raw[header] = values[headerIndex] ?? "";
      });

      const partNumber = pickValue(raw, [
        "Part Number",
        "PartNumber",
        "Number",
        "Item Number",
        "Part"
      ]);
      const name = pickValue(raw, ["Name", "Part Name", "Description"]);
      const quantityRaw = pickValue(raw, ["Quantity", "Qty", "QTY", "Count"]);
      const quantityNeeded = quantityRaw ? Number.parseInt(quantityRaw, 10) : undefined;

      rows.push({
        rowIndex: index + 1,
        externalKey: pickValue(raw, ["ID", "Item ID", "Key"]),
        partNumber,
        name,
        quantityNeeded: Number.isNaN(quantityNeeded) ? undefined : quantityNeeded,
        raw
      });
    });

    return rows;
  }
}
