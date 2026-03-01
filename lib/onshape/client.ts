import crypto from "node:crypto";
import { OnshapeCredentialsProvider } from "@/lib/onshape/credentials";
import {
  OnshapeBomFetchResult,
  OnshapeBomRequest,
  OnshapeDocumentOption,
  OnshapeElementOption,
  OnshapeWorkspaceOption
} from "@/lib/onshape/types";

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

function canonicalKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rootValueForKey(raw: Record<string, unknown>, key: string): unknown {
  if (key in raw) return raw[key];
  const target = canonicalKey(key);
  for (const [existingKey, value] of Object.entries(raw)) {
    if (canonicalKey(existingKey) === target) return value;
  }
  return undefined;
}

function deepValueForKeys(raw: unknown, keys: string[]): unknown {
  const targets = new Set(keys.map(canonicalKey));
  const queue: unknown[] = [raw];
  const visited = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      for (const value of current) queue.push(value);
      continue;
    }
    for (const [key, value] of Object.entries(current)) {
      if (targets.has(canonicalKey(key))) return value;
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return undefined;
}

function deepObjects(raw: unknown): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  const queue: unknown[] = [raw];
  const visited = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      for (const value of current) queue.push(value);
      continue;
    }
    const obj = current as Record<string, unknown>;
    output.push(obj);
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return output;
}

function extractLabeledPropertyString(raw: Record<string, unknown>, labels: string[]): string | undefined {
  const labelSet = new Set(labels.map(canonicalKey));
  for (const obj of deepObjects(raw)) {
    const nameLike =
      asText(rootValueForKey(obj, "name")) ??
      asText(rootValueForKey(obj, "propertyName")) ??
      asText(rootValueForKey(obj, "label")) ??
      asText(rootValueForKey(obj, "displayName")) ??
      asText(rootValueForKey(obj, "title"));
    if (!nameLike || !labelSet.has(canonicalKey(nameLike))) continue;
    const value =
      asText(rootValueForKey(obj, "value")) ??
      asText(rootValueForKey(obj, "displayValue")) ??
      asText(rootValueForKey(obj, "formattedValue")) ??
      asText(rootValueForKey(obj, "text"));
    if (value) return value;
  }
  return undefined;
}

function extractLabeledPropertyNumber(raw: Record<string, unknown>, labels: string[]): number | undefined {
  const labelSet = new Set(labels.map(canonicalKey));
  for (const obj of deepObjects(raw)) {
    const nameLike =
      asText(rootValueForKey(obj, "name")) ??
      asText(rootValueForKey(obj, "propertyName")) ??
      asText(rootValueForKey(obj, "label")) ??
      asText(rootValueForKey(obj, "displayName")) ??
      asText(rootValueForKey(obj, "title"));
    if (!nameLike || !labelSet.has(canonicalKey(nameLike))) continue;
    const value =
      asNumber(rootValueForKey(obj, "value")) ??
      asNumber(rootValueForKey(obj, "displayValue")) ??
      asNumber(rootValueForKey(obj, "formattedValue")) ??
      asNumber(rootValueForKey(obj, "text"));
    if (typeof value === "number") return value;
  }
  return undefined;
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asText(rootValueForKey(raw, key));
    if (value) return value;
  }
  const deepValue = asText(deepValueForKeys(raw, keys));
  if (deepValue) return deepValue;
  return undefined;
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = asNumber(rootValueForKey(raw, key));
    if (typeof value === "number") return value;
  }
  const deepValue = asNumber(deepValueForKeys(raw, keys));
  if (typeof deepValue === "number") return deepValue;
  return undefined;
}

function firstArrayCandidate(payload: unknown): unknown[] {
  const isLikelyColumnDefinition = (value: unknown): boolean => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = new Set(Object.keys(value as Record<string, unknown>).map(canonicalKey));
    const hasColumnIdentity = keys.has("propertyname") || keys.has("propertyid");
    const hasColumnLabel = keys.has("name") || keys.has("title") || keys.has("label");
    const hasRowSignal =
      keys.has("cells") ||
      keys.has("partnumber") ||
      keys.has("itemnumber") ||
      keys.has("quantity") ||
      keys.has("partid") ||
      keys.has("itemid");
    return hasColumnIdentity && hasColumnLabel && !hasRowSignal;
  };

  const shouldUseArrayCandidate = (candidate: unknown): candidate is unknown[] => {
    if (!Array.isArray(candidate) || !candidate.length) return false;
    const objectItems = candidate.filter((item) => item && typeof item === "object" && !Array.isArray(item));
    if (!objectItems.length) return true;
    const sample = objectItems.slice(0, 8);
    const columnLikeCount = sample.filter((item) => isLikelyColumnDefinition(item)).length;
    return columnLikeCount < sample.length;
  };

  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const candidates: unknown[] = [
    obj.rows,
    (obj.bomTable as Record<string, unknown> | undefined)?.rows,
    (obj.bomTable as Record<string, unknown> | undefined)?.items,
    (obj.table as Record<string, unknown> | undefined)?.rows,
    (obj.table as Record<string, unknown> | undefined)?.items,
    (obj.result as Record<string, unknown> | undefined)?.rows,
    (obj.result as Record<string, unknown> | undefined)?.items,
    obj.items
  ];
  for (const candidate of candidates) {
    if (shouldUseArrayCandidate(candidate)) return candidate;
  }

  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      if (shouldUseArrayCandidate(current)) {
        return current;
      }
      continue;
    }
    for (const value of Object.values(current)) {
      if (shouldUseArrayCandidate(value)) {
        return value;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return [];
}

function cellScalar(cell: unknown): unknown {
  if (!cell || typeof cell !== "object") return cell;
  const cellObj = cell as Record<string, unknown>;
  return (
    cellObj.value ??
    cellObj.formattedValue ??
    cellObj.displayValue ??
    cellObj.text ??
    cellObj.name ??
    cell
  );
}

function extractColumnNames(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const candidates: unknown[] = [
    obj.columns,
    obj.headers,
    obj.columnDefinitions,
    (obj.bomTable as Record<string, unknown> | undefined)?.columns,
    (obj.table as Record<string, unknown> | undefined)?.columns
  ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const names = candidate
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const raw = item as Record<string, unknown>;
        return (
          asText(raw.name) ??
          asText(raw.title) ??
          asText(raw.label) ??
          asText(raw.propertyName) ??
          asText(raw.id)
        );
      })
      .filter((name): name is string => Boolean(name));
    if (names.length) return names;
  }
  return [];
}

