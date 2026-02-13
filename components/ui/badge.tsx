import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-steel-700 bg-steel-800 px-2.5 py-1 text-xs font-medium text-steel-300",
        className
      )}
      {...props}
    />
  );
}
