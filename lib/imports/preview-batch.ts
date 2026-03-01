import { ImportBatchStatus, ImportRowAction, Prisma, PrismaClient } from "@prisma/client";
import { BomRowError, NormalizedBomRow } from "@/lib/bom/types";
import { ImportPrefixFilters, matchesPartPrefix } from "@/lib/imports/prefix";
import { ImportSourceType } from "@/lib/imports/source-type";

type BatchRow = {
  rowIndex: number;
  externalKey: string | null;
  partNumber: string | null;
  name: string | null;
  quantityNeeded: number | null;
  action: ImportRowAction;
  errorMessage: string | null;
  rawJson?: Prisma.InputJsonValue;
};

export type PreviewBatchSummary = {
  total: number;
  create: number;
  update: number;
  noChange: number;
  error: number;
  filteredOut: number;
  filters: ImportPrefixFilters;
  source?: Record<string, string>;
};

export type CreateImportPreviewBatchInput = {
  prisma: PrismaClient;
  projectId: string;
  startedById: string;
  fileName: string;
  sourceType: ImportSourceType;
  rows: NormalizedBomRow[];
  errors: BomRowError[];
  filters: ImportPrefixFilters;
  sourceMeta?: Record<string, string>;
};

export type PreviewBatchResult = {
  batchId: string;
  summary: PreviewBatchSummary;
  rows: BatchRow[];
};

export async function createImportPreviewBatch(
  input: CreateImportPreviewBatchInput
): Promise<PreviewBatchResult> {
  const project = await input.prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) {
    throw new Error("Project not found.");
  }

  const filteredRows = input.rows.filter((row) => matchesPartPrefix(row.partNumber, input.filters));
  const filteredOutCount = input.rows.length - filteredRows.length;
  if (filteredRows.length === 0 && input.errors.length === 0) {
    throw new Error("No rows matched Team/Year/Robot filter.");
  }

  const existingParts = await input.prisma.part.findMany({
    where: { projectId: input.projectId },
    select: { partNumber: true, name: true, quantityRequired: true }
  });
  const byPartNumber = new Map(existingParts.map((part) => [part.partNumber, part]));

  const previewRows: BatchRow[] = filteredRows.map((row) => {
    if (!row.partNumber || !row.name) {
      return {
        rowIndex: row.rowIndex,
        externalKey: row.externalKey ?? null,
        partNumber: row.partNumber ?? null,
        name: row.name ?? null,
        quantityNeeded: row.quantityNeeded ?? null,
        action: ImportRowAction.ERROR,
        errorMessage: "Missing part number or name.",
        rawJson: JSON.parse(JSON.stringify(row.raw)) as Prisma.InputJsonValue
      };
    }

    const existing = byPartNumber.get(row.partNumber);
    if (!existing) {
      return {
        rowIndex: row.rowIndex,
        externalKey: row.externalKey ?? null,
        partNumber: row.partNumber,
        name: row.name,
        quantityNeeded: row.quantityNeeded ?? 1,
        action: ImportRowAction.CREATE,
        errorMessage: null,
        rawJson: JSON.parse(JSON.stringify(row.raw)) as Prisma.InputJsonValue
      };
    }

    const noChange =
      existing.name === row.name &&
      existing.quantityRequired === (row.quantityNeeded ?? existing.quantityRequired);
    return {
      rowIndex: row.rowIndex,
      externalKey: row.externalKey ?? null,
      partNumber: row.partNumber,
      name: row.name,
      quantityNeeded: row.quantityNeeded ?? existing.quantityRequired,
      action: noChange ? ImportRowAction.NO_CHANGE : ImportRowAction.UPDATE,
      errorMessage: null,
      rawJson: JSON.parse(JSON.stringify(row.raw)) as Prisma.InputJsonValue
    };
  });

  const parseErrorRows: BatchRow[] = input.errors.map((error) => ({
    rowIndex: error.row,
    externalKey: null,
    partNumber: null,
    name: null,
    quantityNeeded: null,
    action: ImportRowAction.ERROR,
    errorMessage:
      error.column === "global"
        ? `Import error: ${error.message}`
        : `Row ${error.row}${error.column ? ` (${error.column})` : ""}: ${error.message}`,
    rawJson: error.raw ? ({ raw: error.raw } as Prisma.InputJsonValue) : undefined
  }));

  const allRows = [...previewRows, ...parseErrorRows].sort((a, b) => a.rowIndex - b.rowIndex);
  const summary: PreviewBatchSummary = {
    total: allRows.length,
    create: allRows.filter((row) => row.action === ImportRowAction.CREATE).length,
    update: allRows.filter((row) => row.action === ImportRowAction.UPDATE).length,
    noChange: allRows.filter((row) => row.action === ImportRowAction.NO_CHANGE).length,
    error: allRows.filter((row) => row.action === ImportRowAction.ERROR).length,
    filteredOut: filteredOutCount,
    filters: input.filters,
    ...(input.sourceMeta ? { source: input.sourceMeta } : {})
  };

  const batch = await input.prisma.importBatch.create({
    data: {
      projectId: input.projectId,
      sourceType: input.sourceType,
      fileName: input.fileName,
      startedById: input.startedById,
      status: ImportBatchStatus.PREVIEW,
      summaryJson: summary,
      rows: {
        createMany: {
          data: allRows
        }
      }
    },
    include: {
      rows: {
        orderBy: { rowIndex: "asc" }
      }
    }
  });

  return {
    batchId: batch.id,
    summary,
    rows: batch.rows as unknown as BatchRow[]
  };
}
