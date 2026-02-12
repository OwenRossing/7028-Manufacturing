import { PartEventType, PartOwnerRole, PartStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, parseJson, requireUser } from "@/lib/api";

const createSchema = z.object({
  projectId: z.string().min(1),
  partNumber: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  quantityRequired: z.number().int().min(1).default(1),
  priority: z.number().int().min(1).max(5).default(2),
  primaryOwnerId: z.string().optional()
});

export async function GET(request: NextRequest) {
  const userResult = requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query")?.trim();
  const rawStatus = searchParams.get("status");
  const status =
    rawStatus && Object.values(PartStatus).includes(rawStatus as PartStatus)
      ? (rawStatus as PartStatus)
      : null;
  const projectId = searchParams.get("projectId");
  const ownerId = searchParams.get("ownerId");
  const sort = searchParams.get("sort") ?? "updatedAt_desc";
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Math.min(Number.parseInt(searchParams.get("pageSize") ?? "25", 10), 100);

  const where = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { partNumber: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(status ? { status } : {}),
    ...(projectId ? { projectId } : {}),
    ...(ownerId
      ? {
          owners: {
            some: { userId: ownerId }
          }
        }
      : {})
  };

  const orderBy =
    sort === "name_asc"
      ? { name: "asc" as const }
      : sort === "name_desc"
      ? { name: "desc" as const }
      : { updatedAt: "desc" as const };

  const [parts, total] = await Promise.all([
    prisma.part.findMany({
      where,
      include: {
        owners: { include: { user: true }, orderBy: { role: "asc" } },
        photos: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy,
      skip: (Math.max(page, 1) - 1) * pageSize,
      take: pageSize
    }),
    prisma.part.count({ where })
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    items: parts
  });
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

  const created = await prisma.part.create({
    data: {
      projectId: parsed.data.projectId,
      partNumber: parsed.data.partNumber,
      name: parsed.data.name,
      description: parsed.data.description,
      status: PartStatus.DESIGNED,
      quantityRequired: parsed.data.quantityRequired,
      priority: parsed.data.priority,
      owners: parsed.data.primaryOwnerId
        ? {
            create: {
              userId: parsed.data.primaryOwnerId,
              role: PartOwnerRole.PRIMARY
            }
          }
        : undefined,
      events: {
        create: {
          actorUserId: userResult,
          eventType: PartEventType.CREATED,
          payloadJson: {
            source: "manual"
          }
        }
      }
    }
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
