import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "API Reference | MetaDex",
};

type ApiEndpoint = {
  path: string;
  status: "stable" | "beta";
  description: string;
  params: string[];
  sample: string;
};

const ENDPOINTS: ApiEndpoint[] = [
  {
    path: "/api/pokedex",
    status: "stable",
    description: "Normalized Pokedex dataset sourced from sheet cache and enrichment layers.",
    params: ["none"],
    sample: "/api/pokedex",
  },
  {
    path: "/api/pvp",
    status: "stable",
    description: "Top PvP IV ranking results for a Pokemon and league CP cap.",
    params: ["nat (required)", "league (1500|2500|nocap)", "top (optional)"],
    sample: "/api/pvp?nat=3&league=1500&top=10",
  },
  {
    path: "/api/evolution",
    status: "stable",
    description: "Evolution chain route for a National Dex input.",
    params: ["nat (required)"],
    sample: "/api/evolution?nat=133",
  },
  {
    path: "/api/classification",
    status: "stable",
    description: "Legendary/Mythical/etc classification lookup for one or many nats.",
    params: ["nat (optional)", "nats comma-list (optional)"],
    sample: "/api/classification?nats=150,151,249",
  },
  {
    path: "/api/meta-rank",
    status: "stable",
    description: "GO Battle Log meta rank by league, with name/nat filtering options.",
    params: ["league (great|ultra|master)", "nat (optional)", "name (optional)", "limit (optional)"],
    sample: "/api/meta-rank?league=great&nat=3",
  },
  {
    path: "/api/moves",
    status: "beta",
    description: "Pokemon GO move list and per-Pokemon move pool for simulator use.",
    params: ["nat (optional)", "name (optional)", "limit (optional)"],
    sample: "/api/moves?nat=6",
  },
  {
    path: "/api/matchup",
    status: "beta",
    description: "Deterministic 1v1 simulator endpoint (moves, shields, and turn cap).",
    params: [
      "leftNat/rightNat (required)",
      "leftFast/leftCharged (optional)",
      "rightFast/rightCharged (optional)",
      "leftShields/rightShields (optional)",
      "turnCap (optional)",
      "league (optional)",
    ],
    sample: "/api/matchup?leftNat=3&rightNat=6&league=great&leftShields=2&rightShields=2",
  },
];

function getStatusBadgeClass(status: ApiEndpoint["status"]): string {
  if (status === "stable") {
    return "border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  return "border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

export default function ApiReferencePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">API Reference</h1>
        <p className="text-muted-foreground text-sm">
          Version: <span className="font-medium">v1</span>. Public, read-only endpoints for data access and battle tooling.
        </p>
        <p className="text-muted-foreground text-sm">
          Cache behavior: server-side caching + periodic revalidation to reduce source load and improve response time.
        </p>
      </div>

      <div className="space-y-3">
        {ENDPOINTS.map((endpoint) => (
          <Card key={endpoint.path}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{endpoint.path}</CardTitle>
                <Badge variant="outline" className={getStatusBadgeClass(endpoint.status)}>
                  {endpoint.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{endpoint.description}</p>
              <p>
                <span className="font-medium">Params:</span> {endpoint.params.join(" | ")}
              </p>
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
