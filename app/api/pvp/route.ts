import { NextResponse } from "next/server";

import { type PokemonRow } from "@/lib/normalize";
import { getTopPvPIVs } from "@/lib/pvp";
import { getPokedexDataset } from "@/lib/sheets";

export const revalidate = 900;

type LeagueConfig = {
  key: "great" | "ultra" | "master" | "custom";
  label: string;
  cap: number;
};

function findPokemonByNat(rows: PokemonRow[], natParam: string): PokemonRow | undefined {
  const exact = rows.find((row) => row.nat === natParam);
  if (exact) {
    return exact;
  }

  const parsedParam = Number.parseFloat(natParam);
  if (!Number.isFinite(parsedParam)) {
    return undefined;
  }

  return rows.find((row) => Number.parseFloat(row.nat) === parsedParam);
}

function parseLeague(leagueRaw: string | null): LeagueConfig | null {
  const league = (leagueRaw ?? "great").trim().toLowerCase();

  if (league === "great") {
    return { key: "great", label: "Great League", cap: 1500 };
  }
  if (league === "ultra") {
    return { key: "ultra", label: "Ultra League", cap: 2500 };
  }
  if (league === "master") {
    return { key: "master", label: "Master League", cap: Number.POSITIVE_INFINITY };
  }

  const numericCap = Number.parseInt(league, 10);
  if (Number.isFinite(numericCap) && numericCap > 0) {
    return {
      key: "custom",
      label: `Custom League (${numericCap})`,
      cap: numericCap,
    };
  }

  return null;
}

function parseTopN(topNRaw: string | null): number | null {
  if (!topNRaw) {
    return 10;
  }
  const topN = Number.parseInt(topNRaw, 10);
  if (!Number.isFinite(topN) || topN < 1 || topN > 100) {
    return null;
  }
  return topN;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const natRaw = url.searchParams.get("nat");
    if (!natRaw || !natRaw.trim()) {
      return NextResponse.json(
        { error: "Missing required query param: nat" },
        { status: 400 },
      );
    }

    const league = parseLeague(url.searchParams.get("league"));
    if (!league) {
      return NextResponse.json(
        { error: "Invalid league. Use great, ultra, master, or positive numeric cap." },
        { status: 400 },
      );
    }

    const topN = parseTopN(url.searchParams.get("topN"));
    if (!topN) {
      return NextResponse.json(
        { error: "Invalid topN. Use an integer between 1 and 100." },
        { status: 400 },
      );
    }

    const dataset = await getPokedexDataset();
    const nat = decodeURIComponent(natRaw.trim());
    const pokemon = findPokemonByNat(dataset.rows, nat);
    if (!pokemon) {
      return NextResponse.json(
        { error: `Pokemon not found for nat '${nat}'.` },
        { status: 404 },
      );
    }

    const rankings = getTopPvPIVs(pokemon, league.cap, topN);

    return NextResponse.json({
      data: rankings,
      pokemon: {
        nat: pokemon.nat,
        name: pokemon.name,
        pogoAtk: pokemon.pogoAtk,
        pogoDef: pokemon.pogoDef,
        pogoHp: pokemon.pogoHp,
      },
      meta: {
        topN,
        count: rankings.length,
        league: {
          key: league.key,
          label: league.label,
          cap: Number.isFinite(league.cap) ? league.cap : null,
        },
        fetchedAt: dataset.fetchedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to compute PvP rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
