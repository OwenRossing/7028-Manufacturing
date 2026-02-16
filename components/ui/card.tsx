import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[3px] border border-[#253041] bg-[#1f2630] p-4 shadow-panel",
        className
      )}
      {...props}
    />
  );
}
