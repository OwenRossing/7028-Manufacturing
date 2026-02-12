import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PartDetailClient } from "@/components/part-detail-client";
import { statusLabel } from "@/lib/status";

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
    <section className="stack">
      <div className="panel stack">
        <h1 style={{ margin: 0 }}>{part.name}</h1>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <span className="chip">{part.partNumber}</span>
          <span className="chip">{statusLabel(part.status)}</span>
          <span className="chip">
            Progress {part.quantityComplete}/{part.quantityRequired}
          </span>
          <span className="chip">{part.project.name}</span>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {part.description || "No description yet."}
        </p>
      </div>

      <PartDetailClient
        part={{
          id: part.id,
          status: part.status,
          primaryOwnerId: primaryOwner?.userId ?? null,
          collaboratorIds
        }}
        users={users}
      />

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Recent Activity</h3>
        <div className="stack">
          {part.events.map((event) => (
            <div key={event.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>
                <strong>{event.eventType}</strong> by {event.actor.displayName}
              </span>
              <span className="muted">{event.createdAt.toLocaleString()}</span>
            </div>
          ))}
          {part.events.length === 0 ? <p className="muted">No events yet.</p> : null}
        </div>
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Photos</h3>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {part.photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={`/uploads/${photo.storageKey}`}
              alt={photo.originalName}
              width={120}
              height={120}
              style={{ objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
            />
          ))}
          {part.photos.length === 0 ? <p className="muted">No photos uploaded yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
