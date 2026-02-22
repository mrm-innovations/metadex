"use client";

import { useEffect, useMemo, useState } from "react";

import { useDetailLeague } from "@/components/pokedex/detail-league-context";
import { MetaTierBadge } from "@/components/pokedex/meta-tier-badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MetaLeague, MetaRankEntry } from "@/lib/gobattlelog";
import { DETAIL_LEAGUE_OPTIONS } from "@/lib/detail-league";

type MetaRankResponse = {
  data: MetaRankEntry | null;
};

export function MetaRankSwitcher({
  nat,
  initialGreatEntry,
}: {
  nat: string;
  initialGreatEntry: MetaRankEntry | null;
}) {
  const { league } = useDetailLeague();
  const [errorByLeague, setErrorByLeague] = useState<Partial<Record<MetaLeague, string>>>({});
  const [entryByLeague, setEntryByLeague] = useState<Partial<Record<MetaLeague, MetaRankEntry | null>>>(
    { great: initialGreatEntry },
  );

  useEffect(() => {
    if (entryByLeague[league] !== undefined) {
      return;
    }

    let cancelled = false;

    fetch(`/api/meta-rank?nat=${encodeURIComponent(nat)}&league=${league}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${league} meta rank (${response.status}).`);
        }
        return (await response.json()) as MetaRankResponse;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setErrorByLeague((prev) => ({ ...prev, [league]: undefined }));
        setEntryByLeague((prev) => ({ ...prev, [league]: payload.data ?? null }));
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setErrorByLeague((prev) => ({
          ...prev,
          [league]: err instanceof Error ? err.message : "Failed to load meta rank.",
        }));
        setEntryByLeague((prev) => ({ ...prev, [league]: null }));
      });

    return () => {
      cancelled = true;
    };
  }, [entryByLeague, league, nat]);

  const selectedLeague = useMemo(
    () => DETAIL_LEAGUE_OPTIONS[league],
    [league],
  );
  const currentEntry = entryByLeague[league];
  const isLoading = currentEntry === undefined;
  const error = errorByLeague[league];

  return (
    <div className="inline-flex flex-wrap items-center gap-2" data-testid="meta-rank-switcher" data-current-league={league}>
      {isLoading ? (
        <Skeleton className="h-7 w-[130px] rounded-full" />
      ) : currentEntry ? (
        <MetaTierBadge
          tier={currentEntry.tier}
          rank={currentEntry.rank}
          leagueLabel={selectedLeague.shortLabel}
        />
      ) : (
        <Badge variant="outline">
          {selectedLeague.shortLabel} Meta: not ranked
        </Badge>
      )}

      {error ? (
        <span className="text-muted-foreground text-[11px]">{error}</span>
      ) : null}
    </div>
  );
}
