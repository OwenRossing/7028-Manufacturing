import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

function loadDotEnvIntoProcess(): void {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalIndex = line.indexOf("=");
    if (equalIndex <= 0) continue;
    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function masked(value: string | undefined): string {
  if (!value) return "(missing)";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function checkPresent(name: string): CheckResult {
  const value = process.env[name]?.trim();
  return {
    name,
    ok: Boolean(value),
    detail: value ? `present (${masked(value)})` : "missing"
  };
}

function checkGoogleClientPair(): CheckResult {
  const server = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const client = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  if (!server || !client) {
    return { name: "Google IDs", ok: false, detail: "GOOGLE_CLIENT_ID or NEXT_PUBLIC_GOOGLE_CLIENT_ID missing" };
  }
  if (server !== client) {
    return { name: "Google IDs", ok: false, detail: "Server/client IDs do not match" };
  }
  const looksLikeGoogleId = /\.apps\.googleusercontent\.com$/.test(server);
  return {
    name: "Google IDs",
    ok: looksLikeGoogleId,
    detail: looksLikeGoogleId ? "matching IDs with expected suffix" : "IDs do not look like Google OAuth client IDs"
  };
}

function checkDatabaseUrlFormat(): CheckResult {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) return { name: "DATABASE_URL format", ok: false, detail: "missing" };
  try {
    const parsed = new URL(value);
    const ok = parsed.protocol === "postgresql:" || parsed.protocol === "postgres:";
    return {
      name: "DATABASE_URL format",
      ok,
      detail: ok ? `${parsed.protocol}//${parsed.hostname}:${parsed.port || "5432"}` : `unsupported protocol ${parsed.protocol}`
    };
  } catch {
    return { name: "DATABASE_URL format", ok: false, detail: "invalid URL format" };
  }
}

async function checkDatabaseTcp(): Promise<CheckResult> {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) return { name: "DATABASE TCP", ok: false, detail: "DATABASE_URL missing" };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { name: "DATABASE TCP", ok: false, detail: "DATABASE_URL invalid" };
  }

  const host = parsed.hostname;
  const port = Number(parsed.port || 5432);
  if (!host || !Number.isFinite(port)) {
    return { name: "DATABASE TCP", ok: false, detail: "cannot determine host/port" };
  }

  const reachable = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });

  return {
    name: "DATABASE TCP",
    ok: reachable,
    detail: reachable ? `reachable at ${host}:${port}` : `unreachable at ${host}:${port}`
  };
}

function createOnshapeAuthHeader(args: {
  accessKey: string;
  secretKey: string;
  method: string;
  path: string;
  queryString: string;
  date: string;
  nonce: string;
}): string {
  const canonical = (
    args.method +
    "\n" +
    args.nonce +
    "\n" +
    args.date +
    "\n" +
    "application/json" +
    "\n" +
    args.path +
    "\n" +
    args.queryString +
    "\n"
  ).toLowerCase();
  const digest = crypto.createHmac("sha256", args.secretKey).update(canonical).digest("base64");
  return `On ${args.accessKey}:HmacSHA256:${digest}`;
}

async function checkOnshapeAuth(): Promise<CheckResult> {
  const accessKey = process.env.ONSHAPE_ACCESS_KEY?.trim();
  const secretKey = process.env.ONSHAPE_SECRET_KEY?.trim();
  const baseUrl = (process.env.ONSHAPE_BASE_URL?.trim() || "https://cad.onshape.com").replace(/\/+$/, "");
  if (!accessKey || !secretKey) {
    return { name: "Onshape auth", ok: false, detail: "ONSHAPE_ACCESS_KEY or ONSHAPE_SECRET_KEY missing" };
  }

  const path = "/api/documents";
  const queryString = "filter=0&includeRecent=true";
  const date = new Date().toUTCString();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const authHeader = createOnshapeAuthHeader({
    accessKey,
    secretKey,
    method: "GET",
    path,
    queryString,
    date,
    nonce
  });

  try {
    const response = await fetch(`${baseUrl}${path}?${queryString}`, {
      method: "GET",
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
      return { name: "Onshape auth", ok: true, detail: `authenticated against ${baseUrl}` };
    }
    const body = (await response.text().catch(() => "")).slice(0, 180);
    return { name: "Onshape auth", ok: false, detail: `HTTP ${response.status} ${body}`.trim() };
  } catch (error) {
    return {
      name: "Onshape auth",
      ok: false,
      detail: error instanceof Error ? error.message : "request failed"
    };
  }
}

function printResults(results: CheckResult[]): void {
  for (const result of results) {
    const state = result.ok ? "PASS" : "FAIL";
    console.log(`[${state}] ${result.name}: ${result.detail}`);
  }
}

async function main(): Promise<void> {
  loadDotEnvIntoProcess();
  const results: CheckResult[] = [];
  results.push(checkPresent("DATABASE_URL"));
  results.push(checkPresent("GOOGLE_CLIENT_ID"));
  results.push(checkPresent("NEXT_PUBLIC_GOOGLE_CLIENT_ID"));
  results.push(checkGoogleClientPair());
  results.push(checkDatabaseUrlFormat());
  results.push(await checkDatabaseTcp());
  results.push(checkPresent("ONSHAPE_ACCESS_KEY"));
  results.push(checkPresent("ONSHAPE_SECRET_KEY"));
  results.push({
    name: "ONSHAPE_BASE_URL",
    ok: true,
    detail: (process.env.ONSHAPE_BASE_URL?.trim() || "https://cad.onshape.com")
  });
  results.push(await checkOnshapeAuth());

  printResults(results);
  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    console.error(`\nCredential test failed (${failed.length} check(s)).`);
    process.exit(1);
  }
  console.log("\nAll credential checks passed.");
}

void main();
