import { z } from "zod";

// Empty strings in .env should be treated as unset for optional fields.
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalStr = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  GOOGLE_CLIENT_ID: optionalStr,
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  DEMO_SESSION_COOKIE: z.string().min(1).default("demo_session_id"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 14),
  ADMIN_EMAILS: z.string().default(""),
  ONSHAPE_BASE_URL: optionalUrl,
  ONSHAPE_ACCESS_KEY: optionalStr,
  ONSHAPE_SECRET_KEY: optionalStr,
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL: optionalUrl,
  STORAGE_KEY_PREFIX: z.string().default(""),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: optionalStr,
  S3_ACCESS_KEY_ID: optionalStr,
  S3_SECRET_ACCESS_KEY: optionalStr,
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  APP_MODE: z.enum(["demo", "local", "production"]).optional(),
  LOCAL_ENTRY_KEY: optionalStr,
  NODE_ENV: z.enum(["development", "test", "production"]).optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => issue.message).join(" ");
  throw new Error(`Invalid environment configuration. ${details}`);
}

export const env = parsed.data;
