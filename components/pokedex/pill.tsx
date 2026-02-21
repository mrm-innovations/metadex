import type { ReactNode } from "react";
import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const basePillClasses = "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium";

export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn(basePillClasses, "border-transparent", className)}>
      {children}
    </Badge>
  );
}

export function RemovablePill({
  label,
  onRemove,
  ariaLabel,
  className,
  truncate = false,
}: {
  label: string;
  onRemove: () => void;
  ariaLabel: string;
  className?: string;
  truncate?: boolean;
}) {
  return (
    <Badge
      asChild
      variant="outline"
      className={cn(
        basePillClasses,
        "cursor-pointer border-border bg-muted/40 text-foreground transition-colors hover:bg-muted/70",
        className,
      )}
    >
      <button type="button" onClick={onRemove} aria-label={ariaLabel}>
        <span className={cn("min-w-0", truncate ? "max-w-52 truncate" : undefined)}>{label}</span>
        <XIcon className="size-3 shrink-0 opacity-70" />
      </button>
    </Badge>
  );
}
