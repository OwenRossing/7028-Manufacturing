import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function convertPartNumber(value: string): string {
  const next = value.trim();
  const match = next.match(/^(\d{4})-(\d{4})-R(\d+)-(\d{4})$/i);
  if (!match) return next;
  const [, team, year, robot, code] = match;
  const shortYear = year.slice(-2);
  return `${team}-${shortYear}-${robot}-${code}`;
}

async function main() {
  const parts = await prisma.part.findMany({
    select: { id: true, partNumber: true, projectId: true }
  });

  let updated = 0;
  for (const part of parts) {
    const converted = convertPartNumber(part.partNumber);
    if (converted === part.partNumber) continue;
    await prisma.part.update({
      where: { id: part.id },
      data: { partNumber: converted }
    });
    updated += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`Updated ${updated} part numbers.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

