import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-steel-700 bg-gradient-to-b from-steel-800 to-steel-900 p-4 shadow-panel",
        className
      )}
      {...props}
    />
  );
}
