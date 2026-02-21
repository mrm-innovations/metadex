import { PokedexBrowser } from "@/components/pokedex/pokedex-browser";
import { RetryButton } from "@/components/pokedex/retry-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sortPokemonRows } from "@/lib/pokedex";
import type { PokemonRow } from "@/lib/normalize";
import { getPokemonClassificationForNat, type PokemonClassification } from "@/lib/pokeapi";
import { getPokedexDataset } from "@/lib/sheets";

export const revalidate = 900;
const INITIAL_CLASSIFICATION_ROWS = 25;

async function buildInitialClassificationByNat(
  rows: PokemonRow[],
): Promise<Record<string, PokemonClassification | null>> {
  const firstPageRows = sortPokemonRows(rows, "nat").slice(0, INITIAL_CLASSIFICATION_ROWS);
  const nats = [...new Set(firstPageRows.map((row) => row.nat))];

  const entries = await Promise.all(
    nats.map(async (nat) => {
      try {
        const classification = await getPokemonClassificationForNat(nat);
        return [nat, classification] as const;
      } catch {
        return [nat, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

async function loadPageData() {
  try {
    const dataset = await getPokedexDataset();
    const initialClassificationByNat = await buildInitialClassificationByNat(dataset.rows);

    return {
      dataset,
      initialClassificationByNat,
      error: null as string | null,
    };
  } catch (error) {
    return {
      dataset: null,
      initialClassificationByNat: {} as Record<string, PokemonClassification | null>,
      error: error instanceof Error ? error.message : "Unknown sheet loading error",
    };
  }
}

export default async function Home() {
  const { dataset, initialClassificationByNat, error } = await loadPageData();

  if (!dataset) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 sm:px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Could not load MetaDex data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">{error ?? "Unknown sheet loading error"}</p>
            <RetryButton />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="bg-muted/25 mb-6 rounded-lg border px-4 py-3">
        <h1 className="sr-only">MetaDex</h1>
        <p className="text-muted-foreground text-sm">Pokemon GO-focused Pokedex with live Google Sheets data.</p>
        <p className="text-muted-foreground text-xs">
          Synced: {new Date(dataset.fetchedAt).toLocaleString()} | Rows: {dataset.rows.length} | Skipped rows:{" "}
          {dataset.skippedRows}
        </p>
      </div>

      <PokedexBrowser rows={dataset.rows} initialClassificationByNat={initialClassificationByNat} />
    </main>
  );
}
