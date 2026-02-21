import { ParseCsvBomResult } from "@/lib/bom/types";

export interface BomImportProvider {
  parseCsvBom(content: string): ParseCsvBomResult;
}
