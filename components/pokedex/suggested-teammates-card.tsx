"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { useDetailLeague } from "@/components/pokedex/detail-league-context";
import { Pill } from "@/components/pokedex/pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCoveredTypes,
  type SuggestedTeammateEntry,
  type TeammateLeagueMode,
} from "@/lib/teammates";
import { cn } from "@/lib/utils";

function getListSpriteUrl(nat: string, spriteUrl?: string): string | undefined {
  const parsedNat = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsedNat) && parsedNat > 0) {
    const dexId = Math.floor(parsedNat);
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
  }

  return spriteUrl;
}

function formatCoverageScore(coverage: number): string {
  return `${Math.round(coverage * 100)}%`;
}

function formatLeagueFit(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const INITIAL_VISIBLE = 8;

export function SuggestedTeammatesCard({
  teammatesByLeague,
  currentName,
  showDeepAnalytics = false,
}: {
  teammatesByLeague: Record<TeammateLeagueMode, SuggestedTeammateEntry[]>;
  currentName: string;
  showDeepAnalytics?: boolean;
}) {
  const { league } = useDetailLeague();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const selectedLeague = league as TeammateLeagueMode;
  const selectedTeammates = useMemo(
    () => teammatesByLeague[selectedLeague] ?? [],
    [selectedLeague, teammatesByLeague],
  );
  const hasMore = selectedTeammates.length > INITIAL_VISIBLE;
  const visibleTeammates =
    expanded || !hasMore ? selectedTeammates : selectedTeammates.slice(0, INITIAL_VISIBLE);
  const averageCoverage =
    selectedTeammates.length > 0
      ? selectedTeammates.reduce((sum, entry) => sum + entry.coverage, 0) / selectedTeammates.length
      : 0;
  const averageLeagueFit =
    selectedTeammates.length > 0
      ? selectedTeammates.reduce((sum, entry) => sum + entry.leagueFit, 0) / selectedTeammates.length
      : 0;
  const uniqueCoveredWeaknesses = new Set(
    selectedTeammates.flatMap((entry) => entry.coveredWeaknesses),
  ).size;

  return (
    <Card data-testid="suggested-teammates-card" data-current-league={selectedLeague}>
      <CardHeader>
        <div>
          <CardTitle className="text-lg">Suggested Teammates</CardTitle>
          <p className="text-muted-foreground text-sm">
            Picks that help cover {currentName}&apos;s weaknesses while staying battle-ready in GO.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Ranked by weakness coverage, team diversity, and league fit.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {showDeepAnalytics ? "Each chip shows Coverage, League Fit, and score context." : "Each chip shows Coverage vs League Fit."}
        </p>
        {showDeepAnalytics ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">Avg Cov {formatCoverageScore(averageCoverage)}</Badge>
            <Badge variant="outline">Avg LFit {formatLeagueFit(averageLeagueFit)}</Badge>
            <Badge variant="outline">Distinct covered types {uniqueCoveredWeaknesses}</Badge>
          </div>
        ) : null}
        {selectedTeammates.length > 0 ? (
          <>
          <div id={listId} className="mt-3 flex flex-wrap gap-2.5">
            {visibleTeammates.map((entry) => {
              const iconUrl = getListSpriteUrl(entry.row.nat, entry.row.spriteUrl);
              return (
                <Link
                  key={`${entry.row.nat}-${entry.row.name}`}
                  href={`/pokemon/${encodeURIComponent(entry.row.nat)}`}
                  className="inline-flex w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 sm:w-auto"
                  title={`${formatCoveredTypes(entry.coveredWeaknesses)} | Coverage ${formatCoverageScore(entry.coverage)} | League Fit ${formatLeagueFit(entry.leagueFit)}`}
                >
                  <Pill className="min-h-10 h-auto w-full flex-col items-start gap-1.5 px-3 py-2 text-sm font-semibold sm:h-10 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5 sm:py-0 sm:pr-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      {iconUrl ? (
                        <Image
                          src={iconUrl}
                          alt={entry.row.name}
                          width={24}
                          height={24}
                          unoptimized
                          className="size-6 object-contain"
                        />
                      ) : (
                        <span className="bg-muted size-6 rounded-full" />
                      )}
                      <span className="truncate">{entry.row.name}</span>
                    </span>
                    <span className={cn("text-foreground/80 ml-0 inline-flex flex-wrap items-center gap-1 text-[10px] font-medium sm:ml-1")}>
                      <span className="bg-background/80 rounded border border-border/60 px-1.5 py-0.5">
                        Cov {formatCoverageScore(entry.coverage)}
                      </span>
                      <span className="bg-background/80 rounded border border-border/60 px-1.5 py-0.5">
                        LFit {formatLeagueFit(entry.leagueFit)}
                      </span>
                      {showDeepAnalytics ? (
                        <span className="bg-background/80 rounded border border-border/60 px-1.5 py-0.5">
                          Score {Math.round(entry.score * 100)}%
                        </span>
                      ) : null}
                    </span>
                  </Pill>
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
              {expanded ? "Show less" : `Show ${selectedTeammates.length - INITIAL_VISIBLE} more`}
            </Button>
          ) : null}
          </>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">
            No teammate suggestions found in the current dataset.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
