"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useDetailLeague } from "@/components/pokedex/detail-league-context";
import { PokemonMetricPill } from "@/components/pokedex/pokemon-metric-pill";
import { TypeBadge } from "@/components/pokedex/type-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PokemonRow } from "@/lib/normalize";
import {
  type SuggestedTeammateEntry,
  type TeammateLeagueMode,
} from "@/lib/teammates";
import { formatTypeName, getDefensiveMatchups, type GoPokemonType } from "@/lib/type-effectiveness";

type CompactPokemon = Pick<PokemonRow, "nat" | "name" | "type1" | "type2" | "spriteUrl">;

function buildTeammateId(entry: SuggestedTeammateEntry): string {
  return `${entry.row.nat}::${entry.row.name}`;
}

function getResistancesByType(row: Pick<PokemonRow, "type1" | "type2">): Map<GoPokemonType, number> {
  return new Map(
    getDefensiveMatchups(row.type1, row.type2).resistances.map((item) => [item.attackType, item.multiplier]),
  );
}

function uniqueTypes(rows: Array<Pick<PokemonRow, "type1" | "type2">>): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const types = [row.type1, row.type2].filter(Boolean) as string[];
    for (const type of types) {
      values.add(type);
    }
  }
  return [...values];
}

function getListSpriteUrl(nat: string, spriteUrl?: string): string | undefined {
  const parsedNat = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsedNat) && parsedNat > 0) {
    const dexId = Math.floor(parsedNat);
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
  }

  return spriteUrl;
}

