import { NextResponse } from "next/server";

import {
  getMetaLeagueFromSearchParam,
  getMetaRankDataset,
  getMetaRankForPokemon,
  META_LEAGUES,
} from "@/lib/gobattlelog";
import { type PokemonRow } from "@/lib/normalize";
import { getPokedexDataset } from "@/lib/sheets";

export const revalidate = 21600;

function parseLimit(value: string | null): number | null {
  if (!value) {
    return 50;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) {
    return null;
  }
  return parsed;
}

function findPokemonByNat(rows: PokemonRow[], natParam: string): PokemonRow | undefined {
  const exact = rows.find((row) => row.nat === natParam);
  if (exact) {
    return exact;
  }

  const parsedNat = Number.parseFloat(natParam);
  if (!Number.isFinite(parsedNat)) {
    return undefined;
  }

  return rows.find((row) => Number.parseFloat(row.nat) === parsedNat);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const league = getMetaLeagueFromSearchParam(url.searchParams.get("league"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const forceRefresh = url.searchParams.get("refresh") === "1";

    if (!limit) {
      return NextResponse.json(
        { error: "Invalid limit. Use an integer between 1 and 500." },
        { status: 400 },
      );
    }

    const natRaw = url.searchParams.get("nat");
    const nameRaw = url.searchParams.get("name")?.trim();

    if (natRaw || nameRaw) {
      const pokemonName = (() => {
        if (nameRaw) {
          return nameRaw;
        }

        const nat = decodeURIComponent((natRaw ?? "").trim());
        if (!nat) {
          return null;
        }

        return getPokedexDataset().then((dataset) => {
          const matched = findPokemonByNat(dataset.rows, nat);
          return matched?.name ?? null;
        });
      })();

      const resolvedName = typeof pokemonName === "string" ? pokemonName : await pokemonName;
      if (!resolvedName) {
        return NextResponse.json(
          { error: "Pokemon not found for provided nat/name." },
          { status: 404 },
        );
      }

      const matched = await getMetaRankForPokemon({ name: resolvedName }, league);
      return NextResponse.json({
        data: matched,
        meta: {
          league,
          availableLeagues: META_LEAGUES,
          pokemonName: resolvedName,
        },
      });
    }

    const dataset = await getMetaRankDataset(league, { forceRefresh });
    return NextResponse.json(
      {
        data: dataset.entries.slice(0, limit),
        meta: {
          league: dataset.league,
          count: dataset.entries.length,
          returned: Math.min(limit, dataset.entries.length),
          fetchedAt: dataset.fetchedAt,
          sourceUrl: dataset.sourceUrl,
          availableLeagues: META_LEAGUES,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=21600",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load meta ranking data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
