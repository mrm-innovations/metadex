import { Badge } from "@/components/ui/badge";
import type { MetaTier } from "@/lib/gobattlelog";
import { cn } from "@/lib/utils";

const TIER_STYLES: Record<MetaTier, string> = {
  S: "border-emerald-400/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  A: "border-sky-400/60 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  B: "border-amber-400/60 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  C: "border-orange-400/60 bg-orange-500/15 text-orange-700 dark:text-orange-300",
  D: "border-slate-400/60 bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

export function MetaTierBadge({
  tier,
  rank,
  leagueLabel = "GL",
  className,
}: {
  tier: MetaTier;
  rank: number;
  leagueLabel?: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(TIER_STYLES[tier], className)}>
      {leagueLabel} Meta: {tier}-tier #{rank}
    </Badge>
  );
}
