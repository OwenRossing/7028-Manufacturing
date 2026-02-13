import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, season: true }
  });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Projects</h1>
      <Card className="space-y-2">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-md p-2 hover:bg-steel-800">
            <p className="font-medium text-white">{project.name}</p>
            <p className="text-sm text-steel-300">Season {project.season}</p>
          </Link>
        ))}
      </Card>
    </section>
  );
}