export function TeamBuilderCard({
  target,
  teammatesByLeague,
}: {
  target: CompactPokemon;
  teammatesByLeague: Record<TeammateLeagueMode, SuggestedTeammateEntry[]>;
}) {
  const { league } = useDetailLeague();
  const selectedLeague = league as TeammateLeagueMode;
  const [slotAOverride, setSlotAOverride] = useState<string | null>(null);
  const [slotBOverride, setSlotBOverride] = useState<string | null>(null);

  const options = useMemo(
    () => (teammatesByLeague[selectedLeague] ?? []).slice(0, 18),
    [selectedLeague, teammatesByLeague],
  );

  const optionById = useMemo(() => {
    const map = new Map<string, SuggestedTeammateEntry>();
    for (const entry of options) {
      map.set(buildTeammateId(entry), entry);
    }
    return map;
  }, [options]);

  const defaultA = options[0] ? buildTeammateId(options[0]) : "";
  const defaultB = options[1] ? buildTeammateId(options[1]) : "";
  const slotA = slotAOverride && optionById.has(slotAOverride) ? slotAOverride : defaultA;
  const slotBBase = slotBOverride && optionById.has(slotBOverride) ? slotBOverride : defaultB;
  const slotB = slotBBase === slotA ? "" : slotBBase;

  const pickedA = slotA ? optionById.get(slotA) ?? null : null;
  const pickedB = slotB ? optionById.get(slotB) ?? null : null;
  const picks = [pickedA, pickedB].filter(Boolean) as SuggestedTeammateEntry[];
  const coreIconUrl = getListSpriteUrl(target.nat, target.spriteUrl);

  const targetWeaknesses = useMemo(
    () => getDefensiveMatchups(target.type1, target.type2).weaknesses,
    [target.type1, target.type2],
  );

  const coverage = useMemo(() => {
    if (targetWeaknesses.length === 0) {
      return {
        score: 1,
        covered: [] as GoPokemonType[],
        uncovered: [] as GoPokemonType[],
        avgLeagueFit: 0,
        avgCoverage: 0,
      };
    }

    const resistances = picks.map((entry) => getResistancesByType(entry.row));
    let totalWeight = 0;
    let coveredWeight = 0;
    const covered: GoPokemonType[] = [];
    const uncovered: GoPokemonType[] = [];

    for (const weakness of targetWeaknesses) {
      totalWeight += weakness.multiplier;
      const isCovered = resistances.some((map) => map.has(weakness.attackType));

      if (isCovered) {
        covered.push(weakness.attackType);
        coveredWeight += weakness.multiplier;
      } else {
        uncovered.push(weakness.attackType);
      }
    }

    const weightedCoverage = totalWeight > 0 ? coveredWeight / totalWeight : 0;
    const avgLeagueFit =
      picks.length > 0
        ? picks.reduce((sum, entry) => sum + entry.leagueFit, 0) / picks.length
        : 0;
    const avgCoverage =
      picks.length > 0
        ? picks.reduce((sum, entry) => sum + entry.coverage, 0) / picks.length
        : 0;
    const diversity = uniqueTypes([target, ...picks.map((entry) => entry.row)]).length / 6;

    const score = weightedCoverage * 0.68 + avgLeagueFit * 0.22 + Math.min(1, diversity) * 0.1;

    return {
      score,
      covered,
      uncovered,
      avgLeagueFit,
      avgCoverage,
    };
  }, [picks, target, targetWeaknesses]);

  return (
    <Card data-testid="team-builder-card" data-current-league={selectedLeague}>
      <CardHeader>
        <div>
          <CardTitle className="text-lg">Team Builder (3 Slots)</CardTitle>
          <p className="text-muted-foreground text-sm">
            Lock {target.name} and pick two teammates. Score favors weakness coverage + league fit.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Badge variant="outline" className="h-9 justify-start gap-1.5 px-3">
            {coreIconUrl ? (
              <Image
                src={coreIconUrl}
                alt={target.name}
                width={24}
                height={24}
                unoptimized
                className="size-6 object-contain"
              />
            ) : null}
            <span>Core: {target.name}</span>
          </Badge>
          <Select value={slotA} onValueChange={setSlotAOverride}>
            <SelectTrigger aria-label="Teammate slot one">
              <SelectValue placeholder="Pick teammate #1" />
            </SelectTrigger>
            <SelectContent>
              {options.map((entry) => {
                const id = buildTeammateId(entry);
                const iconUrl = getListSpriteUrl(entry.row.nat, entry.row.spriteUrl);
                return (
                  <SelectItem key={id} value={id}>
                    <span className="inline-flex items-center gap-2">
                      {iconUrl ? (
                        <Image
                          src={iconUrl}
                          alt={entry.row.name}
                          width={20}
                          height={20}
                          unoptimized
                          className="size-5 object-contain"
                        />
                      ) : (
                        <span className="bg-muted size-5 rounded-full" />
                      )}
                      <span>{entry.row.name}</span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={slotB} onValueChange={setSlotBOverride}>
            <SelectTrigger aria-label="Teammate slot two">
              <SelectValue placeholder="Pick teammate #2" />
            </SelectTrigger>
            <SelectContent>
              {options
                .filter((entry) => buildTeammateId(entry) !== slotA)
                .map((entry) => {
                  const id = buildTeammateId(entry);
                  const iconUrl = getListSpriteUrl(entry.row.nat, entry.row.spriteUrl);
                  return (
                    <SelectItem key={id} value={id}>
                      <span className="inline-flex items-center gap-2">
                        {iconUrl ? (
                          <Image
                            src={iconUrl}
                            alt={entry.row.name}
                            width={20}
                            height={20}
                            unoptimized
                            className="size-5 object-contain"
                          />
                        ) : (
                          <span className="bg-muted size-5 rounded-full" />
                        )}
                        <span>{entry.row.name}</span>
                      </span>
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          {picks.map((entry) => {
            return (
              <Link
                key={`selected-${entry.row.nat}-${entry.row.name}`}
                href={`/pokemon/${encodeURIComponent(entry.row.nat)}?league=${selectedLeague}`}
                className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
              >
                <PokemonMetricPill
                  name={entry.row.name}
                  nat={entry.row.nat}
                  spriteUrl={entry.row.spriteUrl}
                  metrics={[
                    { label: "Cov", value: `${Math.round(entry.coverage * 100)}%` },
                    { label: "LFit", value: `${Math.round(entry.leagueFit * 100)}%` },
                  ]}
                />
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Coverage Score {Math.round(coverage.score * 100)}%</Badge>
          <Badge variant="outline">Avg Cov {Math.round(coverage.avgCoverage * 100)}%</Badge>
          <Badge variant="outline">Avg League Fit {Math.round(coverage.avgLeagueFit * 100)}%</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium">Covered Weaknesses</p>
            <div className="flex flex-wrap gap-1.5">
              {coverage.covered.length > 0 ? (
                coverage.covered.map((type) => (
                  <TypeBadge key={`covered-${type}`} type={formatTypeName(type)} />
                ))
              ) : (
                <p className="text-muted-foreground text-xs">No direct coverage yet.</p>
              )}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Uncovered Weaknesses</p>
            <div className="flex flex-wrap gap-1.5">
              {coverage.uncovered.length > 0 ? (
                coverage.uncovered.map((type) => (
                  <TypeBadge key={`uncovered-${type}`} type={formatTypeName(type)} />
                ))
              ) : (
                <p className="text-xs font-medium">Fully covered by selected teammates.</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
