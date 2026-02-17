import { PrismaClient, PartOwnerRole, PartStatus } from "@prisma/client";

const prisma = new PrismaClient();

const PART_NAMES = [
  "Drive Plate",
  "Belly Pan",
  "Shooter Side Plate",
  "Indexer Bracket",
  "Intake Arm",
  "Elevator Carriage",
  "Swerve Guard",
  "Camera Mount",
  "Battery Tray",
  "Chain Tensioner",
  "Pivot Link",
  "Hood Support",
  "Rail Spacer",
  "Gusset Plate",
  "Gearbox Plate",
  "Motor Mount",
  "Roller Axle",
  "Sensor Bracket",
  "Climber Hook",
  "Bumper Clamp"
];

const PART_MATERIALS = ["6061", "Polycarb", "Steel", "Delrin", "Printed Nylon"];

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function statusFromRoll() {
  const roll = Math.random();
  if (roll < 0.45) return PartStatus.DESIGNED;
  if (roll < 0.7) return PartStatus.MACHINED;
  if (roll < 0.85) return PartStatus.VERIFIED;
  return PartStatus.DONE;
}

function priorityFromRoll() {
  const roll = Math.random();
  if (roll < 0.25) return 1;
  if (roll < 0.7) return 3;
  return 5;
}

async function main() {
  const users = await Promise.all(
    [
      ["alex@team7028.org", "Alex"],
      ["riley@team7028.org", "Riley"],
      ["sam@team7028.org", "Sam"],
      ["jordan@team7028.org", "Jordan"]
    ].map(([email, displayName]) =>
      prisma.user.upsert({
        where: { email },
        update: { displayName },
        create: { email, displayName }
      })
    )
  );

  let projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });
  if (!projects.length) {
    projects = [
      await prisma.project.create({
        data: {
          id: "frc-2026-demo-project",
          name: "FRC 7028 Robot",
          season: "2026"
        }
      })
    ];
  }

  await prisma.partEvent.deleteMany({});
  await prisma.partOwner.deleteMany({});
  await prisma.partPhoto.deleteMany({});
  await prisma.part.deleteMany({});

  const team = "7028";
  const year = "2026";
  let code = 1001;

  for (const project of projects) {
    for (let i = 0; i < 18; i += 1) {
      const baseName = pick(PART_NAMES);
      const variant = String.fromCharCode(65 + (i % 4));
      const partNumber = `${team}-${year}-R1-${String(code).padStart(4, "0")}`;
      code += 1;

      const status = statusFromRoll();
      const quantityRequired = Math.floor(Math.random() * 10) + 1;
      const quantityComplete =
        status === PartStatus.DONE
          ? quantityRequired
          : Math.floor(Math.random() * (quantityRequired + 1));
      const priority = priorityFromRoll();

      const primary = pick(users);
      const additional = users
        .filter((user) => user.id !== primary.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3));

      const part = await prisma.part.create({
        data: {
          projectId: project.id,
          partNumber,
          name: `${baseName} - ${variant}`,
          description: `${pick(PART_MATERIALS)} mock part for testing UI density.`,
          status,
          quantityRequired,
          quantityComplete,
          priority
        }
      });

      await prisma.partOwner.create({
        data: {
          partId: part.id,
          userId: primary.id,
          role: PartOwnerRole.PRIMARY
        }
      });

      if (additional.length) {
        await prisma.partOwner.createMany({
          data: additional.map((user) => ({
            partId: part.id,
            userId: user.id,
            role: PartOwnerRole.COLLABORATOR
          }))
        });
      }
    }
  }

  console.log(
    `Randomized demo data complete. Projects: ${projects.length}, parts per project: 18, events cleared.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

