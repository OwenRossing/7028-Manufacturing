import { PartStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PartDetailClient } from "@/components/part-detail-client";
import { Card } from "@/components/ui/card";
import { getUserIdFromCookieStore } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";

function latestActorForStatus(
  events: Array<{ toStatus: PartStatus | null; actor: { displayName: string } }>,
  toStatus: PartStatus
): string {
  const event = events.find((item) => item.toStatus === toStatus);
  return event?.actor.displayName ?? "Not recorded";
}

export default async function PartDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUserId = await getUserIdFromCookieStore();
  const [part, users] = await Promise.all([
    prisma.part.findUnique({
      where: { id },
      include: {
        project: true,
        owners: { include: { user: true } },
        photos: { orderBy: { createdAt: "desc" } },
        events: {
          include: { actor: true },
          orderBy: { createdAt: "desc" },
          take: 40
        }
      }
    }),
    prisma.user.findMany({
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true }
    })
  ]);

  if (!part) {
    notFound();
  }

  const primaryOwner = part.owners.find((owner) => owner.role === "PRIMARY");
  const collaboratorIds = part.owners
    .filter((owner) => owner.role === "COLLABORATOR")
    .map((owner) => owner.userId);
  const isOwner = Boolean(currentUserId && part.owners.some((owner) => owner.userId === currentUserId));
  const isAdmin = currentUserId ? await isAdminUser(currentUserId) : false;

  const machinedBy = latestActorForStatus(part.events, PartStatus.MACHINED);
  const finishedBy = latestActorForStatus(part.events, PartStatus.DONE);

  return (
    <section className="space-y-4 p-4">
      <Card className="space-y-1">
        <p className="text-sm uppercase tracking-wide text-steel-300">{part.project.name}</p>
        <h1 className="text-2xl font-bold text-white">Part Detail</h1>
      </Card>

      <PartDetailClient
        part={{
          id: part.id,
          name: part.name,
          partNumber: part.partNumber,
          description: part.description,
          quantityRequired: part.quantityRequired,
          quantityComplete: part.quantityComplete,
          priority: part.priority,
          status: part.status,
          primaryOwnerId: primaryOwner?.userId ?? null,
          collaboratorIds
        }}
        photos={part.photos.map((photo) => ({
          id: photo.id,
          storageKey: photo.storageKey,
          originalName: photo.originalName
        }))}
        users={users}
        isOwner={isOwner}
        isAdmin={isAdmin}
        machinedBy={machinedBy}
        finishedBy={finishedBy}
      />
    </section>
  );
}
