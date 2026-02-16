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
        "inline-flex items-center justify-center rounded-[3px] px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "bg-[#66c0f4] text-[#101822] hover:bg-[#8ad1f8] active:bg-[#56afe2]",
        variant === "secondary" &&
          "border border-[#3a4a5d] bg-[#25272d] text-[#c7d5e0] hover:bg-[#3e4047]",
        variant === "ghost" && "text-[#8f98a0] hover:bg-[#2a3241] hover:text-[#c7d5e0]",
        className
      )}
      {...props}
    />
  );
});
