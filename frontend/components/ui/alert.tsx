import * as React from "react";

import { cn } from "@/lib/utils";

const styles = {
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  success: "border-success/40 bg-success/10 text-success",
  info: "border-border bg-muted text-foreground",
} as const;

export type AlertVariant = keyof typeof styles;

export function Alert({
  variant = "info",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }) {
  return <div role="alert" className={cn("rounded-md border px-4 py-3 text-sm", styles[variant], className)} {...props} />;
}
