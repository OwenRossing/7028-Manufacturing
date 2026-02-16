import type { Metadata } from "next";
import "./globals.css";
import { getUserIdFromCookieStore } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Providers } from "@/components/providers";
import { AppHeader } from "@/components/app-header";
import { PartStatus } from "@prisma/client";
import { AppBottomBar } from "@/components/app-bottom-bar";

export const metadata: Metadata = {
  title: "FRC Parts Tracker Demo",
  description: "Manufactured parts tracker for FRC robotics teams."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = await getUserIdFromCookieStore();
  const [user, projects, partCounts] = await Promise.all([
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true } })
      : Promise.resolve(null),
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.part.groupBy({
      by: ["projectId", "status"],
      _count: { _all: true }
    })
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
            <AppHeader
              userName={user?.displayName ?? null}
              projects={projectsWithHealth}
            />
            <main className="w-full pb-12">{children}</main>
            <AppBottomBar completed={completedParts} total={totalParts} />
          </div>
        </Providers>
      </body>
    </html>
  );
}
