import type { Metadata, Viewport } from "next";
import "./globals.css";
import { prisma } from "@/lib/db";
import { Providers } from "@/components/providers";
import { PartStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "FRC Parts Tracker Demo",
  description: "Manufactured parts tracker for FRC robotics teams."
};

export const viewport: Viewport = {
  viewportFit: "cover"
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [projects, partCounts] = await Promise.all([
    prisma.project
      .findMany({
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
        take: 20
      })
      .catch(() => []),
    prisma.part
      .groupBy({
        by: ["projectId", "status"],
        _count: { _all: true }
      })
      .catch(() => [])
  ]);

  const projectMetrics = new Map<string, { total: number; done: number }>();
  for (const row of partCounts) {
    const existing = projectMetrics.get(row.projectId) ?? { total: 0, done: 0 };
    existing.total += row._count._all;
    if (row.status === PartStatus.DONE) existing.done += row._count._all;
    projectMetrics.set(row.projectId, existing);
  }

  const projectsWithHealth = projects.map((project) => {
    const metric = projectMetrics.get(project.id) ?? { total: 0, done: 0 };
    const completion = metric.total > 0 ? metric.done / metric.total : 0;
    const health: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" =
      completion >= 0.75 ? "ON_TRACK" : completion >= 0.4 ? "AT_RISK" : "OFF_TRACK";
    return {
      id: project.id,
      name: project.name,
      health,
      done: metric.done,
      total: metric.total
    };
  });
  const totalParts = partCounts.reduce((sum, row) => sum + row._count._all, 0);
  const completedParts = partCounts
    .filter((row) => row.status === PartStatus.DONE)
    .reduce((sum, row) => sum + row._count._all, 0);

  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen bg-[#1b2838] text-white">
            <AppShell projects={projectsWithHealth} completed={completedParts} total={totalParts}>
              {children}
            </AppShell>
          </div>
        </Providers>
      </body>
    </html>
  );
}
