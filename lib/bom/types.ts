export type NormalizedBomRow = {
  rowIndex: number;
  externalKey?: string;
  partNumber?: string;
  name?: string;
  quantityNeeded?: number;
  raw: Record<string, string>;
};
