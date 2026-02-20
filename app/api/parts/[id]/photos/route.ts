import { PartEventType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { NoopImageProcessingProvider } from "@/lib/image/provider";
import { deleteUpload, saveUpload } from "@/lib/storage";
import { canManagePart } from "@/lib/permissions";
import { getPartThumbnail, setPartThumbnail } from "@/lib/part-thumbnails";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = Number.parseInt(process.env.MAX_UPLOAD_MB ?? "10", 10) * 1024 * 1024;
const imageProcessor = new NoopImageProcessingProvider();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { id } = await params;
  const part = await prisma.part.findUnique({ where: { id }, select: { id: true } });
  if (!part) {
    return jsonError("Part not found.", 404);
  }
  if (!(await canManagePart(userResult, id))) {
    return jsonError("You do not have permission to upload media for this part.", 403);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Missing image file.", 400);
  }
  if (!(file.type.startsWith("image/") || file.type.startsWith("video/"))) {
    return jsonError("Unsupported file type. Use any image or video format.", 400);
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
  const existingThumb = await getPartThumbnail(id);
  if (!existingThumb) {
    await setPartThumbnail(id, photo.storageKey);
  }

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
      mimeType: photo.mimeType,
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
  const userResult = await requireUser(request);
  if (userResult instanceof NextResponse) {
    return userResult;
  }

  const { id } = await params;
  if (!(await canManagePart(userResult, id))) {
    return jsonError("You do not have permission to delete media for this part.", 403);
  }
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

  const currentThumb = await getPartThumbnail(id);
  await prisma.partPhoto.delete({ where: { id: photo.id } });
  if (currentThumb === photo.storageKey) {
    const fallback = await prisma.partPhoto.findFirst({
      where: { partId: id },
      orderBy: { createdAt: "desc" },
      select: { storageKey: true }
    });
    await setPartThumbnail(id, fallback?.storageKey ?? null);
  }
  await deleteUpload(photo.storageKey);
  return NextResponse.json({ success: true });
}
