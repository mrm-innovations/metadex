"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { PokemonMetricPill } from "@/components/pokedex/pokemon-metric-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PokemonRow } from "@/lib/normalize";
import type { SimilarPokemonEntry } from "@/lib/similar";

const INITIAL_VISIBLE = 8;

function formatSimilarity(score: number): string {
  const percent = Math.round(score * 100);
  return `${percent}%`;
}

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

export function SimilarPokemonCard({
  similar,
  currentName,
  target,
  showDeepAnalytics = false,
}: {
  similar: SimilarPokemonEntry[];
  currentName: string;
  target: Pick<PokemonRow, "maxCp50" | "pogoAtk">;
  showDeepAnalytics?: boolean;
}) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const hasMore = similar.length > INITIAL_VISIBLE;
  const visibleItems = expanded || !hasMore ? similar : similar.slice(0, INITIAL_VISIBLE);
  const averageSimilarity =
    similar.length > 0 ? similar.reduce((sum, entry) => sum + entry.score, 0) / similar.length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Similar Pokemon</CardTitle>
        <p className="text-muted-foreground text-sm">
          Based on typing overlap and nearby GO stats relative to {currentName}.
        </p>
        {showDeepAnalytics ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">Avg Similarity {formatSimilarity(averageSimilarity)}</Badge>
            <Badge variant="outline">Pool size {similar.length}</Badge>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {similar.length > 0 ? (
          <>
          <div id={listId} className="flex flex-wrap gap-2.5">
            {visibleItems.map((entry) => {
              return (
                <Link
                  key={`${entry.row.nat}-${entry.row.name}`}
                  href={`/pokemon/${encodeURIComponent(entry.row.nat)}`}
                  className="inline-flex w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 sm:w-auto"
                >
                  <PokemonMetricPill
                    name={entry.row.name}
                    nat={entry.row.nat}
                    spriteUrl={entry.row.spriteUrl}
                    mobileStacked
                    metrics={[
                      { label: "Sim", value: formatSimilarity(entry.score) },
                      ...(showDeepAnalytics
                        ? [
                            {
                              label: "CP",
                              value: formatSigned((entry.row.maxCp50 ?? 0) - (target.maxCp50 ?? 0)),
                            },
                            {
                              label: "ATK",
                              value: formatSigned((entry.row.pogoAtk ?? 0) - (target.pogoAtk ?? 0)),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Link>
              );
            })}
          </div>
          {showDeepAnalytics && hasMore ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              aria-controls={listId}
            >
              {expanded ? "Show less" : `Show ${similar.length - INITIAL_VISIBLE} more`}
            </Button>
          ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No similar Pokemon found in the current dataset.</p>
        )}
      </CardContent>
    </Card>
  );
}
