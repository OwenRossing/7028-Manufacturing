import crypto from "node:crypto";
import { OnshapeCredentialsProvider } from "@/lib/onshape/credentials";
import { OnshapeBomFetchResult, OnshapeBomRequest } from "@/lib/onshape/types";

type OnshapeRequestOptions = {
  method?: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asText(raw[key]);
    if (value) return value;
  }
  return undefined;
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = asNumber(raw[key]);
    if (typeof value === "number") return value;
  }
  return undefined;
}

function firstArrayCandidate(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.filter((item) => Boolean(item && typeof item === "object")) as Array<Record<string, unknown>>;
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const candidates: unknown[] = [
    obj.rows,
    obj.items,
    (obj.bomTable as Record<string, unknown> | undefined)?.rows,
    (obj.table as Record<string, unknown> | undefined)?.rows
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => Boolean(item && typeof item === "object")) as Array<Record<string, unknown>>;
    }
  }
  return [];
}

export class OnshapeClient {
  constructor(private readonly credentialsProvider: OnshapeCredentialsProvider) {}

  private buildQueryString(query: OnshapeRequestOptions["query"]): string {
    if (!query) return "";
    const entries = Object.entries(query).filter(([, value]) => value !== undefined);
    if (!entries.length) return "";
    return entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join("&");
  }

  private createAuthorizationHeader(args: {
    accessKey: string;
    secretKey: string;
    method: string;
    path: string;
    queryString: string;
    date: string;
    nonce: string;
  }): string {
    const canonical = [
      args.method.toUpperCase(),
      args.nonce,
      args.date,
      "application/json",
      args.path,
      args.queryString
    ].join("\n");
    const digest = crypto
      .createHmac("sha256", args.secretKey)
      .update(canonical)
      .digest("base64");
    return `On ${args.accessKey}:HmacSHA256:${digest}`;
  }

  async requestJson<T>(options: OnshapeRequestOptions): Promise<T> {
    const credentials = await this.credentialsProvider.getCredentials();
    const queryString = this.buildQueryString(options.query);
    const pathWithQuery = queryString ? `${options.path}?${queryString}` : options.path;
    const url = `${credentials.baseUrl.replace(/\/+$/, "")}${pathWithQuery}`;

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const date = new Date().toUTCString();
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const authHeader = this.createAuthorizationHeader({
        accessKey: credentials.accessKey,
        secretKey: credentials.secretKey,
        method: options.method ?? "GET",
        path: options.path,
        queryString,
        date,
        nonce
      });

      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          Accept: "application/json",
          Date: date,
          "Content-Type": "application/json",
          "On-Nonce": nonce,
          Authorization: authHeader
        },
        cache: "no-store"
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (!RETRYABLE_STATUS.has(response.status) || attempt >= 3) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Onshape request failed (${response.status}). ${detail}`.trim());
      }

      lastError = new Error(`Transient Onshape response ${response.status}`);
      await sleep(250 * 2 ** (attempt - 1));
    }

    throw lastError ?? new Error("Onshape request failed.");
  }

  async fetchAssemblyBom(request: OnshapeBomRequest): Promise<OnshapeBomFetchResult> {
    const payload = await this.requestJson<unknown>({
      path: `/api/assemblies/d/${encodeURIComponent(request.documentId)}/w/${encodeURIComponent(request.workspaceId)}/e/${encodeURIComponent(request.elementId)}/bom`,
      query: {
        includeItemProperties: true,
        includeTopLevelAssemblyRow: false
      }
    });

    const sourceRows = firstArrayCandidate(payload);
    const rows = sourceRows.map((raw, index) => ({
      rowIndex: index + 1,
      partNumber: pickString(raw, [
        "partNumber",
        "part_number",
        "itemNumber",
        "item_number",
        "number"
      ]),
      name: pickString(raw, ["name", "partName", "part_name", "description"]),
      quantityNeeded: pickNumber(raw, ["quantity", "qty", "QTY", "count"]),
      partId: pickString(raw, ["partId", "part_id", "partid"]),
      itemId: pickString(raw, ["itemId", "item_id", "id"]),
      raw
    }));

    return { rows };
  }
}
