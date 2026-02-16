"use client";

import { PartStatus } from "@prisma/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  canonicalStatusForStage,
  stageLabel,
  STAGE_ORDER,
  statusToStage,
  type WorkflowStage
} from "@/lib/status";
import { PartListItem } from "@/types/parts";

type OwnerOption = {
  id: string;
  displayName: string;
};

type PartPhoto = {
  id: string;
  storageKey: string;
  originalName: string;
};

type PartData = {
  id: string;
  name: string;
  partNumber: string;
  description: string | null;
  quantityRequired: number;
  quantityComplete: number;
  priority: number;
  status: PartStatus;
  primaryOwnerId: string | null;
  collaboratorIds: string[];
};

function priorityTier(priority: number): "ASAP" | "NORMAL" | "BACKBURNER" {
  if (priority <= 1) return "ASAP";
  if (priority <= 3) return "NORMAL";
  return "BACKBURNER";
}

function tierToPriority(tier: string): number {
  if (tier === "ASAP") return 1;
  if (tier === "BACKBURNER") return 5;
  return 3;
}

function priorityClass(priority: number): string {
  const tier = priorityTier(priority);
  if (tier === "ASAP") return "border-red-400/70 bg-red-500/15 text-red-200";
  if (tier === "NORMAL") return "border-accent-500/70 bg-accent-500/15 text-accent-300";
  return "border-brand-500/70 bg-brand-500/15 text-brand-300";
}

