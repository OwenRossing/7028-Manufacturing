import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const UPLOAD_ROOT = path.resolve(UPLOAD_DIR);

export type SaveUploadParams = {
  bytes: Uint8Array;
  originalName: string;
  mimeType?: string;
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

function trimSlashes(input: string): string {
  return input.replace(/^\/+|\/+$/g, "");
}

function getStorageKey(originalName: string): string {
  const ext = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, "");
  const fileName = `${Date.now()}-${randomUUID()}${ext}`;
  const prefix = trimSlashes(env.STORAGE_KEY_PREFIX);
  return prefix ? `${prefix}/${fileName}` : fileName;
}

function getStorageBaseUrl(): string | null {
  const baseUrl = env.STORAGE_PUBLIC_BASE_URL?.trim();
  if (!baseUrl) return null;
  return baseUrl.replace(/\/+$/g, "");
}

export class LocalStorageProvider implements StorageProvider {
  async save(params: SaveUploadParams): Promise<SaveUploadResult> {
    const storageKey = getStorageKey(params.originalName);
    const finalPath = path.resolve(UPLOAD_DIR, storageKey);
    if (!finalPath.startsWith(UPLOAD_ROOT)) {
      throw new Error("Invalid storage key path.");
    }
    await mkdir(path.dirname(finalPath), { recursive: true });
    await writeFile(finalPath, params.bytes);
    return { storageKey, publicUrl: this.getPublicUrl(storageKey) };
  }

  async delete(storageKey: string): Promise<void> {
    const finalPath = path.resolve(UPLOAD_DIR, storageKey);
    if (!finalPath.startsWith(UPLOAD_ROOT)) return;
    await rm(finalPath, { force: true });
  }

  getPublicUrl(storageKey: string): string {
    return `/uploads/${storageKey}`;
  }
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error("S3 storage requires S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.");
    }
    const publicBaseUrl = getStorageBaseUrl();
    if (!publicBaseUrl) {
      throw new Error("S3 storage requires STORAGE_PUBLIC_BASE_URL.");
    }

    this.bucket = env.S3_BUCKET;
    this.publicBaseUrl = publicBaseUrl;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY
      }
    });
  }

  async save(params: SaveUploadParams): Promise<SaveUploadResult> {
    const storageKey = getStorageKey(params.originalName);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: params.bytes,
        ContentType: params.mimeType
      })
    );
    return { storageKey, publicUrl: this.getPublicUrl(storageKey) };
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey
      })
    );
  }

  getPublicUrl(storageKey: string): string {
    return `${this.publicBaseUrl}/${storageKey}`;
  }
}

function createStorageProvider(): StorageProvider {
  if (env.STORAGE_DRIVER === "s3") {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}

export const storageProvider: StorageProvider = createStorageProvider();
