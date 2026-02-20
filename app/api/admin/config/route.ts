import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { isAdminUser } from "@/lib/permissions";
import {
  addRobotNumber,
  addSubsystem,
  addTeamNumber,
  listWorkspaceOptions
} from "@/lib/workspace-config";

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("TEAM"),
    teamNumber: z.string().min(1)
  }),
  z.object({
    kind: z.literal("ROBOT"),
    teamNumber: z.string().min(1),
    seasonYear: z.string().min(1),
    robotNumber: z.string().min(1)
  }),
  z.object({
    kind: z.literal("SUBSYSTEM"),
    teamNumber: z.string().min(1),
    seasonYear: z.string().min(1),
    robotNumber: z.string().min(1),
    subsystemNumber: z.string().min(1),
    label: z.string().optional()
  })
]);

export async function GET(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }
  if (!(await isAdminUser(userResult))) {
    return jsonError("Admin access required.", 403);
  }
  const options = await listWorkspaceOptions();
  return NextResponse.json(options);
}

export async function POST(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }
  if (!(await isAdminUser(userResult))) {
    return jsonError("Admin access required.", 403);
  }

  const parsed = await parseJson(request, schema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.kind === "TEAM") {
    await addTeamNumber(parsed.data.teamNumber);
  } else if (parsed.data.kind === "ROBOT") {
    await addRobotNumber(parsed.data.teamNumber, parsed.data.seasonYear, parsed.data.robotNumber);
  } else {
    await addSubsystem(
      parsed.data.teamNumber,
      parsed.data.seasonYear,
      parsed.data.robotNumber,
      parsed.data.subsystemNumber,
      parsed.data.label
    );
  }

  const options = await listWorkspaceOptions();
  return NextResponse.json(options);
}

