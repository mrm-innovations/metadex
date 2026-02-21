"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Pill } from "@/components/pokedex/pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const LEAGUE_OPTIONS: Array<{ value: TeammateLeagueMode; label: string }> = [
  { value: "general", label: "General" },
  { value: "great", label: "Great League (1500)" },
  { value: "ultra", label: "Ultra League (2500)" },
  { value: "master", label: "Master League" },
];
const INITIAL_VISIBLE = 8;

export function SuggestedTeammatesCard({
  teammatesByLeague,
  currentName,
}: {
  teammatesByLeague: Record<TeammateLeagueMode, SuggestedTeammateEntry[]>;
  currentName: string;
}) {
  const listId = useId();
  const [selectedLeague, setSelectedLeague] = useState<TeammateLeagueMode>("general");
  const [expanded, setExpanded] = useState(false);
  const selectedTeammates = useMemo(
    () => teammatesByLeague[selectedLeague] ?? [],
    [selectedLeague, teammatesByLeague],
  );
  const hasMore = selectedTeammates.length > INITIAL_VISIBLE;
  const visibleTeammates =
    expanded || !hasMore ? selectedTeammates : selectedTeammates.slice(0, INITIAL_VISIBLE);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Suggested Teammates</CardTitle>
          <p className="text-muted-foreground text-sm">
            Picks that help cover {currentName}&apos;s weaknesses while staying battle-ready in GO.
          </p>
        </div>
        <Select
          value={selectedLeague}
          onValueChange={(value) => {
            setSelectedLeague(value as TeammateLeagueMode);
            setExpanded(false);
          }}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label="League selector for suggested teammates">
            <SelectValue placeholder="Select league" />
          </SelectTrigger>
          <SelectContent>
            {LEAGUE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Ranked by weakness coverage, team diversity, and {selectedLeague === "general" ? "overall GO strength." : "league fit."}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">Each chip shows Coverage vs League Fit.</p>
        {selectedTeammates.length > 0 ? (
          <>
          <div id={listId} className="mt-3 flex flex-wrap gap-2.5">
            {visibleTeammates.map((entry) => {
              const iconUrl = getListSpriteUrl(entry.row.nat, entry.row.spriteUrl);
              return (
                <Link
                  key={`${entry.row.nat}-${entry.row.name}`}
                  href={`/pokemon/${encodeURIComponent(entry.row.nat)}`}
                  className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  title={`${formatCoveredTypes(entry.coveredWeaknesses)} | Coverage ${formatCoverageScore(entry.coverage)} | League Fit ${formatLeagueFit(entry.leagueFit)}`}
                >
                  <Pill className="h-10 gap-2.5 px-3 pr-3 text-sm font-semibold">
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
                    <span>{entry.row.name}</span>
                    <span className={cn("text-foreground/80 ml-1 inline-flex items-center gap-1 text-[10px] font-medium")}>
                      <span className="bg-background/80 rounded border border-border/60 px-1.5 py-0.5">
                        Cov {formatCoverageScore(entry.coverage)}
                      </span>
                      <span className="bg-background/80 rounded border border-border/60 px-1.5 py-0.5">
                        LFit {formatLeagueFit(entry.leagueFit)}
                      </span>
                    </span>
                  </Pill>
                </Link>
              );
            })}
          </div>
          {hasMore ? (
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
