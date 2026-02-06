import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "person" | "org" | "location" | "date";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-primary text-primary-foreground": variant === "default",
          "bg-secondary text-secondary-foreground": variant === "secondary",
          "border border-border text-foreground": variant === "outline",
          "bg-person/20 text-person": variant === "person",
          "bg-organization/20 text-organization": variant === "org",
          "bg-location/20 text-location": variant === "location",
          "bg-date/20 text-date": variant === "date",
        },
        className
      )}
      {...props}
    />
  );
}
