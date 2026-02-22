import { RankingsBrowser } from "@/components/rankings/rankings-browser";
import { RetryButton } from "@/components/pokedex/retry-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMetaRankDataset, type MetaLeague, type MetaRankEntry } from "@/lib/gobattlelog";
import { buildRankingsRows } from "@/lib/rankings";
import { getPokedexDataset } from "@/lib/sheets";

export const metadata = {
  title: "Rankings | MetaDex",
};

export const revalidate = 900;

async function loadMetaByLeague(): Promise<{
  byLeague: Record<MetaLeague, MetaRankEntry[]>;
  errors: string[];
}> {
  const leagues: MetaLeague[] = ["great", "ultra", "master"];
  const settled = await Promise.allSettled(leagues.map((league) => getMetaRankDataset(league)));

  const byLeague: Record<MetaLeague, MetaRankEntry[]> = {
    great: [],
    ultra: [],
    master: [],
  };
  const errors: string[] = [];

  settled.forEach((result, index) => {
    const league = leagues[index];
    if (result.status === "fulfilled") {
      byLeague[league] = result.value.entries;
    } else {
      errors.push(`${league}: ${result.reason instanceof Error ? result.reason.message : "unknown error"}`);
    }
  });

  return { byLeague, errors };
}

async function loadRankingsData() {
  try {
    const [dataset, meta] = await Promise.all([getPokedexDataset(), loadMetaByLeague()]);
    const rankings = buildRankingsRows(dataset.rows, meta.byLeague);

    return {
      rankings,
      fetchedAt: dataset.fetchedAt,
      errors: meta.errors,
      error: null as string | null,
    };
  } catch (error) {
    return {
      rankings: [],
      fetchedAt: null as string | null,
      errors: [] as string[],
      error: error instanceof Error ? error.message : "Unknown rankings loading error",
    };
  }
}

export default async function RankingsPage() {
  const { rankings, fetchedAt, errors, error } = await loadRankingsData();

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 sm:px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Could not load rankings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">{error}</p>
            <RetryButton />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="bg-muted/25 mb-6 rounded-lg border px-4 py-3">
        <h1 className="text-xl font-semibold tracking-tight">Rankings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          League-aware rankings for Meta and PvP fit, with search and type filtering.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Synced: {fetchedAt ? new Date(fetchedAt).toLocaleString() : "n/a"} | Rows: {rankings.length}
        </p>
        {errors.length > 0 ? (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Meta source warning: {errors.join(" | ")}
          </p>
        ) : null}
      </div>

      <RankingsBrowser rows={rankings} />
    </main>
  );
}
