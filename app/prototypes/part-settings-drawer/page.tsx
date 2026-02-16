"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PartSettingsDrawerPrototypePage() {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <h1 className="text-2xl font-bold text-white">Prototype: Part Settings Drawer</h1>
        <p className="text-sm text-steel-300">
          UX prototype for opening part settings in a right-side drawer while keeping read-only info visible.
        </p>
        <Button onClick={() => setOpen(true)}>Open Settings Drawer</Button>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Read-Only Overview Mock</h2>
        <p className="text-3xl font-bold text-white">Shooter Side Plate</p>
        <p className="text-steel-300">7028-2026-R1-1102</p>
      </Card>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-steel-700 bg-steel-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Part Settings</h3>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <div className="space-y-3">
              <label className="text-sm text-steel-300">Name</label>
              <Input defaultValue="Shooter Side Plate" />
              <label className="text-sm text-steel-300">Part Number</label>
              <Input defaultValue="7028-2026-R1-1102" />
              <label className="text-sm text-steel-300">Description</label>
              <Input defaultValue="Main shooter side frame plate." />
              <Button>Save</Button>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
