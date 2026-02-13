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
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "bg-brand-500 text-stone-950 hover:bg-brand-400 active:bg-brand-500/90",
        variant === "secondary" &&
          "border border-steel-700 bg-steel-800 text-white hover:bg-steel-700",
        variant === "ghost" && "text-steel-300 hover:bg-steel-800 hover:text-white",
        className
      )}
      {...props}
    />
  );
});