function rowToRecord(raw: unknown, columnNames: string[]): Record<string, unknown> | null {
  if (Array.isArray(raw)) {
    const record: Record<string, unknown> = {};
    raw.forEach((cell, index) => {
      const key = columnNames[index] ?? `col${index + 1}`;
      record[key] = cellScalar(cell);
    });
    return record;
  }
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.cells)) {
    const cellRecord: Record<string, unknown> = {};
    record.cells.forEach((cell, index) => {
      const key = columnNames[index] ?? `col${index + 1}`;
      cellRecord[key] = cellScalar(cell);
    });
    return { ...record, ...cellRecord };
  }
  return record;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function arrayCandidates(payload: unknown, keys: string[]): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((item) => Boolean(item && typeof item === "object")) as Array<Record<string, unknown>>;
  }
  const obj = asObject(payload);
  if (!obj) return [];
  for (const key of keys) {
    const candidate = obj[key];
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
    const canonical = (
      args.method + "\n" +
      args.nonce + "\n" +
      args.date + "\n" +
      "application/json" + "\n" +
      args.path + "\n" +
      args.queryString + "\n"
    ).toLowerCase();
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
    const columnNames = extractColumnNames(payload);
    const rows = sourceRows
      .map((raw, index) => {
        const row = rowToRecord(raw, columnNames);
        if (!row) return null;
        return {
          rowIndex: index + 1,
          partNumber:
            pickString(row, [
              "partNumber",
              "part_number",
              "part number",
              "itemNumber",
              "item_number",
              "item",
              "number"
            ]) ??
            extractLabeledPropertyString(row, ["part number", "partnumber", "item number", "number"]),
          name:
            pickString(row, ["name", "partName", "part_name", "description", "title"]) ??
            extractLabeledPropertyString(row, ["name", "part name", "description"]),
          quantityNeeded:
            pickNumber(row, ["quantity", "qty", "QTY", "count"]) ??
            extractLabeledPropertyNumber(row, ["quantity", "qty", "count"]),
          partId: pickString(row, ["partId", "part_id", "partid"]),
          itemId: pickString(row, ["itemId", "item_id", "id"]),
          raw: row
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    return { rows };
  }

  async listDocuments(search?: string): Promise<OnshapeDocumentOption[]> {
    const payload = await this.requestJson<unknown>({
      path: "/api/documents",
      query: {
        includeRecent: true,
        filter: 0,
        q: search?.trim() || undefined
      }
    });

    const sourceRows = arrayCandidates(payload, ["items", "documents", "results"]);
    return sourceRows
      .map((raw) => {
        const id = pickString(raw, ["id", "documentId", "did"]);
        const name = pickString(raw, ["name", "documentName", "title"]);
        if (!id || !name) return null;
        return { id, name };
      })
      .filter((item): item is OnshapeDocumentOption => Boolean(item));
  }

  async listWorkspaces(documentId: string): Promise<OnshapeWorkspaceOption[]> {
    const payload = await this.requestJson<unknown>({
      path: `/api/documents/d/${encodeURIComponent(documentId)}/workspaces`
    });

    const sourceRows = arrayCandidates(payload, ["items", "workspaces"]);
    return sourceRows
      .map((raw) => {
        const id = pickString(raw, ["id", "workspaceId", "wid"]);
        const name = pickString(raw, ["name", "workspaceName"]) ?? "Unnamed workspace";
        const type = pickString(raw, ["type", "workspaceType"]) ?? "workspace";
        if (!id) return null;
        return { id, name, type };
      })
      .filter((item): item is OnshapeWorkspaceOption => Boolean(item));
  }

  async listElements(documentId: string, workspaceId: string): Promise<OnshapeElementOption[]> {
    const payload = await this.requestJson<unknown>({
      path: `/api/documents/d/${encodeURIComponent(documentId)}/w/${encodeURIComponent(workspaceId)}/elements`
    });

    const sourceRows = arrayCandidates(payload, ["items", "elements"]);
    return sourceRows
      .map((raw) => {
        const id = pickString(raw, ["id", "elementId", "eid"]);
        const name = pickString(raw, ["name", "elementName"]) ?? "Unnamed element";
        const elementType = pickString(raw, ["elementType", "type"]) ?? "UNKNOWN";
        if (!id) return null;
        return { id, name, elementType };
      })
      .filter((item): item is OnshapeElementOption => Boolean(item));
  }
}
