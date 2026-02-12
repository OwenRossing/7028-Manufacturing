import Link from "next/link";
import { PartStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { statusLabel } from "@/lib/status";

type HomeProps = {
  searchParams: Promise<{
    query?: string;
    status?: PartStatus;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const status =
    params.status && Object.values(PartStatus).includes(params.status)
      ? params.status
      : undefined;

  const where = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { partNumber: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(status ? { status } : {})
  };

  const [parts, statuses] = await Promise.all([
    prisma.part.findMany({
      where,
      take: 100,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        owners: {
          include: { user: true },
          orderBy: { role: "asc" }
        },
        photos: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    }),
    prisma.project.findMany({
      select: { id: true, name: true }
    })
  ]);

  return (
    <section className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>Parts Explorer</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Amazon-style lookup: search, sort, inspect, then update.
          </p>
        </div>
        <div className="row">
          <span className="chip">{parts.length} shown</span>
          {statuses[0] ? (
            <Link className="chip" href={`/import?projectId=${statuses[0].id}`}>
              Import BOM
            </Link>
          ) : null}
        </div>
      </div>

      <form className="panel form-grid" action="/">
        <label className="stack">
          Search
          <input
            name="query"
            placeholder="Part name or number"
            defaultValue={query}
            autoComplete="off"
          />
        </label>
        <label className="stack">
          Status
          <select name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {Object.values(PartStatus).map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <div className="row" style={{ alignItems: "end" }}>
          <button type="submit">Apply</button>
          <Link className="chip" href="/">
            Reset
          </Link>
        </div>
      </form>

      <div className="panel" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Part</th>
              <th>Number</th>
              <th>Status</th>
              <th>Owners</th>
              <th>Progress</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr key={part.id}>
                <td>
                  <div className="row">
                    {part.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/uploads/${part.photos[0].storageKey}`}
                        alt={part.name}
                        width={44}
                        height={44}
                        style={{ borderRadius: 6, objectFit: "cover", border: "1px solid var(--border)" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "#252f3b"
                        }}
                      />
                    )}
                    <Link href={`/parts/${part.id}`}>{part.name}</Link>
                  </div>
                </td>
                <td>{part.partNumber}</td>
                <td>
                  <span className="chip">{statusLabel(part.status)}</span>
                </td>
                <td>
                  {part.owners
                    .map((owner) =>
                      owner.role === "PRIMARY"
                        ? `${owner.user.displayName} (Primary)`
                        : owner.user.displayName
                    )
                    .join(", ")}
                </td>
                <td>
                  {part.quantityComplete}/{part.quantityRequired}
                </td>
                <td>{part.updatedAt.toLocaleString()}</td>
              </tr>
            ))}
            {parts.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No parts matched this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
