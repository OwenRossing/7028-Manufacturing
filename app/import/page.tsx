import { prisma } from "@/lib/db";
import { ImportBomClient } from "@/components/import-bom-client";

export default async function ImportPage({
  searchParams
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const params = await searchParams;
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true
    },
    orderBy: { createdAt: "asc" }
  });

  return <ImportBomClient projects={projects} defaultProjectId={params.projectId} />;
}
