import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ImportBomClient } from "@/components/import-bom-client";
import { getUserIdFromCookieStore } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";

export default async function ImportPage({
  searchParams
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const userId = await getUserIdFromCookieStore();
  if (!userId || !(await isAdminUser(userId))) {
    redirect("/");
  }

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
