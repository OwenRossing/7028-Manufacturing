import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CsvOnshapeBomProvider } from "@/lib/bom/csv-provider";
import { jsonError, requireUser } from "@/lib/api";
import { createImportPreviewBatch } from "@/lib/imports/preview-batch";
import { normalizeImportPrefixFilters } from "@/lib/imports/prefix";
import { IMPORT_SOURCE_TYPE } from "@/lib/imports/source-type";
const provider = new CsvOnshapeBomProvider();

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
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
  const parsed = provider.parseCsvBom(csvContent);
  if (!parsed.rows.length && !parsed.errors.length) {
    return jsonError("No rows detected in uploaded CSV.", 400);
  }

  const filters = normalizeImportPrefixFilters({
    team: teamNumber,
    year: seasonYear,
    robot: robotNumber
  });

  try {
    const preview = await createImportPreviewBatch({
      prisma,
      projectId,
      startedById: userResult,
      sourceType: IMPORT_SOURCE_TYPE.CSV_ONSHAPE_EXPORT,
      fileName: file.name,
      rows: parsed.rows,
      errors: parsed.errors,
      filters
    });
    return NextResponse.json(preview);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Import preview failed.", 400);
  }
}
