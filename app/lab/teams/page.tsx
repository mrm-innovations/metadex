import { LabNav } from "@/components/lab/lab-nav";
import { TeamPresetsLab } from "@/components/lab/team-presets-lab";
import { RetryButton } from "@/components/pokedex/retry-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseDetailLeague } from "@/lib/detail-league";
import { parseNatSortValue } from "@/lib/pokedex";
import { getPokedexDataset } from "@/lib/sheets";

export const metadata = {
  title: "Teams Lab | MetaDex",
};

export const revalidate = 900;

type TeamsPageProps = {
  searchParams: Promise<{ league?: string | string[]; slots?: string | string[]; core?: string | string[] }>;
};

function parseSlotQuery(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .slice(0, 3);
}

function parseCoreQuery(raw: string | string[] | undefined): 0 | 1 | 2 | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "none") {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (parsed === 0 || parsed === 1 || parsed === 2) {
    return parsed;
  }
  return null;
}

async function loadTeamRows() {
  try {
    const dataset = await getPokedexDataset();
    const rows = [...dataset.rows].sort((a, b) => {
      const diff = parseNatSortValue(a.nat) - parseNatSortValue(b.nat);
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      rows,
      fetchedAt: dataset.fetchedAt,
      error: null as string | null,
    };
  } catch (error) {
    return {
      rows: [],
      fetchedAt: null as string | null,
      error: error instanceof Error ? error.message : "Unknown loading error",
    };
  }
}

export default async function TeamsLabPage({ searchParams }: TeamsPageProps) {
  const query = await searchParams;
  const initialLeague = parseDetailLeague(Array.isArray(query.league) ? query.league[0] : query.league);
  const initialSlots = parseSlotQuery(query.slots);
  const initialCoreSlot = parseCoreQuery(query.core);
  const { rows, fetchedAt, error } = await loadTeamRows();

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 sm:px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Could not load teams lab</CardTitle>
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
        <h1 className="text-xl font-semibold tracking-tight">Lab: Teams</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Shareable 3-slot team presets with local saves and league-aware coverage insights.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Dataset rows: {rows.length.toLocaleString()} | Synced:{" "}
          {fetchedAt ? new Date(fetchedAt).toLocaleString() : "n/a"}
        </p>
      </div>

      <LabNav />
      <TeamPresetsLab
        rows={rows}
        initialLeague={initialLeague}
        initialSlots={initialSlots}
        initialCoreSlot={initialCoreSlot}
      />
    </main>
  );
}
