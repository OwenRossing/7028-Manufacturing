import { MutationToken } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getIdempotentResponse(
  token: string | null,
  scope: string
): Promise<MutationToken | null> {
  if (!token) return null;
  return prisma.mutationToken.findUnique({
    where: {
      token_scope: {
        token,
        scope
      }
    }
  });
}

export async function storeIdempotentResponse(
  token: string | null,
  scope: string,
  responseJson: unknown
): Promise<void> {
  if (!token) return;
  await prisma.mutationToken.create({
    data: {
      token,
      scope,
      responseJson: responseJson as object
    }
  });
}
