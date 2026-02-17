export type AppMode = "demo" | "production";

function normalizeMode(value: string | undefined): AppMode {
  if (value?.toLowerCase() === "production") return "production";
  return "demo";
}

export function appMode(): AppMode {
  return normalizeMode(process.env.NEXT_PUBLIC_APP_MODE ?? process.env.APP_MODE);
}

export function isDemoMode(): boolean {
  return appMode() === "demo";
}

export function isProductionMode(): boolean {
  return appMode() === "production";
}
