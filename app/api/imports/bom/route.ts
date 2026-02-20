import { ImportBatchStatus, ImportRowAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CsvOnshapeBomProvider } from "@/lib/bom/csv-provider";
import { jsonError, requireUser } from "@/lib/api";
import { isAdminUser } from "@/lib/permissions";

const provider = new CsvOnshapeBomProvider();

function normalizeYear(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

function matchesPartPrefix(
  partNumber: string | undefined,
  filters: { team: string; year: string; robot: string }
): boolean {
  if (!partNumber) return false;
  const team = filters.team.replace(/\D/g, "").slice(0, 4);
  const year = normalizeYear(filters.year);
  const robot = filters.robot.replace(/\D/g, "");
  if (!team) return false;

  const normalized = partNumber.toUpperCase();
  const fullPrefix = `${team}-${year}-${robot}`;
  const legacyPrefix = `${team}-${year}-R${robot}`;
  if (team && year && robot) {
    return (
      normalized.startsWith(fullPrefix.toUpperCase()) ||
      normalized.startsWith(legacyPrefix.toUpperCase())
    );
  }
  if (team && year) return normalized.startsWith(`${team}-${year}`.toUpperCase());
  return normalized.startsWith(team.toUpperCase());
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }
  if (!(await isAdminUser(userResult))) {
    return jsonError("Admin access required for BOM import.", 403);
  }

  const formData = await request.formData();
  const projectId = formData.get("projectId");
  if (typeof projectId !== "string" || !projectId) {
    return jsonError("projectId is required.", 400);
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("CSV file is required.", 400);
  }
  const teamNumber = String(formData.get("teamNumber") ?? "").trim();
  const seasonYear = String(formData.get("seasonYear") ?? "").trim();
  const robotNumber = String(formData.get("robotNumber") ?? "").trim();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return jsonError("Project not found.", 404);
  }

  const csvContent = await file.text();
  const normalizedRows = provider.parse(csvContent);
  if (normalizedRows.length === 0) {
    return jsonError("No rows detected in uploaded CSV.", 400);
  }
  const filteredRows = normalizedRows.filter((row) =>
    matchesPartPrefix(row.partNumber, {
      team: teamNumber || "7028",
      year: seasonYear || String(new Date().getFullYear()),
      robot: robotNumber || "1"
    })
  );
  const filteredOutCount = normalizedRows.length - filteredRows.length;
  if (filteredRows.length === 0) {
    return jsonError("No rows matched Team/Year/Robot filter.", 400);
  }

  const existingParts = await prisma.part.findMany({
    where: { projectId },
    select: { partNumber: true, name: true, quantityRequired: true }
  });
  const byPartNumber = new Map(existingParts.map((part) => [part.partNumber, part]));

  const rows = filteredRows.map((row) => {
    if (!row.partNumber || !row.name) {
      return {
        rowIndex: row.rowIndex,
        externalKey: row.externalKey,
        partNumber: row.partNumber ?? null,
        name: row.name ?? null,
        quantityNeeded: row.quantityNeeded ?? null,
        action: ImportRowAction.ERROR,
        errorMessage: "Missing part number or name.",
        rawJson: row.raw
      };
    }
    const existing = byPartNumber.get(row.partNumber);
    if (!existing) {
      return {
        rowIndex: row.rowIndex,
        externalKey: row.externalKey,
        partNumber: row.partNumber,
        name: row.name,
        quantityNeeded: row.quantityNeeded ?? 1,
        action: ImportRowAction.CREATE,
        errorMessage: null,
        rawJson: row.raw
      };
    }
    const noChange =
      existing.name === row.name &&
      existing.quantityRequired === (row.quantityNeeded ?? existing.quantityRequired);
    return {
      rowIndex: row.rowIndex,
      externalKey: row.externalKey,
      partNumber: row.partNumber,
      name: row.name,
      quantityNeeded: row.quantityNeeded ?? existing.quantityRequired,
      action: noChange ? ImportRowAction.NO_CHANGE : ImportRowAction.UPDATE,
      errorMessage: null,
      rawJson: row.raw
    };
  });

  const summary = {
    total: rows.length,
    create: rows.filter((row) => row.action === ImportRowAction.CREATE).length,
    update: rows.filter((row) => row.action === ImportRowAction.UPDATE).length,
    noChange: rows.filter((row) => row.action === ImportRowAction.NO_CHANGE).length,
    error: rows.filter((row) => row.action === ImportRowAction.ERROR).length,
    filteredOut: filteredOutCount
  };

  const batch = await prisma.importBatch.create({
    data: {
      projectId,
      sourceType: "CSV_ONSHAPE_EXPORT",
      fileName: file.name,
      startedById: userResult,
      status: ImportBatchStatus.PREVIEW,
      summaryJson: summary,
      rows: {
        createMany: {
          data: rows
        }
      }
    },
    include: {
      rows: {
        orderBy: { rowIndex: "asc" }
      }
    }
  });

  return NextResponse.json({
    batchId: batch.id,
    summary,
    rows: batch.rows
  });
}
