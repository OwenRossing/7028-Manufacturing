import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/permissions";
import { listAllAdminEmails, setEmailAdmin } from "@/lib/admin-accounts";

const patchSchema = z.object({
  userId: z.string().min(1),
  isAdmin: z.boolean()
});

const createSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email()
});

export async function GET(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) return userResult;
  if (!(await isAdminUser(userResult))) return jsonError("Admin access required.", 403);

  const [users, adminEmails] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, displayName: true, createdAt: true },
      orderBy: { createdAt: "asc" }
    }),
    listAllAdminEmails()
  ]);

  return NextResponse.json({
    items: users.map((user: { id: string; email: string; displayName: string; createdAt: Date }) => ({
      ...user,
      isAdmin: adminEmails.has(user.email.toLowerCase()),
      isSelf: user.id === userResult
    }))
  });
}

export async function PATCH(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) return userResult;
  if (!(await isAdminUser(userResult))) return jsonError("Admin access required.", 403);

  const parsed = await parseJson(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true }
  });
  if (!target) return jsonError("User not found.", 404);
  if (target.id === userResult && !parsed.data.isAdmin) {
    return jsonError("You cannot remove your own admin access.", 400);
  }

  await setEmailAdmin(target.email, parsed.data.isAdmin);
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) return userResult;
  if (!(await isAdminUser(userResult))) return jsonError("Admin access required.", 403);

  const parsed = await parseJson(request, createSchema);
  if (!parsed.ok) return parsed.response;

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("A user with that email already exists.", 409);

  const user = await prisma.user.create({
    data: { email, displayName: parsed.data.displayName },
    select: { id: true, email: true, displayName: true, createdAt: true }
  });

  return NextResponse.json({ ok: true, user });
}

export async function DELETE(request: NextRequest) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) return userResult;
  if (!(await isAdminUser(userResult))) return jsonError("Admin access required.", 403);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return jsonError("userId is required.", 400);
  if (userId === userResult) return jsonError("You cannot delete your own account.", 400);

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}
