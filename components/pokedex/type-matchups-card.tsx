import { TypeBadge } from "@/components/pokedex/type-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatGoMultiplier,
  formatTypeName,
  getDefensiveMatchups,
  type GoPokemonType,
} from "@/lib/type-effectiveness";

function MatchupList({
  title,
  items,
}: {
  title: string;
  items: Array<{ attackType: GoPokemonType; multiplier: number }>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <div key={`${item.attackType}-${item.multiplier}`} className="inline-flex items-center gap-1">
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {formatGoMultiplier(item.multiplier)}
              </Badge>
              <TypeBadge type={formatTypeName(item.attackType)} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">No notable entries.</p>
      )}
    </div>
  );
}

export function TypeMatchupsCard({ type1, type2 }: { type1: string; type2?: string }) {
  const matchups = getDefensiveMatchups(type1, type2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Battle Matchups</CardTitle>
        <p className="text-muted-foreground text-sm">Defensive type multipliers in Pokemon GO.</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <MatchupList title="Weaknesses" items={matchups.weaknesses} />
          <MatchupList title="Resistances" items={matchups.resistances} />
        </div>
      </CardContent>
    </Card>
  );
}
