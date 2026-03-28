import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { OnshapeBomProvider } from "@/lib/bom/onshape-provider";
import { prisma } from "@/lib/db";
import { createImportPreviewBatch } from "@/lib/imports/preview-batch";
import { normalizeImportPrefixFilters } from "@/lib/imports/prefix";
import { IMPORT_SOURCE_TYPE } from "@/lib/imports/source-type";
import { OnshapeClient } from "@/lib/onshape/client";
import { EnvOnshapeCredentialsProvider } from "@/lib/onshape/credentials";
import { getIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";

const schema = z.object({
  projectId: z.string().min(1),
  documentId: z.string().min(1),
  workspaceId: z.string().min(1),
  elementId: z.string().min(1),
  teamNumber: z.string().optional(),
  seasonYear: z.string().optional(),
  robotNumber: z.string().optional()
});

function validateOnshapeCredentials(): void {
  const accessKey = process.env.ONSHAPE_ACCESS_KEY;
  const secretKey = process.env.ONSHAPE_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error(
      "Onshape API credentials not configured. Set ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY environment variables."
    );
  }
}

const provider = new OnshapeBomProvider(new OnshapeClient(new EnvOnshapeCredentialsProvider()));

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) return userResult;

  validateOnshapeCredentials();

  const parsed = await parseJson(request, schema);
  if (!parsed.ok) return parsed.response;

  const token = request.headers.get("x-idempotency-key");
  const scope = `onshape-preview:${parsed.data.projectId}:${parsed.data.documentId}:${parsed.data.workspaceId}:${parsed.data.elementId}`;
  if (token) {
    const existingToken = await getIdempotentResponse(token, scope);
    if (existingToken?.responseJson) {
      return NextResponse.json(existingToken.responseJson);
    }
  }

  const filters = normalizeImportPrefixFilters({
    team: parsed.data.teamNumber,
    year: parsed.data.seasonYear,
    robot: parsed.data.robotNumber
  });

  try {
    const normalized = await provider.fetchAndNormalize({
      documentId: parsed.data.documentId,
      workspaceId: parsed.data.workspaceId,
      elementId: parsed.data.elementId
    });

    if (!normalized.rows.length && !normalized.errors.length) {
      return jsonError("No rows were returned by Onshape BOM.", 400);
    }

    const preview = await createImportPreviewBatch({
      prisma,
      projectId: parsed.data.projectId,
      startedById: userResult,
      sourceType: IMPORT_SOURCE_TYPE.ONSHAPE_API,
      fileName: `onshape:${parsed.data.documentId}/${parsed.data.workspaceId}/${parsed.data.elementId}`,
      rows: normalized.rows,
      errors: normalized.errors,
      filters,
      sourceMeta: {
        documentId: parsed.data.documentId,
        workspaceId: parsed.data.workspaceId,
        elementId: parsed.data.elementId
      }
    });

    if (token) {
      await storeIdempotentResponse(token, scope, preview);
    }

    return NextResponse.json(preview);
  } catch (error) {
    return jsonError(
      error instanceof Error ? `Onshape preview failed: ${error.message}` : "Failed to create preview batch.",
      400
    );
  }
}
