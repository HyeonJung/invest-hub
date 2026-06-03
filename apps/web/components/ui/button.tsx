import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "dark";
  size?: "sm" | "md" | "lg" | "icon";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-blue-600 text-white shadow-soft hover:bg-blue-500",
        variant === "secondary" && "bg-white/10 text-slate-100 hover:bg-white/15",
        variant === "ghost" && "text-slate-300 hover:bg-white/10 hover:text-white",
        variant === "outline" && "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
        variant === "dark" && "bg-white/10 text-white hover:bg-white/15",
        size === "sm" && "h-9 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-base",
        size === "icon" && "h-10 w-10 p-0",
        className
      )}
      {...props}
    />
  );
}
