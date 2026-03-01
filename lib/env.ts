import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  DATABASE_URL_PRODUCTION: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required."),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1, "NEXT_PUBLIC_GOOGLE_CLIENT_ID is required."),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  DEMO_SESSION_COOKIE: z.string().min(1).default("demo_session_id"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 14),
  ADMIN_EMAILS: z.string().default(""),
  ONSHAPE_BASE_URL: z.string().url().optional(),
  ONSHAPE_ACCESS_KEY: z.string().optional(),
  ONSHAPE_SECRET_KEY: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  STORAGE_KEY_PREFIX: z.string().default(""),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  APP_MODE: z.enum(["demo", "production"]).optional(),
  NEXT_PUBLIC_APP_MODE: z.enum(["demo", "production"]).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => issue.message).join(" ");
  throw new Error(`Invalid environment configuration. ${details}`);
}

export const env = parsed.data;
