export type AppMode = "demo" | "local" | "production";

function normalizeMode(value: string | undefined): AppMode {
  if (value?.toLowerCase() === "demo") return "demo";
  if (value?.toLowerCase() === "local") return "local";
  return "production";
}

export function appMode(): AppMode {
  return normalizeMode(process.env.APP_MODE);
}

export function isDemoMode(): boolean {
  return appMode() === "demo";
}

export function isLocalMode(): boolean {
  return appMode() === "local";
}

export function isProductionMode(): boolean {
  return appMode() === "production";
}
