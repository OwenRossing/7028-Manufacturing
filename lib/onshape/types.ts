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

export type OnshapeDocumentOption = {
  id: string;
  name: string;
};

export type OnshapeWorkspaceOption = {
  id: string;
  name: string;
  type: string;
};

export type OnshapeElementOption = {
  id: string;
  name: string;
  elementType: string;
};

export type OnshapeIdentity = {
  documentId: string;
  workspaceId: string;
  elementId: string;
  partId: string;
};
