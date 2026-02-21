import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export type SaveUploadParams = {
  bytes: Uint8Array;
  originalName: string;
};

export type SaveUploadResult = {
  storageKey: string;
  publicUrl: string;
};

export interface StorageProvider {
  save(params: SaveUploadParams): Promise<SaveUploadResult>;
  delete(storageKey: string): Promise<void>;
  getPublicUrl(storageKey: string): string;
}

export class LocalStorageProvider implements StorageProvider {
  async save(params: SaveUploadParams): Promise<SaveUploadResult> {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const safeName = params.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `${Date.now()}-${safeName}`;
    const finalPath = path.join(UPLOAD_DIR, storageKey);
    await writeFile(finalPath, params.bytes);
    return { storageKey, publicUrl: this.getPublicUrl(storageKey) };
  }

  async delete(storageKey: string): Promise<void> {
    const finalPath = path.join(UPLOAD_DIR, storageKey);
    await rm(finalPath, { force: true });
  }

  getPublicUrl(storageKey: string): string {
    return `/uploads/${storageKey}`;
  }
}

export const storageProvider: StorageProvider = new LocalStorageProvider();
