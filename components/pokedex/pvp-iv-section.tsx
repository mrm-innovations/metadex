"use client";

import { useMemo } from "react";

import { useDetailLeague } from "@/components/pokedex/detail-league-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DETAIL_LEAGUE_OPTIONS } from "@/lib/detail-league";
import type { PokemonRow } from "@/lib/normalize";
import { getTopPvPIVs, type PvPIvResult } from "@/lib/pvp";
import { cn } from "@/lib/utils";

const TOP_N = 10;

function formatLevel(level: number): string {
  return Number.isInteger(level) ? String(level) : level.toFixed(1);
}

function formatStatProduct(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function hasValidPvPStats(pokemon: PokemonRow): boolean {
  return (
    pokemon.pogoAtk !== null &&
    pokemon.pogoDef !== null &&
    pokemon.pogoHp !== null &&
    pokemon.pogoAtk > 0 &&
    pokemon.pogoDef > 0 &&
    pokemon.pogoHp > 0
  );
}

export function PvPIvSection({ pokemon }: { pokemon: PokemonRow }) {
  const { league } = useDetailLeague();
  const hasValidStats = hasValidPvPStats(pokemon);
  const rows = useMemo<PvPIvResult[]>(() => {
    if (!hasValidStats) {
      return [];
    }

    const cap = DETAIL_LEAGUE_OPTIONS[league].pvpCap;
    return getTopPvPIVs(pokemon, cap, TOP_N);
  }, [hasValidStats, league, pokemon]);

  function getRowHighlightClass(index: number): string | undefined {
    if (index === 0) {
      return "bg-amber-500/10 hover:bg-amber-500/15";
    }
    if (index === 1) {
      return "bg-slate-400/10 hover:bg-slate-400/15";
    }
    if (index === 2) {
      return "bg-orange-500/10 hover:bg-orange-500/15";
    }
    return undefined;
  }

  return (
    <Card data-testid="pvp-section" data-current-league={league}>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="text-lg">PvP IV Rankings</CardTitle>
          <p className="text-muted-foreground text-sm">
            Computed at levels 1.0-50.0 (0.5 steps), ranked by stat product.
          </p>
          <p className="text-muted-foreground text-xs">
            Synced to global league: {DETAIL_LEAGUE_OPTIONS[league].label}.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {!hasValidStats ? (
          <p className="text-muted-foreground text-sm">PoGO stats are missing for this Pokemon, so PvP ranking is unavailable.</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No valid PvP IV combinations found for the selected league.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70">
            <Table data-testid="pvp-table">
              <TableHeader className="bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky top-0 z-10 backdrop-blur">
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead className="min-w-[160px]">IVs (Atk/Def/HP)</TableHead>
                  <TableHead className="w-24 text-right">Level</TableHead>
                  <TableHead className="w-24 text-right">CP</TableHead>
                  <TableHead className="w-40 text-right">Stat Product</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow
                    key={`${row.atkIV}-${row.defIV}-${row.hpIV}-${row.level}`}
                    data-testid={`pvp-row-${index + 1}`}
                    className={getRowHighlightClass(index)}
                  >
                    <TableCell className="font-semibold tabular-nums" data-testid={`pvp-r${index + 1}-rank`}>
                      <span className={cn(index < 3 ? "inline-flex min-w-5 justify-center rounded px-1.5 py-0.5 text-xs" : undefined, index === 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : undefined, index === 1 ? "bg-slate-500/20 text-slate-700 dark:text-slate-200" : undefined, index === 2 ? "bg-orange-500/20 text-orange-700 dark:text-orange-300" : undefined)}>
                        {row.rank}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums" data-testid={`pvp-r${index + 1}-ivs`}>
                      {row.atkIV}/{row.defIV}/{row.hpIV}
                    </TableCell>
                    <TableCell className="text-right tabular-nums" data-testid={`pvp-r${index + 1}-level`}>
                      {formatLevel(row.level)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums" data-testid={`pvp-r${index + 1}-cp`}>
                      {row.cp.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums" data-testid={`pvp-r${index + 1}-sp`}>
                      {formatStatProduct(row.statProduct)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
