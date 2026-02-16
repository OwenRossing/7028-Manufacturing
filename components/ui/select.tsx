import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-10 w-full rounded-[3px] border border-[#253041] bg-[#25272d] px-3 text-sm text-[#c7d5e0] outline-none transition focus:border-[#4b6988] focus:bg-[#1d2026] focus:shadow-[inset_0_1px_2px_rgba(0,0,0,0.65),inset_0_-1px_0_rgba(255,255,255,0.04)]",
          className
        )}
        {...props}
      />
    );
  }
);
