import { PartEventType, PartOwnerRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { id } = await params;
  const isAdminEditor = await isAdminUser(userResult);

  const updatedPart = await prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({
      where: { id },
      include: {
        owners: {
          select: { userId: true, role: true }
        }
      }
    });

    if (!part) return { error: jsonError("Part not found.", 404) };

    const primaryOwner = part.owners.find((owner) => owner.role === PartOwnerRole.PRIMARY);
    const collaborators = part.owners.filter((owner) => owner.role === PartOwnerRole.COLLABORATOR);

    if (collaborators.length > 0) {
      return { error: jsonError("Finisher can only be claimed when finisher is unassigned.", 409) };
    }

    await tx.partOwner.create({
      data: {
        partId: id,
        userId: userResult,
        role: PartOwnerRole.COLLABORATOR
      }
    });

    await tx.partEvent.create({
      data: {
        partId: id,
        actorUserId: userResult,
        eventType: PartEventType.OWNERS_CHANGED,
        payloadJson: {
          primaryOwnerId: primaryOwner?.userId ?? null,
          collaboratorIds: [userResult],
          source: "claim-finisher",
          editor: { isOwnerEditor: true, isAdminEditor }
        }
      }
    });

    const partWithOwners = await tx.part.findUnique({
      where: { id },
      include: {
        owners: { include: { user: true }, orderBy: { role: "asc" } },
        photos: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    return { part: partWithOwners };
  });

  if ("error" in updatedPart) {
    return updatedPart.error;
  }

  return NextResponse.json(updatedPart.part);
}
