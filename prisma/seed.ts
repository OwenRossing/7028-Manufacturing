import { PartOwnerRole, PartStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [alex, riley] = await Promise.all([
    prisma.user.upsert({
      where: { email: "alex@team7028.org" },
      update: {},
      create: {
        email: "alex@team7028.org",
        displayName: "Alex"
      }
    }),
    prisma.user.upsert({
      where: { email: "riley@team7028.org" },
      update: {},
      create: {
        email: "riley@team7028.org",
        displayName: "Riley"
      }
    })
  ]);

  const project = await prisma.project.upsert({
    where: { id: "frc-2026-demo-project" },
    update: {},
    create: {
      id: "frc-2026-demo-project",
      name: "FRC 7028 Robot",
      season: "2026"
    }
  });

  const part = await prisma.part.upsert({
    where: {
      projectId_partNumber: {
        projectId: project.id,
        partNumber: "7028-DRIVE-PLATE-A"
      }
    },
    update: {},
    create: {
      projectId: project.id,
      partNumber: "7028-DRIVE-PLATE-A",
      name: "Drive Plate - A",
      description: "Primary plate for drivetrain assembly.",
      status: PartStatus.MACHINED,
      quantityRequired: 2,
      quantityComplete: 1,
      priority: 1
    }
  });

  await prisma.partOwner.upsert({
    where: {
      partId_userId: {
        partId: part.id,
        userId: alex.id
      }
    },
    update: { role: PartOwnerRole.PRIMARY },
    create: {
      partId: part.id,
      userId: alex.id,
      role: PartOwnerRole.PRIMARY
    }
  });

  await prisma.partOwner.upsert({
    where: {
      partId_userId: {
        partId: part.id,
        userId: riley.id
      }
    },
    update: { role: PartOwnerRole.COLLABORATOR },
    create: {
      partId: part.id,
      userId: riley.id,
      role: PartOwnerRole.COLLABORATOR
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
