"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useDetailLeague } from "@/components/pokedex/detail-league-context";
import { PokemonMetricPill } from "@/components/pokedex/pokemon-metric-pill";
import { TypeBadge } from "@/components/pokedex/type-badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type SuggestedTeammateEntry,
  type TeammateLeagueMode,
} from "@/lib/teammates";
import {
  formatGoMultiplier,
  formatTypeName,
  getDefensiveMatchups,
  type GoPokemonType,
} from "@/lib/type-effectiveness";

type CompactPokemon = {
  type1: string;
  type2?: string;
  name: string;
};

type ThreatBucket = {
  type: GoPokemonType;
  multiplier: number;
  answers: SuggestedTeammateEntry[];
};

function getThreatResistanceMultiplier(
  entry: SuggestedTeammateEntry,
  threatType: GoPokemonType,
): number {
  const matchup = getDefensiveMatchups(entry.row.type1, entry.row.type2).resistances.find(
    (item) => item.attackType === threatType,
  );
  return matchup?.multiplier ?? 1;
}

function getThreatScore(entry: SuggestedTeammateEntry, threatType: GoPokemonType): number {
  const resistance = getThreatResistanceMultiplier(entry, threatType);
  const resistanceStrength =
    resistance <= 0.390625
      ? 1
      : resistance <= 0.625
        ? 0.72
        : 0;

  return resistanceStrength * 0.58 + entry.coverage * 0.22 + entry.leagueFit * 0.2;
}

function getTypingKey(entry: SuggestedTeammateEntry): string {
  return `${entry.row.type1.toLowerCase()}|${(entry.row.type2 ?? "").toLowerCase()}`;
}

function getEntryKey(entry: SuggestedTeammateEntry): string {
  return `${entry.row.nat}::${entry.row.name}`;
}

function rankAnswersForThreat(
  threatType: GoPokemonType,
  entries: SuggestedTeammateEntry[],
): SuggestedTeammateEntry[] {
  const filtered = entries
    .filter((entry) => entry.coveredWeaknesses.includes(threatType))
    .sort((a, b) => {
      const scoreA = getThreatScore(a, threatType);
      const scoreB = getThreatScore(b, threatType);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      const resistanceA = getThreatResistanceMultiplier(a, threatType);
      const resistanceB = getThreatResistanceMultiplier(b, threatType);
      if (resistanceA !== resistanceB) {
        return resistanceA - resistanceB;
      }

      if (a.leagueFit !== b.leagueFit) {
        return b.leagueFit - a.leagueFit;
      }
      return a.row.name.localeCompare(b.row.name);
    });

  const picked: SuggestedTeammateEntry[] = [];
  const usedTypingKeys = new Set<string>();

  for (const entry of filtered) {
    const typingKey = getTypingKey(entry);
    if (usedTypingKeys.has(typingKey)) {
      continue;
    }
    usedTypingKeys.add(typingKey);
    picked.push(entry);
    if (picked.length >= 4) {
      return picked;
    }
  }

  const pickedKeys = new Set(picked.map((entry) => getEntryKey(entry)));
  for (const entry of filtered) {
    if (pickedKeys.has(getEntryKey(entry))) {
      continue;
    }
    picked.push(entry);
    if (picked.length >= 4) {
      break;
    }
  }

  return picked;
}

function formatResistanceLabel(multiplier: number): string {
  return formatGoMultiplier(multiplier).replace("x", "");
}

export function CounterMatchupsCard({
  target,
  teammatesByLeague,
}: {
  target: CompactPokemon;
  teammatesByLeague: Record<TeammateLeagueMode, SuggestedTeammateEntry[]>;
}) {
  const { league } = useDetailLeague();
  const selectedLeague = league as TeammateLeagueMode;
  const [expandedOverride, setExpandedOverride] = useState<string[] | null>(null);

  const threats = useMemo<ThreatBucket[]>(() => {
    const weaknessTypes = getDefensiveMatchups(target.type1, target.type2).weaknesses.slice(0, 5);
    const candidates = teammatesByLeague[selectedLeague] ?? [];
    return weaknessTypes.map((weakness) => ({
      type: weakness.attackType,
      multiplier: weakness.multiplier,
      answers: rankAnswersForThreat(weakness.attackType, candidates),
    }));
  }, [selectedLeague, target.type1, target.type2, teammatesByLeague]);
  const threatValues = useMemo(
    () => threats.map((threat) => `threat-${threat.type}`),
    [threats],
  );
  const expandedValues = useMemo(() => {
    const base = expandedOverride ?? (threatValues[0] ? [threatValues[0]] : []);
    return base.filter((value) => threatValues.includes(value));
  }, [expandedOverride, threatValues]);
  const allExpanded =
    threatValues.length > 0 && expandedValues.length === threatValues.length;

  return (
    <Card data-testid="counter-matchups-card" data-current-league={selectedLeague}>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg">Counter Matchups</CardTitle>
          <p className="text-muted-foreground text-sm">
            Top threat types against {target.name}, with recommended teammate answers.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpandedOverride(allExpanded ? [] : [...threatValues])}
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {threats.length > 0 ? (
          <Accordion
            type="multiple"
            value={expandedValues}
            onValueChange={(values) => setExpandedOverride(values)}
            className="space-y-2"
          >
            {threats.map((threat) => (
              <AccordionItem
                key={`threat-${threat.type}`}
                value={`threat-${threat.type}`}
                className="overflow-hidden rounded-md border px-3 last:border-b"
              >
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Threat</span>
                    <TypeBadge type={formatTypeName(threat.type)} />
                    <Badge variant="outline">x{Number(threat.multiplier.toFixed(3))}</Badge>
                    <Badge variant="outline" className="text-xs">
                      {threat.answers.length} answers
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {threat.answers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {threat.answers.map((entry) => (
                        <Link
                          key={`${threat.type}-${entry.row.nat}-${entry.row.name}`}
                          href={`/pokemon/${encodeURIComponent(entry.row.nat)}`}
                          className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                        >
                          <PokemonMetricPill
                            name={entry.row.name}
                            nat={entry.row.nat}
                            spriteUrl={entry.row.spriteUrl}
                            metrics={[
                              {
                                label: "Res",
                                value: formatResistanceLabel(
                                  getThreatResistanceMultiplier(entry, threat.type),
                                ),
                              },
                              { label: "Cov", value: `${Math.round(entry.coverage * 100)}%` },
                              { label: "LFit", value: `${Math.round(entry.leagueFit * 100)}%` },
                            ]}
                          />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      No recommended answers in current league pool.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="text-muted-foreground text-sm">No threat data available for this Pokemon.</p>
        )}
      </CardContent>
    </Card>
  );
}
