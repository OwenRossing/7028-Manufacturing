import { Card } from "@/components/ui/card";

export default function RootLoading() {
  return (
    <section className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="h-24 animate-pulse border-steel-700/50 bg-steel-800/70" />
      ))}
    </section>
  );
}
