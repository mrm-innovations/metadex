"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";

import { Pill } from "@/components/pokedex/pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SimilarPokemonEntry } from "@/lib/similar";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE = 8;

function getListSpriteUrl(nat: string, spriteUrl?: string): string | undefined {
  const parsedNat = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsedNat) && parsedNat > 0) {
    const dexId = Math.floor(parsedNat);
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
  }

  return spriteUrl;
}

function formatSimilarity(score: number): string {
  const percent = Math.round(score * 100);
  return `${percent}%`;
}

export function SimilarPokemonCard({
  similar,
  currentName,
}: {
  similar: SimilarPokemonEntry[];
  currentName: string;
}) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const hasMore = similar.length > INITIAL_VISIBLE;
  const visibleItems = expanded || !hasMore ? similar : similar.slice(0, INITIAL_VISIBLE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Similar Pokemon</CardTitle>
        <p className="text-muted-foreground text-sm">
          Based on typing overlap and nearby GO stats relative to {currentName}.
        </p>
      </CardHeader>
      <CardContent>
        {similar.length > 0 ? (
          <>
          <div id={listId} className="flex flex-wrap gap-2.5">
            {visibleItems.map((entry) => {
              const iconUrl = getListSpriteUrl(entry.row.nat, entry.row.spriteUrl);
              return (
                <Link
                  key={`${entry.row.nat}-${entry.row.name}`}
                  href={`/pokemon/${encodeURIComponent(entry.row.nat)}`}
                  className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                >
                  <Pill className="h-9 gap-2 px-3 pr-3 text-sm font-semibold">
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
                    <span className={cn("text-foreground/75 text-xs font-medium")}>{formatSimilarity(entry.score)}</span>
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
