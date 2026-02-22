"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useDetailLeague } from "@/components/pokedex/detail-league-context";
import { DetailActions } from "@/components/pokedex/detail-actions";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DETAIL_LEAGUE_OPTIONS, DETAIL_LEAGUES } from "@/lib/detail-league";
import { cn } from "@/lib/utils";

export function DetailStickyHeader({ pokemonName }: { pokemonName: string }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const { league, setLeague, allowAllLeagues } = useDetailLeague();

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 4);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/80 relative sticky top-0 z-40 -mx-4 mb-4 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 left-1/2 w-screen -translate-x-1/2 border-b transition-opacity duration-200",
          isScrolled ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="flex items-center justify-between gap-2 px-1 py-1">
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-md border px-2 text-sm font-medium sm:px-3"
          aria-label="Back to Pokedex"
        >
          <ArrowLeftIcon className="size-4" />
          <span className="sr-only sm:not-sr-only sm:ml-1.5">Back to Pokedex</span>
        </Link>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {allowAllLeagues ? (
            <Select value={league} onValueChange={(value) => setLeague(value as typeof league)}>
              <SelectTrigger className="h-9 w-[150px] sm:w-[170px]" data-testid="detail-league-select" aria-label="Global league selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DETAIL_LEAGUES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {DETAIL_LEAGUE_OPTIONS[item].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className="h-9 px-3">
              GL only
            </Badge>
          )}
          {!allowAllLeagues ? (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Pro: all leagues
            </Badge>
          ) : null}
          <DetailActions pokemonName={pokemonName} />
        </div>
      </div>
    </div>
  );
}
