import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseJson, requireUser } from "@/lib/api";

const createSchema = z.object({
  name: z.string().min(2),
  season: z.string().min(4).max(4)
});

export async function GET(request: NextRequest) {
  const userResult = requireUser(request);
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
  const userResult = requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const parsed = await parseJson(request, createSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      season: parsed.data.season
    }
  });

  return NextResponse.json(project, { status: 201 });
}
