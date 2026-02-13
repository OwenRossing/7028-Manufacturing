import { Card } from "@/components/ui/card";

export default function PartDetailLoading() {
  return (
    <section className="space-y-3">
      <Card className="h-24 animate-pulse border-steel-700/50 bg-steel-800/70" />
      <Card className="h-40 animate-pulse border-steel-700/50 bg-steel-800/70" />
      <Card className="h-32 animate-pulse border-steel-700/50 bg-steel-800/70" />
    </section>
  );
}
