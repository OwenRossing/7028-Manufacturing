import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <section className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-steel-300">Admin and configuration tools are grouped here.</p>
      </div>

      <Link href="/projects">
        <Card className="clickable-surface space-y-3">
          <h2 className="text-lg font-semibold text-white">Project Management</h2>
          <p className="text-sm text-steel-300">Create projects, edit parts, and run administrative tasks.</p>
          <p className="text-sm font-semibold text-steel-100">Open project management</p>
        </Card>
      </Link>
    </section>
  );
}
