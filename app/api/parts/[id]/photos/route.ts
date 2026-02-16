import { PartEventType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { NoopImageProcessingProvider } from "@/lib/image/provider";
import { deleteUpload, saveUpload } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = Number.parseInt(process.env.MAX_UPLOAD_MB ?? "10", 10) * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const imageProcessor = new NoopImageProcessingProvider();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userResult = requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { id } = await params;
  const part = await prisma.part.findUnique({ where: { id }, select: { id: true } });
  if (!part) {
    return jsonError("Part not found.", 404);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Missing image file.", 400);
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return jsonError("Unsupported file type. Use JPEG/PNG/WEBP.", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError(`File too large. Max ${process.env.MAX_UPLOAD_MB ?? "10"} MB.`, 400);
  }

  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const processed = await imageProcessor.process({
    bytes: originalBytes,
    mimeType: file.type
  });
  const saved = await saveUpload({
    bytes: processed.bytes,
    originalName: file.name
  });

  const event = await prisma.partEvent.create({
    data: {
      partId: id,
      actorUserId: userResult,
      eventType: PartEventType.PHOTO_ADDED
    }
  });

  const photo = await prisma.partPhoto.create({
    data: {
      partId: id,
      eventId: event.id,
      storageKey: saved.storageKey,
      originalName: file.name,
      mimeType: processed.mimeType,
      uploadedById: userResult
    }
  });

  const updatedPart = await prisma.part.findUnique({
    where: { id },
    include: {
      owners: { include: { user: true }, orderBy: { role: "asc" } },
      photos: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  return NextResponse.json({
    photo: {
      id: photo.id,
      storageKey: photo.storageKey,
      publicPath: saved.publicPath
    },
    part: updatedPart
  });
}

const deleteSchema = z.object({
  photoId: z.string().min(1)
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userResult = requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { id } = await params;
  const payload = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("photoId is required.", 400);
  }

  const photo = await prisma.partPhoto.findFirst({
    where: { id: parsed.data.photoId, partId: id },
    select: { id: true, storageKey: true }
  });
  if (!photo) {
    return jsonError("Photo not found.", 404);
  }

  await prisma.partPhoto.delete({ where: { id: photo.id } });
  await deleteUpload(photo.storageKey);
  return NextResponse.json({ success: true });
}
