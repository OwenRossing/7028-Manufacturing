import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      parts: {
        take: 20,
        orderBy: { updatedAt: "desc" }
      }
    }
  });

  if (!project) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{project.name}</h1>
      <Card>
        <p className="text-sm text-steel-300">Season {project.season}</p>
        <p className="mt-2 text-sm text-steel-300">{project.parts.length} recent parts loaded.</p>
      </Card>
    </section>
  );
}
