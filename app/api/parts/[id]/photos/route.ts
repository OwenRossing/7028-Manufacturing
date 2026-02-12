import { PartEventType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { NoopImageProcessingProvider } from "@/lib/image/provider";
import { saveUpload } from "@/lib/storage";

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

  return NextResponse.json({
    id: photo.id,
    storageKey: photo.storageKey,
    publicPath: saved.publicPath
  });
}
