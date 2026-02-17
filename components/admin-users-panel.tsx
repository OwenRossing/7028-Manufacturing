"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  isAdmin: boolean;
  isSelf: boolean;
};

type UsersResponse = {
  items: AdminUser[];
};

export function AdminUsersPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Unable to load users.");
      }
      return (await response.json()) as UsersResponse;
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async (payload: { userId: string; isAdmin: boolean }) => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Unable to update admin status.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    }
  });

  return (
    <div className="space-y-3 rounded-[3px] border border-[#31465f] bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Admin Accounts</h2>
        <p className="text-sm text-steel-300">Promote or demote team admins.</p>
      </div>

      {query.isLoading ? <p className="text-sm text-steel-300">Loading users...</p> : null}
      {query.error ? <p className="text-sm text-red-300">{query.error.message}</p> : null}

      <div className="space-y-2">
        {(query.data?.items ?? []).map((user) => (
          <div key={user.id} className="flex items-center justify-between rounded-[3px] border border-[#31465f] bg-[#1d2633] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-[#d6e4f2]">{user.displayName}</p>
              <p className="truncate text-xs text-[#9fb0c2]">{user.email}</p>
            </div>
            <button
              type="button"
              disabled={toggleMutation.isPending || user.isSelf}
              onClick={() => toggleMutation.mutate({ userId: user.id, isAdmin: !user.isAdmin })}
              className={`rounded-[3px] border px-2 py-1 text-xs ${
                user.isAdmin
                  ? "border-[#1a9fff] bg-[#1a9fff]/25 text-[#d7efff]"
                  : "border-[#435266] bg-[#3a4659] text-[#c7d5e0]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {user.isSelf ? "You" : user.isAdmin ? "Admin" : "User"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
