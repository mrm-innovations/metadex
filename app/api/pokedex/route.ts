import { NextResponse } from "next/server";

import { getPokedexDataset } from "@/lib/sheets";

export const revalidate = 900;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const dataset = await getPokedexDataset({ forceRefresh });

    return NextResponse.json(
      {
        data: dataset.rows,
        meta: {
          count: dataset.rows.length,
          fetchedAt: dataset.fetchedAt,
          sourceUrl: dataset.sourceUrl,
          headers: dataset.headers,
          fieldToHeader: dataset.fieldToHeader,
          skippedRows: dataset.skippedRows,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=900",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load pokedex data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
