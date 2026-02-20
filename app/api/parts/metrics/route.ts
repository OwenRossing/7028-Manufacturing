import { Prisma, PartStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api";

function statusValues(searchParams: URLSearchParams): PartStatus[] {
  const values = searchParams.getAll("status");
  return values.filter((value): value is PartStatus =>
    Object.values(PartStatus).includes(value as PartStatus)
  );
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function GET(request: NextRequest) {
  const userResult = await requireUser(request);
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

  const parts = await prisma.part.findMany({
    where,
    select: {
      status: true,
      quantityRequired: true,
      quantityComplete: true,
      createdAt: true
    }
  });

  const totalRequired = parts.reduce((sum, part) => sum + part.quantityRequired, 0);
  const totalComplete = parts.reduce((sum, part) => sum + Math.min(part.quantityComplete, part.quantityRequired), 0);
  const doneParts = parts.filter((part) => part.status === PartStatus.DONE).length;
  const remaining = Math.max(0, totalRequired - totalComplete);

  const oldestPartDate = parts.reduce<Date | null>(
    (oldest, part) => (oldest && oldest < part.createdAt ? oldest : part.createdAt),
    null
  );
  const daysActive = oldestPartDate
    ? Math.max(1, Math.ceil((Date.now() - oldestPartDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const throughputPerDay = daysActive ? totalComplete / daysActive : 0;
  const etaDays = throughputPerDay >= 0.25 && remaining > 0 ? Math.ceil(remaining / throughputPerDay) : null;

  const statusCounts = Object.fromEntries(
    Object.values(PartStatus).map((status) => [status, parts.filter((part) => part.status === status).length])
  );

  return NextResponse.json({
    totalParts: parts.length,
    doneParts,
    totalRequired,
    totalComplete,
    throughputPerDay,
    etaDays,
    etaDate: etaDays ? addDays(new Date(), etaDays).toISOString() : null,
    statusCounts
  });
}
