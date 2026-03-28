import { prisma } from "@/lib/db";

async function wipeParts() {
  try {
    console.log("🗑️  Wiping parts database (keeping users & projects)...\n");

    const partPhotoCount = await prisma.partPhoto.deleteMany();
    console.log(`✓ Deleted ${partPhotoCount.count} part photos`);

    const partThumbnailCount = await prisma.partThumbnail.deleteMany();
    console.log(`✓ Deleted ${partThumbnailCount.count} part thumbnails`);

    const partOwnerCount = await prisma.partOwner.deleteMany();
    console.log(`✓ Deleted ${partOwnerCount.count} part owners`);

    const partEventCount = await prisma.partEvent.deleteMany();
    console.log(`✓ Deleted ${partEventCount.count} part events`);

    const importRowCount = await prisma.importRow.deleteMany();
    console.log(`✓ Deleted ${importRowCount.count} import rows`);

    const importBatchCount = await prisma.importBatch.deleteMany();
    console.log(`✓ Deleted ${importBatchCount.count} import batches`);

    const partCount = await prisma.part.deleteMany();
    console.log(`✓ Deleted ${partCount.count} parts`);

    console.log("\n✅ Parts database wiped successfully!");
    console.log("✓ All users and projects preserved");
  } catch (error) {
    console.error("❌ Error wiping parts:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

wipeParts();
