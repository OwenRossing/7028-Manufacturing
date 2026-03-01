const configuredBase = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/g, "") ?? "";

export function mediaUrlFromStorageKey(storageKey: string | null | undefined): string {
  if (!storageKey) {
    return "";
  }

  if (/^https?:\/\//i.test(storageKey)) {
    return storageKey;
  }

  if (configuredBase) {
    return `${configuredBase}/${storageKey}`;
  }

  return `/uploads/${storageKey}`;
}
