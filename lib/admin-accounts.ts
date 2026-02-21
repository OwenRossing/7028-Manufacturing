import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

let ensurePromise: Promise<void> | null = null;

function envAdminEmails(): Set<string> {
  const raw = env.ADMIN_EMAILS;
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function ensureAdminTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS app_admin_accounts (
        email TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined);
  }
  return ensurePromise;
}

export async function listDbAdminEmails(): Promise<Set<string>> {
  await ensureAdminTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ email: string }>>(
    "SELECT email FROM app_admin_accounts"
  );
  return new Set(rows.map((row) => row.email.toLowerCase()));
}

export async function listAllAdminEmails(): Promise<Set<string>> {
  const [envSet, dbSet] = await Promise.all([
    Promise.resolve(envAdminEmails()),
    listDbAdminEmails()
  ]);
  return new Set([...envSet, ...dbSet]);
}

export async function isEmailAdmin(email: string): Promise<boolean> {
  const value = email.trim().toLowerCase();
  if (!value) return false;
  const all = await listAllAdminEmails();
  return all.has(value);
}

export async function setEmailAdmin(email: string, isAdmin: boolean): Promise<void> {
  const value = email.trim().toLowerCase();
  if (!value) return;
  await ensureAdminTable();
  if (isAdmin) {
    await prisma.$executeRawUnsafe(
      "INSERT INTO app_admin_accounts (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
      value
    );
    return;
  }
  await prisma.$executeRawUnsafe("DELETE FROM app_admin_accounts WHERE email = $1", value);
}
