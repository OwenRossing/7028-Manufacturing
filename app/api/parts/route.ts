import { Prisma, PartEventType, PartOwnerRole, PartStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { PART_NUMBER_REGEX, partNumberHint } from "@/lib/part-number";
import { isAdminUser } from "@/lib/permissions";
import { getPartThumbnailMap } from "@/lib/part-thumbnails";

const createSchema = z.object({
  projectId: z.string().min(1),
  partNumber: z.string().regex(PART_NUMBER_REGEX, partNumberHint()),
  name: z.string().min(2),
  description: z.string().optional(),
  quantityRequired: z.number().int().min(1).default(1),
  quantityComplete: z.number().int().min(0).default(0),
  priority: z.number().int().min(1).max(5).default(2),
  primaryOwnerId: z.string().optional(),
  collaboratorIds: z.array(z.string()).default([])
});

function statusValues(searchParams: URLSearchParams): PartStatus[] {
  const values = searchParams.getAll("status");
  return values.filter((value): value is PartStatus =>
    Object.values(PartStatus).includes(value as PartStatus)
  );
}

export async function GET(request: NextRequest) {
  const userResult = requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const qAsStatus =
    q && Object.values(PartStatus).includes(q.toUpperCase() as PartStatus)
      ? (q.toUpperCase() as PartStatus)
      : null;
  const statuses = statusValues(searchParams);
  const projectId = searchParams.get("projectId");
  const ownerId = searchParams.get("ownerId");
  const sort = searchParams.get("sort") ?? "recent";
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Math.min(Number.parseInt(searchParams.get("pageSize") ?? "25", 10), 100);

  const where: Prisma.PartWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { partNumber: { contains: q, mode: "insensitive" } },
            ...(qAsStatus ? [{ status: { equals: qAsStatus } }] : []),
            {
              owners: {
                some: {
                  user: {
                    displayName: { contains: q, mode: "insensitive" }
                  }
                }
              }
            }
          ]
        }
      : {}),
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(projectId ? { projectId } : {}),
    ...(ownerId ? { owners: { some: { userId: ownerId } } } : {})
  };

  const orderBy: Prisma.PartOrderByWithRelationInput[] =
    sort === "name"
      ? [{ name: "asc" }]
      : sort === "status"
      ? [{ status: "asc" }, { updatedAt: "desc" }]
      : sort === "progress"
      ? [{ quantityComplete: "asc" }, { updatedAt: "desc" }]
      : [{ updatedAt: "desc" }];

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
  const thumbMap = await getPartThumbnailMap(parts.map((part) => part.id));

  return NextResponse.json({
    total,
    page,
    pageSize,
    items: parts.map((part) => ({
      ...part,
      thumbnailStorageKey: thumbMap.get(part.id) ?? null
    }))
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

  const isAdmin = await isAdminUser(userResult);
  const effectivePrimaryOwnerId = isAdmin ? parsed.data.primaryOwnerId : userResult;
  const collaboratorIds = [...new Set(parsed.data.collaboratorIds)].filter(
    (id) => id !== effectivePrimaryOwnerId
  );

  let created;
  try {
    created = await prisma.part.create({
      data: {
        projectId: parsed.data.projectId,
        partNumber: parsed.data.partNumber,
        name: parsed.data.name,
        description: parsed.data.description,
        status: PartStatus.DESIGNED,
        quantityRequired: parsed.data.quantityRequired,
        quantityComplete: parsed.data.quantityComplete,
        priority: parsed.data.priority,
        owners:
          effectivePrimaryOwnerId || collaboratorIds.length
            ? {
                create: [
                  ...(effectivePrimaryOwnerId
                    ? [{ userId: effectivePrimaryOwnerId, role: PartOwnerRole.PRIMARY }]
                    : []),
                  ...collaboratorIds.map((userId) => ({
                    userId,
                    role: PartOwnerRole.COLLABORATOR
                  }))
                ]
              }
            : undefined,
        events: {
          create: {
            actorUserId: userResult,
            eventType: PartEventType.CREATED,
            payloadJson: {
              source: "manual-wizard",
              editor: { isOwnerEditor: true, isAdminEditor: isAdmin }
            }
          }
        }
      },
      include: {
        owners: { include: { user: true }, orderBy: { role: "asc" } },
        photos: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("That Part ID already exists in this project.", 409);
    }
    throw error;
  }

  return NextResponse.json(created, { status: 201 });
}
