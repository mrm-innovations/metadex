"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PokemonRow } from "@/lib/normalize";
import { getTopPvPIVs, type PvPIvResult } from "@/lib/pvp";

type LeagueKey = "great" | "ultra" | "master";

const TOP_N = 10;

const LEAGUE_OPTIONS: Record<LeagueKey, { label: string; cap: number }> = {
  great: { label: "Great League (1500)", cap: 1500 },
  ultra: { label: "Ultra League (2500)", cap: 2500 },
  master: { label: "Master League (No Cap)", cap: Number.POSITIVE_INFINITY },
};

function formatLevel(level: number): string {
  return Number.isInteger(level) ? String(level) : level.toFixed(1);
}

function formatStatProduct(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
  const hasValidStats = hasValidPvPStats(pokemon);
  const initialGreatRows = useMemo(
    () => (hasValidStats ? getTopPvPIVs(pokemon, LEAGUE_OPTIONS.great.cap, TOP_N) : []),
    [hasValidStats, pokemon],
  );

  const [selectedLeague, setSelectedLeague] = useState<LeagueKey>("great");
  const [rows, setRows] = useState<PvPIvResult[]>(initialGreatRows);
  const [isLoading, setIsLoading] = useState(false);
  const localLeagueCache = useRef<Partial<Record<LeagueKey, PvPIvResult[]>>>({
    great: initialGreatRows,
  });
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current);
      }
    },
    [],
  );

  const onLeagueChange = (value: string) => {
    const nextLeague = value as LeagueKey;
    setSelectedLeague(nextLeague);

    if (!hasValidStats) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    const cached = localLeagueCache.current[nextLeague];
    if (cached) {
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current);
      }
      setRows(cached);
      setIsLoading(false);
      return;
    }

    if (loadingTimer.current) {
      clearTimeout(loadingTimer.current);
    }

    setIsLoading(true);
    loadingTimer.current = setTimeout(() => {
      const cap = LEAGUE_OPTIONS[nextLeague].cap;
      const nextRows = getTopPvPIVs(pokemon, cap, TOP_N);
      localLeagueCache.current[nextLeague] = nextRows;
      setRows(nextRows);
      setIsLoading(false);
      loadingTimer.current = null;
    }, 120);
  };

  return (
    <Card data-testid="pvp-section">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg">PvP IV Rankings</CardTitle>
          <p className="text-muted-foreground text-sm">Computed at levels 1.0-50.0 (0.5 steps), ranked by stat product.</p>
          <p className="text-muted-foreground text-xs">Updated instantly on league switch.</p>
        </div>
        <Select value={selectedLeague} onValueChange={onLeagueChange}>
          <SelectTrigger className="w-full sm:w-64" data-testid="pvp-league-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="great">{LEAGUE_OPTIONS.great.label}</SelectItem>
            <SelectItem value="ultra">{LEAGUE_OPTIONS.ultra.label}</SelectItem>
            <SelectItem value="master">{LEAGUE_OPTIONS.master.label}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!hasValidStats ? (
          <p className="text-muted-foreground text-sm">PoGO stats are missing for this Pokemon, so PvP ranking is unavailable.</p>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No valid PvP IV combinations found for the selected league.</p>
        ) : (
          <Table data-testid="pvp-table">
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>IVs (Atk/Def/HP)</TableHead>
                <TableHead className="text-right">Level</TableHead>
                <TableHead className="text-right">CP</TableHead>
                <TableHead className="text-right">Stat Product</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow
                  key={`${row.atkIV}-${row.defIV}-${row.hpIV}-${row.level}`}
                  data-testid={`pvp-row-${index + 1}`}
                  className={index === 0 ? "bg-primary/5 hover:bg-primary/10" : undefined}
                >
                  <TableCell className="font-medium" data-testid={`pvp-r${index + 1}-rank`}>{row.rank}</TableCell>
                  <TableCell data-testid={`pvp-r${index + 1}-ivs`}>{row.atkIV}/{row.defIV}/{row.hpIV}</TableCell>
                  <TableCell className="text-right" data-testid={`pvp-r${index + 1}-level`}>{formatLevel(row.level)}</TableCell>
                  <TableCell className="text-right" data-testid={`pvp-r${index + 1}-cp`}>{row.cp.toLocaleString()}</TableCell>
                  <TableCell className="text-right" data-testid={`pvp-r${index + 1}-sp`}>{formatStatProduct(row.statProduct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
