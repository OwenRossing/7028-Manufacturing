import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { OnshapeBomProvider } from "@/lib/bom/onshape-provider";
import { prisma } from "@/lib/db";
import { getIdempotentResponse, storeIdempotentResponse } from "@/lib/idempotency";
import { commitImportBatch } from "@/lib/imports/commit-batch";
import { createImportPreviewBatch } from "@/lib/imports/preview-batch";
import { normalizeImportPrefixFilters } from "@/lib/imports/prefix";
import { IMPORT_SOURCE_TYPE } from "@/lib/imports/source-type";
import { OnshapeClient } from "@/lib/onshape/client";
import { EnvOnshapeCredentialsProvider } from "@/lib/onshape/credentials";

const schema = z.object({
  projectId: z.string().min(1),
  documentId: z.string().min(1),
  workspaceId: z.string().min(1),
  elementId: z.string().min(1),
  teamNumber: z.string().optional(),
  seasonYear: z.string().optional(),
  robotNumber: z.string().optional(),
  commit: z.boolean().optional().default(true)
});

const provider = new OnshapeBomProvider(new OnshapeClient(new EnvOnshapeCredentialsProvider()));

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) return userResult;
  const parsed = await parseJson(request, schema);
  if (!parsed.ok) return parsed.response;

  const token = request.headers.get("x-idempotency-key");
  const scope = `onshape-resync:${parsed.data.projectId}:${parsed.data.documentId}:${parsed.data.workspaceId}:${parsed.data.elementId}`;
  const existingToken = await getIdempotentResponse(token, scope);
  if (existingToken?.responseJson) {
    return NextResponse.json(existingToken.responseJson);
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
      fileName: `onshape-resync:${parsed.data.documentId}/${parsed.data.workspaceId}/${parsed.data.elementId}`,
      rows: normalized.rows,
      errors: normalized.errors,
      filters,
      sourceMeta: {
        documentId: parsed.data.documentId,
        workspaceId: parsed.data.workspaceId,
        elementId: parsed.data.elementId
      }
    });

    const payload = parsed.data.commit
      ? {
          batchId: preview.batchId,
          summary: preview.summary,
          commit: await commitImportBatch({
            prisma,
            batchId: preview.batchId,
            actorUserId: userResult,
            resync: true
          })
        }
      : {
          batchId: preview.batchId,
          summary: preview.summary,
          commit: null
        };

    await storeIdempotentResponse(token, scope, payload);
    return NextResponse.json(payload);
  } catch (error) {
    return jsonError(
      error instanceof Error ? `Onshape re-sync failed: ${error.message}` : "Failed to run Onshape re-sync.",
      400
    );
  }
}
