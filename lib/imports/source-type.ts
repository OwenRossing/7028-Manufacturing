export const IMPORT_SOURCE_TYPE = {
  CSV_ONSHAPE_EXPORT: "CSV_ONSHAPE_EXPORT",
  ONSHAPE_API: "ONSHAPE_API"
} as const;

export type ImportSourceType = (typeof IMPORT_SOURCE_TYPE)[keyof typeof IMPORT_SOURCE_TYPE];