export function PartDetailClient({
  part,
  photos,
  users,
  isOwner,
  isAdmin,
  machinedBy,
  finishedBy
}: {
  part: PartData;
  photos: PartPhoto[];
  users: OwnerOption[];
  isOwner: boolean;
  isAdmin: boolean;
  machinedBy: string;
  finishedBy: string;
}) {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState(part.status);
  const [name, setName] = useState(part.name);
  const [partNumber, setPartNumber] = useState(part.partNumber);
  const [material, setMaterial] = useState(part.description ?? "");
  const [priority, setPriority] = useState(part.priority);
  const [quantityComplete, setQuantityComplete] = useState(part.quantityComplete);
  const [selectedStage, setSelectedStage] = useState<WorkflowStage>(statusToStage(part.status));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [primaryOwnerId, setPrimaryOwnerId] = useState(part.primaryOwnerId ?? "");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(part.collaboratorIds);
  const [partPhotos, setPartPhotos] = useState<PartPhoto[]>(photos);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const collaboratorOptions = useMemo(
    () => users.filter((user) => user.id !== primaryOwnerId),
    [users, primaryOwnerId]
  );
  const isPrivilegedEditor = isOwner || isAdmin;
  const hasPhotos = partPhotos.length > 0;

  const detailsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/parts/${part.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          partNumber: partNumber.trim(),
          description: material.trim() ? material.trim() : null,
          priority
        })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to update part.");
      return data;
    },
    onMutate: () => {
      setMessage(null);
      setError(null);
    },
    onSuccess: () => {
      setMessage("Identity updated.");
      void queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (mutationError: Error) => setError(mutationError.message)
  });

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
      if (!response.ok) throw new Error(data?.error ?? "Unable to update status.");
      return nextStatus;
    },
    onMutate: (nextStatus) => {
      setMessage(null);
      setError(null);
      const previous = status;
      setStatus(nextStatus);
      setSelectedStage(statusToStage(nextStatus));
      return { previous };
    },
    onSuccess: () => {
      setMessage("Stage updated.");
      void queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (mutationError: Error, _variables, context) => {
      setError(mutationError.message);
      setStatus(context?.previous ?? part.status);
      setSelectedStage(statusToStage(context?.previous ?? part.status));
    }
  });

  const progressMutation = useMutation({
    mutationFn: async (nextComplete: number) => {
      const response = await fetch(`/api/parts/${part.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantityComplete: nextComplete })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to update completed count.");
      return nextComplete;
    },
    onMutate: () => {
      setMessage(null);
      setError(null);
    },
    onSuccess: (nextComplete) => {
      setQuantityComplete(nextComplete);
      setMessage("Quantity updated.");
      void queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (mutationError: Error) => setError(mutationError.message)
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
      if (!response.ok) throw new Error(data?.error ?? "Unable to update assignees.");
      return data;
    },
    onMutate: () => {
      setMessage(null);
      setError(null);
    },
    onSuccess: () => {
      setMessage("Assignees updated.");
      void queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (mutationError: Error) => setError(mutationError.message)
  });

  const photoMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/parts/${part.id}/photos`, { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; photo?: { id: string; storageKey: string } }
        | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to upload photo.");
      return data;
    },
    onSuccess: (data) => {
      const uploadedPhoto = data?.photo;
      if (uploadedPhoto) {
        setPartPhotos((prev) => [
          { id: uploadedPhoto.id, storageKey: uploadedPhoto.storageKey, originalName: "Uploaded photo" },
          ...prev
        ]);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Photo uploaded.");
      void queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (mutationError: Error) => setError(mutationError.message)
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const response = await fetch(`/api/parts/${part.id}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to delete photo.");
      return photoId;
    },
    onSuccess: (photoId) => {
      setPartPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
      setMessage("Photo deleted.");
    },
    onError: (mutationError: Error) => setError(mutationError.message)
  });

  const quantityOptions = Array.from({ length: part.quantityRequired + 1 }, (_, index) => index);

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">{name}</h1>
            <p className="text-sm text-steel-200">Material: {material || "Not set"}</p>
            <p className="text-sm text-steel-300">Part #: {partNumber}</p>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityClass(priority)}`}>
                {priorityTier(priority)}
              </span>
              <span className="rounded-full border border-steel-700 bg-steel-900 px-3 py-1 text-xs text-steel-200">
                {quantityComplete}/{part.quantityRequired}
              </span>
              <span className="rounded-full border border-steel-700 bg-steel-900 px-3 py-1 text-xs text-steel-200">
                {stageLabel(statusToStage(status))}
              </span>
            </div>
          </div>
          <div className="space-y-2 rounded-sm border border-steel-700 bg-steel-900 p-3">
            <div className="rounded-sm border border-steel-700 bg-steel-850 p-3 text-sm">
              <p className="text-steel-300">Machined by</p>
              <p className="font-semibold text-white">{machinedBy}</p>
            </div>
            <div className="rounded-sm border border-steel-700 bg-steel-850 p-3 text-sm">
              <p className="text-steel-300">Finished by</p>
              <p className="font-semibold text-white">{finishedBy}</p>
            </div>
          </div>
        </div>

        {!isPrivilegedEditor ? <p className="text-xs text-steel-300">You are not an assignee. Changes are logged.</p> : null}
        {!hasPhotos ? (
          <p className="rounded-sm border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
            Upload a photo before moving to Completed.
          </p>
        ) : null}
        {message ? <p className="text-sm text-green-400">{message}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </Card>

      <section id="part-media" className="space-y-0">
        <button
          type="button"
          onClick={() => setMediaOpen((prev) => !prev)}
          className={`clickable-surface flex w-full items-center justify-between bg-steel-850 px-4 py-3 text-left text-sm font-semibold text-white ${
            mediaOpen ? "rounded-t-xl rounded-b-none border-b-0" : "rounded-xl"
          }`}
        >
          <span>Media</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${mediaOpen ? "rotate-180" : ""}`} />
        </button>
        {mediaOpen ? (
          <Card className="space-y-2 rounded-t-none border-t-0">
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
            <Button onClick={() => fileInputRef.current?.click()} disabled={photoMutation.isPending} variant="secondary">
              {photoMutation.isPending ? "Uploading..." : "Add Photo"}
            </Button>
            <div className="flex flex-wrap gap-3">
              {partPhotos.map((photo) => (
                <div key={photo.id} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/uploads/${photo.storageKey}`}
                    alt={photo.originalName}
                    width={140}
                    height={140}
                    className="rounded-md border border-steel-700 object-cover"
                  />
                  <Button
                    variant="ghost"
                    onClick={() => deletePhotoMutation.mutate(photo.id)}
                    disabled={deletePhotoMutation.isPending}
                    className="h-8 w-full"
                  >
                    <Trash2 className="mr-1 h-4 w-4 text-red-300" />
                    Delete
                  </Button>
                </div>
              ))}
              {partPhotos.length === 0 ? <p className="text-sm text-steel-300">No photos uploaded yet.</p> : null}
            </div>
          </Card>
        ) : null}
      </section>

      <section id="part-settings" className="space-y-0">
        <button
          type="button"
          onClick={() => setSettingsOpen((prev) => !prev)}
          className={`clickable-surface flex w-full items-center justify-between bg-steel-850 px-4 py-3 text-left text-sm font-semibold text-white ${
            settingsOpen ? "rounded-t-xl rounded-b-none border-b-0" : "rounded-xl"
          }`}
        >
          <span>Settings</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
        </button>
        {settingsOpen ? (
          <Card className="rounded-t-none border-t-0 space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-steel-300">Identity</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-steel-300">Name</label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-steel-300">Part #</label>
                  <Input value={partNumber} onChange={(event) => setPartNumber(event.target.value.toUpperCase())} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-steel-300">Material</label>
                  <Input value={material} onChange={(event) => setMaterial(event.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-steel-300">Priority</label>
                  <Select value={priorityTier(priority)} onChange={(event) => setPriority(tierToPriority(event.target.value))}>
                    <option value="BACKBURNER">Backburner</option>
                    <option value="NORMAL">Normal</option>
                    <option value="ASAP">ASAP</option>
                  </Select>
                </div>
              </div>
              <Button onClick={() => detailsMutation.mutate()} disabled={detailsMutation.isPending}>
                {detailsMutation.isPending ? "Saving..." : "Save Identity"}
              </Button>
            </div>

            <div className="space-y-3 border-t border-steel-700 pt-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-steel-300">Workflow</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-steel-300">Stage</label>
                  <Select value={selectedStage} onChange={(event) => setSelectedStage(event.target.value as WorkflowStage)}>
                    {STAGE_ORDER.map((stage) => (
                      <option key={stage} value={stage}>
                        {stageLabel(stage)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-steel-300">Quantity Complete</label>
                  <Select
                    value={String(quantityComplete)}
                    onChange={(event) => setQuantityComplete(Number.parseInt(event.target.value, 10) || 0)}
                  >
                    {quantityOptions.map((value) => (
                      <option key={value} value={value}>
                        {value} / {part.quantityRequired}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => statusMutation.mutate(canonicalStatusForStage(selectedStage))}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending ? "Saving..." : "Update Stage"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => progressMutation.mutate(quantityComplete)}
                  disabled={progressMutation.isPending}
                >
                  {progressMutation.isPending ? "Saving..." : "Update Quantity"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 border-t border-steel-700 pt-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-steel-300">Assignees</h3>
              <label className="text-sm text-steel-300">Primary assignee</label>
              <Select value={primaryOwnerId} onChange={(event) => setPrimaryOwnerId(event.target.value)}>
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </Select>
              <label className="text-sm text-steel-300">Additional assignees</label>
              <div className="space-y-2 rounded-md border border-steel-700 bg-steel-850 p-3">
                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {collaboratorOptions.map((user) => {
                    const checked = collaboratorIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className="clickable-surface flex cursor-pointer items-center justify-between rounded-md bg-steel-850 px-3 py-2 text-sm text-white"
                      >
                        <span>{user.displayName}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCollaboratorIds((prev) =>
                              checked ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                            )
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
              <Button onClick={() => ownersMutation.mutate()} disabled={ownersMutation.isPending}>
                {ownersMutation.isPending ? "Saving..." : "Save Assignees"}
              </Button>
            </div>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
