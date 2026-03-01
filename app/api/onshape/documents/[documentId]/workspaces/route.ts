import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api";
import { OnshapeClient } from "@/lib/onshape/client";
import { EnvOnshapeCredentialsProvider } from "@/lib/onshape/credentials";
import { isAdminUser } from "@/lib/permissions";

const paramsSchema = z.object({
  documentId: z.string().min(1)
});

const client = new OnshapeClient(new EnvOnshapeCredentialsProvider());

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) return userResult;
  if (!(await isAdminUser(userResult))) {
    return jsonError("Admin access required for Onshape selectors.", 403);
  }

  const params = await context.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request parameters.", 400);
  }

  try {
    const items = await client.listWorkspaces(parsed.data.documentId);
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(
      error instanceof Error ? `Onshape workspace lookup failed: ${error.message}` : "Onshape workspace lookup failed.",
      400
    );
  }
}
