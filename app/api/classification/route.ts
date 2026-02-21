import { NextResponse } from "next/server";

import { getPokemonClassificationForNat } from "@/lib/pokeapi";

export const revalidate = 86400;

function parseNatsParam(raw: string | null): string[] | null {
  if (!raw || !raw.trim()) {
    return null;
  }

  const nats = [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))];
  if (nats.length === 0 || nats.length > 60) {
    return null;
  }
  return nats;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const nats = parseNatsParam(url.searchParams.get("nats"));
    if (!nats) {
      return NextResponse.json(
        { error: "Invalid nats param. Use comma-separated nat values (1..60 items)." },
        { status: 400 },
      );
    }

    const resolved = await Promise.all(
      nats.map(async (nat) => {
        try {
          const classification = await getPokemonClassificationForNat(nat);
          return [nat, classification] as const;
        } catch {
          return [nat, null] as const;
        }
      }),
    );

    return NextResponse.json(
      {
        data: Object.fromEntries(resolved),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to resolve classifications",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
