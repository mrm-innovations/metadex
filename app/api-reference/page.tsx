import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "API Reference | MetaDex",
};

const ENDPOINTS = [
  {
    path: "/api/pokedex",
    description: "Normalized Pokedex rows from the sheet cache.",
    sample: "/api/pokedex",
  },
  {
    path: "/api/pvp",
    description: "Top PvP IV rankings for a Pokemon and league cap.",
    sample: "/api/pvp?nat=1&league=1500&top=10",
  },
  {
    path: "/api/evolution",
    description: "Evolution chain for a given National Dex number.",
    sample: "/api/evolution?nat=4",
  },
  {
    path: "/api/classification",
    description: "Batch lookup for Legendary/Mythical classification.",
    sample: "/api/classification?nats=150,151,1",
  },
];

export default function ApiReferencePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">API Reference</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Read-only endpoints for MetaDex data and utility lookups.
        </p>
      </div>

      <div className="space-y-3">
        {ENDPOINTS.map((endpoint) => (
          <Card key={endpoint.path}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{endpoint.path}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{endpoint.description}</p>
              <Link
                href={endpoint.sample}
                className="text-primary inline-flex underline-offset-4 hover:underline"
                prefetch={false}
              >
                {endpoint.sample}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
