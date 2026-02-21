export type OnshapeBomRequest = {
  documentId: string;
  workspaceId: string;
  elementId: string;
};

export type OnshapeBomRawRow = Record<string, unknown>;

export type OnshapeBomRow = {
  rowIndex: number;
  partNumber?: string;
  name?: string;
  quantityNeeded?: number;
  partId?: string;
  itemId?: string;
  raw: OnshapeBomRawRow;
};

export type OnshapeBomFetchResult = {
  rows: OnshapeBomRow[];
};

export type OnshapeIdentity = {
  documentId: string;
  workspaceId: string;
  elementId: string;
  partId: string;
};
