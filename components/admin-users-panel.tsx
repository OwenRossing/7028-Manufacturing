"use client";

import { useState } from "react";
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
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Unable to delete user.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { displayName: string; email: string }) => {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Unable to create user.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setNewName("");
      setNewEmail("");
      setShowCreate(false);
      setCreateError(null);
    },
    onError: (err: Error) => {
      setCreateError(err.message);
    }
  });

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    createMutation.mutate({ displayName: newName.trim(), email: newEmail.trim() });
  }

  return (
    <div className="space-y-3 rounded-[3px] border border-rim bg-[linear-gradient(135deg,rgba(59,76,99,0.45),rgba(34,44,58,0.88))] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Team Accounts</h2>
          <p className="text-sm text-steel-300">Manage who can access the app.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreate((v) => !v); setCreateError(null); }}
          className="rounded-[3px] border border-[#2f6eb6] bg-brand-600/20 px-3 py-1 text-xs text-ink-bright hover:bg-brand-600/40"
        >
          {showCreate ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {showCreate ? (
        <form onSubmit={submitCreate} className="space-y-2 rounded-[3px] border border-rim bg-surface-card p-3">
          <input
            type="text"
            placeholder="Display name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            className="w-full rounded border border-rim-soft bg-[#151e29] px-3 py-1.5 text-sm text-ink placeholder-ink-dim outline-none focus:border-rim-brand"
          />
          <input
            type="email"
            placeholder="Email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="w-full rounded border border-rim-soft bg-[#151e29] px-3 py-1.5 text-sm text-ink placeholder-ink-dim outline-none focus:border-rim-brand"
          />
          {createError ? <p className="text-xs text-red-400">{createError}</p> : null}
          <button
            type="submit"
            disabled={createMutation.isPending || !newName.trim() || !newEmail.trim()}
            className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createMutation.isPending ? "Creating..." : "Create User"}
          </button>
        </form>
      ) : null}

      {query.isLoading ? <p className="text-sm text-steel-300">Loading users...</p> : null}
      {query.error ? <p className="text-sm text-red-300">{query.error.message}</p> : null}

      <div className="space-y-2">
        {(query.data?.items ?? []).map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-2 rounded-[3px] border border-rim bg-surface-card px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{user.displayName}</p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={toggleMutation.isPending || user.isSelf}
                onClick={() => toggleMutation.mutate({ userId: user.id, isAdmin: !user.isAdmin })}
                className={`rounded-[3px] border px-2 py-1 text-xs ${
                  user.isAdmin
                    ? "border-rim-brand bg-brand-600/25 text-ink-bright"
                    : "border-rim-btn bg-surface-btn text-steel-300"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {user.isSelf ? "You" : user.isAdmin ? "Admin" : "User"}
              </button>
              {!user.isSelf ? (
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => { if (confirm(`Remove ${user.displayName}?`)) deleteMutation.mutate(user.id); }}
                  className="rounded-[3px] border border-[#5a2a2a] bg-[#3a1a1a] px-2 py-1 text-xs text-[#ff9999] hover:bg-[#4a2020] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
