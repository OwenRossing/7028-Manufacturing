"use client";

import { cn } from "@/lib/cn";

interface SpinnerProps {
  className?: string;
  /** Defaults to current text color */
  size?: "xs" | "sm" | "md";
}

const sizeClass = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

export function Spinner({ className, size = "sm" }: SpinnerProps) {
  return (
    <svg
      className={cn("animate-spin shrink-0", sizeClass[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
