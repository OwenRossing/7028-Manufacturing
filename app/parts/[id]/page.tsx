import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PartDetailClient } from "@/components/part-detail-client";
import { statusLabel } from "@/lib/status";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function PartDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
          take: 20
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

  return (
    <section className="space-y-4">
      <Card className="space-y-2">
        <h1 className="text-2xl font-bold text-white">{part.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge>{part.partNumber}</Badge>
          <Badge>{statusLabel(part.status)}</Badge>
          <Badge>
            Progress {part.quantityComplete}/{part.quantityRequired}
          </Badge>
          <Badge>{part.project.name}</Badge>
        </div>
        <p className="text-sm text-steel-300">
          {part.description || "No description yet."}
        </p>
      </Card>

      <PartDetailClient
        part={{
          id: part.id,
          status: part.status,
          primaryOwnerId: primaryOwner?.userId ?? null,
          collaboratorIds
        }}
        hasPhoto={part.photos.length > 0}
        users={users}
      />

      <Card className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        <div className="space-y-2">
          {part.events.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-2">
              <span>
                <strong>{event.eventType}</strong> by {event.actor.displayName}
              </span>
              <span className="text-sm text-steel-300">{event.createdAt.toLocaleString()}</span>
            </div>
          ))}
          {part.events.length === 0 ? <p className="text-sm text-steel-300">No events yet.</p> : null}
        </div>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Photos</h3>
        <div className="flex flex-wrap gap-3">
          {part.photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={`/uploads/${photo.storageKey}`}
              alt={photo.originalName}
              width={120}
              height={120}
              className="rounded-md border border-steel-700 object-cover"
            />
          ))}
          {part.photos.length === 0 ? <p className="text-sm text-steel-300">No photos uploaded yet.</p> : null}
        </div>
      </Card>
    </section>
  );
}
