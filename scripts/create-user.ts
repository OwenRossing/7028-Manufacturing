import { createInterface } from "readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

async function main() {
  console.log("\n── Create User ──────────────────────────\n");

  const email = await ask("Email: ");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Invalid email.");
    process.exit(1);
  }

  const displayName = await ask("Display name: ");
  if (!displayName) {
    console.error("Display name is required.");
    process.exit(1);
  }

  const adminAnswer = await ask("Grant admin? (y/N): ");
  const isAdmin = adminAnswer.toLowerCase() === "y";

  rl.close();

  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    console.error(`\nA user with email "${normalizedEmail}" already exists.`);
    process.exit(1);
  }

  await prisma.user.create({ data: { email: normalizedEmail, displayName } });

  if (isAdmin) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS app_admin_accounts (
        email TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(
      "INSERT INTO app_admin_accounts (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
      normalizedEmail
    );
  }

  console.log(`\nCreated user: ${displayName} <${normalizedEmail}>${isAdmin ? " [admin]" : ""}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
