import { NormalizedBomRow } from "@/lib/bom/types";

export interface BomImportProvider {
  parse(content: string): NormalizedBomRow[];
}
