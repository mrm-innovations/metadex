import { NextResponse } from "next/server";

import { getEvolutionChainForNat } from "@/lib/pokeapi";

export const revalidate = 86400;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const nat = url.searchParams.get("nat");

    if (!nat || !nat.trim()) {
      return NextResponse.json(
        { error: "Missing required query param: nat" },
        { status: 400 },
      );
    }

    const forceRefresh = url.searchParams.get("refresh") === "1";
    const evolution = await getEvolutionChainForNat(nat, { forceRefresh });

    return NextResponse.json(
      {
        data: evolution.root,
        meta: {
          speciesNat: evolution.speciesNat,
          chainId: evolution.chainId,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isInputError = message.toLowerCase().includes("invalid nat");
    return NextResponse.json(
      {
        error: "Unable to load evolution chain",
        message,
      },
      { status: isInputError ? 400 : 500 },
    );
  }
}
