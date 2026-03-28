import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CsvOnshapeBomProvider } from "@/lib/bom/csv-provider";
import { jsonError, requireUser } from "@/lib/api";
import { createImportPreviewBatch } from "@/lib/imports/preview-batch";
import { normalizeImportPrefixFilters } from "@/lib/imports/prefix";
import { IMPORT_SOURCE_TYPE } from "@/lib/imports/source-type";
import { getIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";

const provider = new CsvOnshapeBomProvider();
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

  if (file.size > MAX_FILE_SIZE) {
    return jsonError(`CSV file exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`, 400);
  }

  const teamNumber = String(formData.get("teamNumber") ?? "").trim();
  const seasonYear = String(formData.get("seasonYear") ?? "").trim();
  const robotNumber = String(formData.get("robotNumber") ?? "").trim();

  const token = request.headers.get("x-idempotency-key");
  const scope = `bom-import:${projectId}:${file.name}:${file.lastModified}`;
  if (token) {
    const existingToken = await getIdempotentResponse(token, scope);
    if (existingToken?.responseJson) {
      return NextResponse.json(existingToken.responseJson);
    }
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return jsonError("Project not found.", 404);
  }

  try {
    let csvContent = "";
    try {
      csvContent = await file.text();
    } catch {
      return jsonError("Failed to read CSV file. Ensure it is valid UTF-8 text.", 400);
    }

    if (!csvContent.trim()) {
      return jsonError("CSV file is empty.", 400);
    }

    const parsed = provider.parseCsvBom(csvContent);
    if (!parsed.rows.length && !parsed.errors.length) {
      return jsonError("No rows detected in uploaded CSV.", 400);
    }

    const filters = normalizeImportPrefixFilters({
      team: teamNumber,
      year: seasonYear,
      robot: robotNumber
    });

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

    if (token) {
      await storeIdempotentResponse(token, scope, preview);
    }

    return NextResponse.json(preview);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Import preview failed.";
    return jsonError(errorMessage, 400);
  }
}
