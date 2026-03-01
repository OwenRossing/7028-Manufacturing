import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { OnshapeClient } from "@/lib/onshape/client";
import { EnvOnshapeCredentialsProvider } from "@/lib/onshape/credentials";
import { isAdminUser } from "@/lib/permissions";

const client = new OnshapeClient(new EnvOnshapeCredentialsProvider());

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) return userResult;
  if (!(await isAdminUser(userResult))) {
    return jsonError("Admin access required for Onshape selectors.", 403);
  }

  const search = request.nextUrl.searchParams.get("q") ?? undefined;
  try {
    const items = await client.listDocuments(search);
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(
      error instanceof Error ? `Onshape document lookup failed: ${error.message}` : "Onshape document lookup failed.",
      400
    );
  }
}
