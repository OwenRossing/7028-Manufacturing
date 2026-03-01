export const queryKeys = {
  parts: {
    all: ["parts"] as const,
    list: (queryString: string) => ["parts", queryString] as const
  },
  metrics: {
    all: ["parts-metrics"] as const,
    byProject: (projectId: string | null) => ["parts-metrics", projectId ?? "all"] as const
  },
  me: ["me"] as const
};
