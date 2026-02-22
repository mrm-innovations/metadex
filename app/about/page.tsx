import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "About | MetaDex",
};

const GITHUB_REPO_URL = "https://github.com/mrm-innovations/metadex";

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <Card>
          <CardHeader>
          <CardTitle>About MetaDex</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6">
            <p>
              MetaDex is a Pokemon GO-focused Pokedex for fast browsing and battle prep. It combines clean
              stat browsing with practical league-aware insights and simulation tools.
            </p>
            <p className="text-muted-foreground">
              Architecture is intentionally lightweight for v1: no database, server-side caching, defensive
              parsing, and API-backed enrichment.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
          <CardTitle>What Is Live</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6">
            <ul className="list-disc space-y-1 pl-4">
              <li>Browse the full Pokedex with search, filters, sorting, and pagination.</li>
              <li>Open detail pages with GO stats, type matchups, evolution chain, and PvP IV ranking.</li>
              <li>Use league-aware recommendation panels: Suggested Teammates, Counter Matchups, Similar Pokemon.</li>
              <li>Use Team Builder and Teams Lab for shareable team presets and readiness scoring.</li>
              <li>Run a deterministic Matchup Simulator with move/shield settings.</li>
              <li>Use the Rankings page for cross-Pokemon discovery and quick navigation.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Methodology</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6">
            <p>
              Scores in MetaDex are heuristic, league-aware, and optimized for speed. They are directional
              decision support, not official in-game rankings.
            </p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              <li><span className="font-medium text-foreground">Coverage:</span> how well selections resist key weakness pressure.</li>
              <li><span className="font-medium text-foreground">League Fit (LFit):</span> CP/bulk/power proxy for GL/UL/ML viability.</li>
              <li><span className="font-medium text-foreground">Counter Matchups:</span> threat-type focused answer suggestions.</li>
              <li><span className="font-medium text-foreground">Matchup Simulator:</span> deterministic 1v1 logic with shields and turn cap.</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline">Fast heuristics</Badge>
              <Badge variant="outline">League-aware</Badge>
              <Badge variant="outline">Explainable outputs</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Sources and Refresh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6">
            <ul className="list-disc space-y-1 pl-4">
              <li>Google Sheets: core Pokemon GO stat dataset.</li>
              <li>PokeAPI: species metadata and evolution chain enrichment.</li>
              <li>GO Battle Log JSON: league meta ranking signals.</li>
            </ul>
            <p className="text-muted-foreground">
              Server-side cache + revalidation reduce source load and keep data fresh.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6">
            <ul className="list-disc space-y-1 pl-4">
              <li>No account-based cloud storage yet (presets are local browser storage).</li>
              <li>Meta and teammate outputs are proxy models, not official Pokemon GO battle rankings.</li>
              <li>Simulator is deterministic and simplified; move-level realism is still evolving.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roadmap (Near-Term)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6">
            <ul className="list-disc space-y-1 pl-4">
              <li>Improve move-level matchup engine realism and threat simulation depth.</li>
              <li>Add richer ranking explainability and stronger team recommendation controls.</li>
              <li>Expand lineup analytics and recommendation confidence signals.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6">
            <p className="text-muted-foreground">
              MetaDex is public. You can review code, open issues, and track releases.
            </p>
            <p>
              <Link
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline-offset-4 hover:underline"
              >
                github.com/mrm-innovations/metadex
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
