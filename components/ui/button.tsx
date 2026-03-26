"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[3px] px-3 py-2 text-sm font-semibold",
        "transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page",
        variant === "primary" &&
          "bg-brand-500 text-steel-950 hover:bg-brand-400 active:bg-brand-500",
        variant === "secondary" &&
          "border border-rim bg-surface-nav text-steel-300 hover:bg-surface-hover hover:border-rim-light",
        variant === "ghost" &&
          "text-ink-dim hover:bg-surface-card hover:text-steel-300",
        className
      )}
      {...props}
    />
  );
});
