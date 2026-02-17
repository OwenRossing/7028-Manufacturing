import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { listWorkspaceOptions } from "@/lib/workspace-config";

export async function GET(request: NextRequest) {
  const userResult = requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }
  const options = await listWorkspaceOptions();
  return NextResponse.json(options);
}

