"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProjectOption = {
  id: string;
  name: string;
};

type ProjectDrawerProps = {
  projects: ProjectOption[];
  activeProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onCreateProject: (name: string) => Promise<void>;
};

export function ProjectDrawer({
  projects,
  activeProjectId,
  onProjectSelect,
  onCreateProject
}: ProjectDrawerProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitProject() {
    if (!name.trim()) return;
    setLoading(true);
    await onCreateProject(name.trim());
    setName("");
    setLoading(false);
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="relative z-10 whitespace-nowrap">
        Projects
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm">
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-steel-700 bg-steel-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Projects</h2>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mb-4 space-y-2">
              {projects.map((project) => (
                <button
                  type="button"
                  key={project.id}
                  onClick={() => {
                    onProjectSelect(project.id);
                    setOpen(false);
                  }}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    activeProjectId === project.id
                      ? "border-accent-500 bg-accent-500/10 text-accent-400"
                      : "border-steel-700 bg-steel-850 text-white hover:bg-steel-800"
                  }`}
                >
                  {project.name}
                </button>
              ))}
            </div>
            <div className="space-y-2 border-t border-steel-700 pt-4">
              <p className="text-xs uppercase tracking-wide text-steel-300">Create project</p>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="New project name"
                />
                <Button onClick={submitProject} disabled={loading || !name.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
