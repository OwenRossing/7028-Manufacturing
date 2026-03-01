import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { isAdminUser } from "@/lib/permissions";
import { normalizeSeasonYear } from "@/lib/part-number";

const createSchema = z.object({
  name: z.string().min(2),
  season: z.string().min(1)
});

export async function GET(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const items = await prisma.project.findMany({
    select: { id: true, name: true, season: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }
  const isAdmin = await isAdminUser(userResult);
  if (!isAdmin) {
    return jsonError("Admin access required.", 403);
  }

  const parsed = await parseJson(request, createSchema);
  if (!parsed.ok) {
    return parsed.response;
  }
  const season = normalizeSeasonYear(parsed.data.season);
  if (!season) {
    return jsonError("Season year is required.", 400);
  }

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      season
    }
  });

  return NextResponse.json(project, { status: 201 });
}
