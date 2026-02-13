import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-10 w-full rounded-md border border-steel-700 bg-steel-850 px-3 text-sm text-white outline-none transition focus:border-brand-500",
          className
        )}
        {...props}
      />
    );
  }
);
