import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectAdminPanel } from "@/components/project-admin-panel";
import { listWorkspaceOptions } from "@/lib/workspace-config";
import { getUserIdFromCookieStore } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";

export default async function ProjectsPage() {
  const userId = await getUserIdFromCookieStore();
  if (!userId || !(await isAdminUser(userId))) {
    redirect("/");
  }

  const [projects, config, users] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        season: true,
        _count: { select: { parts: true } },
        parts: {
          orderBy: { updatedAt: "desc" },
          take: 40,
          select: {
            id: true,
            name: true,
            partNumber: true,
            owners: {
              include: {
                user: {
                  select: { displayName: true }
                }
              },
              orderBy: { role: "asc" }
            }
          }
        }
      }
    }),
    listWorkspaceOptions(),
    prisma.user.findMany({
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" }
    })
  ]);

  return (
    <section className="space-y-4 p-4">
      <h1 className="text-2xl font-bold text-white">Projects</h1>
      <p className="text-sm text-steel-300">Administrative tools for project and part management.</p>
      <ProjectAdminPanel
        config={config}
        users={users}
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          season: project.season,
          partCount: project._count.parts,
          parts: project.parts.map((part) => ({
            id: part.id,
            name: part.name,
            partNumber: part.partNumber,
            machinistId:
              part.owners.find((owner) => owner.role === "PRIMARY")?.userId ?? null,
            collaboratorIds: part.owners
              .filter((owner) => owner.role === "COLLABORATOR")
              .map((owner) => owner.userId),
            machinist:
              part.owners.find((owner) => owner.role === "PRIMARY")?.user.displayName ?? "Unassigned",
            finisher:
              part.owners.find((owner) => owner.role === "COLLABORATOR")?.user.displayName ?? "Unassigned"
          }))
        }))}
      />
    </section>
  );
}
