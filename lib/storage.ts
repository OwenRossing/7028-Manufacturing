import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveUpload(params: {
  bytes: Uint8Array;
  originalName: string;
}): Promise<{ storageKey: string; publicPath: string }> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = params.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${Date.now()}-${safeName}`;
  const finalPath = path.join(UPLOAD_DIR, storageKey);
  await writeFile(finalPath, params.bytes);
  return { storageKey, publicPath: `/uploads/${storageKey}` };
}

export async function deleteUpload(storageKey: string): Promise<void> {
  const finalPath = path.join(UPLOAD_DIR, storageKey);
  await rm(finalPath, { force: true });
}
