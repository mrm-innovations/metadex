import { MatchupSimulator } from "@/components/lab/matchup-simulator";
import { LabNav } from "@/components/lab/lab-nav";
import { RetryButton } from "@/components/pokedex/retry-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseNatSortValue } from "@/lib/pokedex";
import { getPokedexDataset } from "@/lib/sheets";

export const metadata = {
  title: "Matchup Sim | MetaDex Lab",
};

export const revalidate = 900;

type PokemonOption = {
  nat: string;
  name: string;
  type1: string;
  type2?: string;
};

function buildOptions(rows: Awaited<ReturnType<typeof getPokedexDataset>>["rows"]): PokemonOption[] {
  return [...rows]
    .sort((a, b) => {
      const diff = parseNatSortValue(a.nat) - parseNatSortValue(b.nat);
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name);
    })
    .map((row) => ({
      nat: row.nat,
      name: row.name,
      type1: row.type1,
      type2: row.type2,
    }));
}

async function loadMatchupOptions() {
  try {
    const dataset = await getPokedexDataset();
    return {
      options: buildOptions(dataset.rows),
      fetchedAt: dataset.fetchedAt,
      error: null as string | null,
    };
  } catch (error) {
    return {
      options: [] as PokemonOption[],
      fetchedAt: null as string | null,
      error: error instanceof Error ? error.message : "Unknown loading error",
    };
  }
}

export default async function MatchupSimPage() {
  const { options, fetchedAt, error } = await loadMatchupOptions();

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 sm:px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Could not load matchup simulator</CardTitle>
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
        <h1 className="text-xl font-semibold tracking-tight">Lab: Matchup Sim</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Move-aware 1v1 sandbox with shields and turn timeline.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Dataset rows: {options.length.toLocaleString()} | Synced:{" "}
          {fetchedAt ? new Date(fetchedAt).toLocaleString() : "n/a"}
        </p>
      </div>

      <LabNav />
      <MatchupSimulator rows={options} />
    </main>
  );
}
