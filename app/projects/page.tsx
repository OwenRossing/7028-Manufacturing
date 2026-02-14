import { prisma } from "@/lib/db";
import { ProjectAdminPanel } from "@/components/project-admin-panel";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
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
          quantityRequired: true,
          quantityComplete: true
        }
      }
    }
  });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Projects</h1>
      <p className="text-sm text-steel-300">Administrative tools for project and part management.</p>
      <ProjectAdminPanel
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          season: project.season,
          partCount: project._count.parts,
          parts: project.parts
        }))}
      />
    </section>
  );
}
