export type WorkspaceTab = "board" | "overview";

export function normalizeWorkspaceTab(tab: string | null): WorkspaceTab {
  if (tab === "overview" || tab === "community") return "overview";
  return "board";
}

export function buildWorkspaceHref(tab: WorkspaceTab, projectId: string | null): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (projectId) params.set("projectId", projectId);
  return `/?${params.toString()}`;
}
