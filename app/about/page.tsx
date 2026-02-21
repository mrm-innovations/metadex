import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "About | MetaDex",
};

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>About MetaDex</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <p>
            MetaDex is a Pokemon GO-focused Pokedex that prioritizes fast browsing, practical battle stats,
            and PvP IV ranking insights.
          </p>
          <p>
            The app keeps a lightweight architecture: no database for v1, server-side caching, and defensive
            normalization so sheet/API changes do not break the UI.
          </p>
          <p className="text-muted-foreground">
            Data sources currently include Google Sheets (core stat rows) and PokeAPI (evolution + species
            classification metadata).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
