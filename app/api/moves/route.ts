import { NextResponse } from "next/server";

import { getMovesDataset, getResolvedMovePool } from "@/lib/moves";

export const revalidate = 43200;

function parseLimit(value: string | null): number | null {
  if (!value) {
    return 100;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) {
    return null;
  }
  return parsed;
}

function parseOffset(value: string | null): number | null {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseBooleanFlag(value: string | null): boolean {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const nat = url.searchParams.get("nat")?.trim();
    const name = url.searchParams.get("name")?.trim();
    const includeCatalog = parseBooleanFlag(url.searchParams.get("includeCatalog"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    if (limit === null) {
      return NextResponse.json(
        {
          error: "Invalid limit. Use an integer between 1 and 500.",
        },
        { status: 400 },
      );
    }

    if (offset === null) {
      return NextResponse.json(
        {
          error: "Invalid offset. Use a non-negative integer.",
        },
        { status: 400 },
      );
    }

    if (nat || name) {
      const pool = await getResolvedMovePool({ nat: nat ?? undefined, name: name ?? undefined, forceRefresh });
      if (!pool) {
        return NextResponse.json(
          {
            error: "Pokemon move pool not found for provided nat/name.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          data: pool,
          meta: {
            query: {
              nat: nat ?? null,
              name: name ?? null,
            },
          },
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=43200",
          },
        },
      );
    }

    const dataset = await getMovesDataset({ forceRefresh });
    const rows = dataset.pools.slice(offset, offset + limit).map((pool) => ({
      nat: pool.nat,
      baseNat: pool.baseNat,
      name: pool.name,
      forms: pool.forms,
      counts: {
        fast: pool.fastMoveIds.length,
        charged: pool.chargedMoveIds.length,
        eliteFast: pool.eliteFastMoveIds.length,
        eliteCharged: pool.eliteChargedMoveIds.length,
      },
    }));

    return NextResponse.json(
      {
        data: rows,
        meta: {
          fetchedAt: dataset.fetchedAt,
          sourceUrls: dataset.sourceUrls,
          warnings: dataset.warnings,
          poolCount: dataset.pools.length,
          moveCount: dataset.moves.length,
          returned: rows.length,
          offset,
          limit,
          includeCatalog,
          moves: includeCatalog ? dataset.moves : undefined,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=43200",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load moves data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

