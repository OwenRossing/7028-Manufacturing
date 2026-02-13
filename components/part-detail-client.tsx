"use client";

import { PartStatus } from "@prisma/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { nextStatus } from "@/lib/status";
import { PartListItem } from "@/types/parts";

type OwnerOption = {
  id: string;
  displayName: string;
};

type PartData = {
  id: string;
  status: PartStatus;
  primaryOwnerId: string | null;
  collaboratorIds: string[];
};

export function PartDetailClient({
  part,
  users
}: {
  part: PartData;
  users: OwnerOption[];
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(part.status);
  const [toStatus, setToStatus] = useState<PartStatus>(part.status);
  const [primaryOwnerId, setPrimaryOwnerId] = useState(part.primaryOwnerId ?? "");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(part.collaboratorIds);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const collaboratorOptions = useMemo(
    () => users.filter((user) => user.id !== primaryOwnerId),
    [users, primaryOwnerId]
  );
  const next = nextStatus(status);

  const statusMutation = useMutation({
    mutationFn: async (nextStatus: PartStatus) => {
      const response = await fetch(`/api/parts/${part.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({ toStatus: nextStatus })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } & PartListItem;
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to update status.");
      }
      return data;
    },
    onMutate: async (targetStatus) => {
      setMessage(null);
      setError(null);
      const previousStatus = status;
      setStatus(targetStatus);
      setToStatus(targetStatus);
      return { previousStatus };
    },
    onSuccess: () => {
      setMessage("Status updated.");
      void queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (mutationError: Error, _targetStatus, context) => {
      setError(mutationError.message);
      setStatus(context?.previousStatus ?? part.status);
    }
  });

  const ownersMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/parts/${part.id}/owners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryOwnerId: primaryOwnerId || null,
          collaboratorIds
        })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to update owners.");
      }
      return data;
    },
    onMutate: () => {
      setMessage(null);
      setError(null);
    },
    onSuccess: () => {
      setMessage("Owners updated.");
      void queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (mutationError: Error) => setError(mutationError.message)
  });

  const photoMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/parts/${part.id}/photos`, {
        method: "POST",
        body: formData
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to upload photo.");
      }
      return data;
    },
    onMutate: () => {
      setMessage(null);
      setError(null);
    },
    onSuccess: () => {
      setMessage("Photo uploaded.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      void queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (mutationError: Error) => setError(mutationError.message)
  });

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Status</h3>
        <p className="text-sm text-steel-300">Current: {status}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              if (next) statusMutation.mutate(next);
            }}
            disabled={statusMutation.isPending || !next}
          >
            {statusMutation.isPending
              ? "Saving..."
              : next
              ? `Advance to ${next}`
              : "Final Status Reached"}
          </Button>
          <Select
            value={toStatus}
            onChange={(event) => setToStatus(event.target.value as PartStatus)}
            className="max-w-xs"
          >
            {Object.values(PartStatus).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            onClick={() => statusMutation.mutate(toStatus)}
            disabled={statusMutation.isPending}
          >
            {statusMutation.isPending ? "Saving..." : "Set Manual Status"}
          </Button>
        </div>
        <p className="text-xs text-steel-300">Use manual status only when you need to skip or step back.</p>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Owners</h3>
        <label className="text-sm text-steel-300">Primary owner</label>
        <Select value={primaryOwnerId} onChange={(event) => setPrimaryOwnerId(event.target.value)}>
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName}
            </option>
          ))}
        </Select>
        <label className="text-sm text-steel-300">Collaborators</label>
        <select
          multiple
          value={collaboratorIds}
          onChange={(event) => {
            const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
            setCollaboratorIds(selected);
          }}
          className="h-32 w-full rounded-md border border-steel-700 bg-steel-850 p-2 text-sm text-white"
        >
          {collaboratorOptions.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName}
            </option>
          ))}
        </select>
        <Button onClick={() => ownersMutation.mutate()} disabled={ownersMutation.isPending}>
          {ownersMutation.isPending ? "Saving..." : "Save Owners"}
        </Button>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Attach Photo</h3>
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            const formData = new FormData();
            formData.set("file", file);
            photoMutation.mutate(formData);
          }}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={photoMutation.isPending}
          variant="secondary"
        >
          {photoMutation.isPending ? "Uploading..." : "Add Photo"}
        </Button>
        <p className="text-xs text-steel-300">DONE status requires at least one photo.</p>
      </Card>

      {message ? <p className="text-sm text-green-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
