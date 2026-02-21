export type NormalizedBomRow = {
  rowIndex: number;
  externalKey?: string;
  partNumber?: string;
  name?: string;
  quantityNeeded?: number;
  raw: Record<string, unknown>;
};

export type BomRowError = {
  row: number;
  column?: string;
  message: string;
  raw?: string;
};

export type ParseCsvBomResult = {
  rows: NormalizedBomRow[];
  errors: BomRowError[];
};
