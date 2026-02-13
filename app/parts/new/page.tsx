import { prisma } from "@/lib/db";
import { AddPartWizard } from "@/components/add-part-wizard";

export default async function NewPartPage() {
  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.user.findMany({
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" }
    })
  ]);

  return <AddPartWizard projects={projects} users={users} />;
}
