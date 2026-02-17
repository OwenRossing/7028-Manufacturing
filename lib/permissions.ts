import { PartOwnerRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isEmailAdmin } from "@/lib/admin-accounts";

export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  if (!user?.email) return false;
  return isEmailAdmin(user.email);
}

export async function canManagePart(userId: string, partId: string): Promise<boolean> {
  if (await isAdminUser(userId)) return true;
  const owner = await prisma.partOwner.findFirst({
    where: {
      partId,
      userId,
      role: { in: [PartOwnerRole.PRIMARY, PartOwnerRole.COLLABORATOR] }
    },
    select: { id: true }
  });
  return Boolean(owner);
}

export async function editorContext(userId: string, partId: string): Promise<{
  isOwnerEditor: boolean;
  isAdminEditor: boolean;
}> {
  const [isAdminEditor, owner] = await Promise.all([
    isAdminUser(userId),
    prisma.partOwner.findFirst({
      where: { partId, userId, role: { in: [PartOwnerRole.PRIMARY, PartOwnerRole.COLLABORATOR] } },
      select: { id: true }
    })
  ]);
  return {
    isOwnerEditor: Boolean(owner),
    isAdminEditor
  };
}
