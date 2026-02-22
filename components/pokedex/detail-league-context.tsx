"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DETAIL_LEAGUE_OPTIONS,
  type DetailLeague,
} from "@/lib/detail-league";

type DetailLeagueContextValue = {
  league: DetailLeague;
  setLeague: (nextLeague: DetailLeague) => void;
  allowAllLeagues: boolean;
};

const DetailLeagueContext = createContext<DetailLeagueContextValue | null>(null);

export function DetailLeagueProvider({
  children,
  initialLeague,
  allowAllLeagues,
}: {
  children: ReactNode;
  initialLeague: DetailLeague;
  allowAllLeagues: boolean;
}) {
  const [selectedLeague, setSelectedLeague] = useState<DetailLeague>(initialLeague);
  const effectiveLeague: DetailLeague = allowAllLeagues ? selectedLeague : "great";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (allowAllLeagues) {
      if (effectiveLeague === "great") {
        url.searchParams.delete("league");
      } else {
        url.searchParams.set("league", effectiveLeague);
      }
    } else {
      url.searchParams.delete("league");
    }

    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [allowAllLeagues, effectiveLeague]);

  const contextValue = useMemo<DetailLeagueContextValue>(
    () => ({
      league: effectiveLeague,
      setLeague: (nextLeague) => {
        if (!allowAllLeagues) {
          return;
        }
        setSelectedLeague(nextLeague);
      },
      allowAllLeagues,
    }),
    [allowAllLeagues, effectiveLeague],
  );

  return (
    <DetailLeagueContext.Provider value={contextValue}>
      {children}
    </DetailLeagueContext.Provider>
  );
}

export function useDetailLeague() {
  const context = useContext(DetailLeagueContext);
  if (!context) {
    throw new Error("useDetailLeague must be used within DetailLeagueProvider");
  }
  return context;
}

export function getDetailLeagueLabel(league: DetailLeague): string {
  return DETAIL_LEAGUE_OPTIONS[league].label;
}
