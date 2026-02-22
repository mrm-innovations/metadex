import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GaugeIcon, HeartPulseIcon, ShieldIcon, SwordsIcon, type LucideIcon } from "lucide-react";

import { DetailLeagueProvider } from "@/components/pokedex/detail-league-context";
import { DetailStickyHeader } from "@/components/pokedex/detail-sticky-header";
import { EvolutionSection, EvolutionSectionSkeleton } from "@/components/pokedex/evolution-section";
import { CounterMatchupsCard } from "@/components/pokedex/counter-matchups-card";
import { MetaRankSwitcher } from "@/components/pokedex/meta-rank-switcher";
import { PvPIvSection } from "@/components/pokedex/pvp-iv-section";
import { SimilarPokemonCard } from "@/components/pokedex/similar-pokemon-card";
import { SuggestedTeammatesCard } from "@/components/pokedex/suggested-teammates-card";
import { TeamBuilderCard } from "@/components/pokedex/team-builder-card";
import { TypeMatchupsCard } from "@/components/pokedex/type-matchups-card";
import { ClassificationBadge } from "@/components/pokedex/classification-badge";
import { TypeBadge } from "@/components/pokedex/type-badge";
import { Badge } from "@/components/ui/badge";
import { getMetaRankForPokemon } from "@/lib/gobattlelog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseDetailLeague } from "@/lib/detail-league";
import { formatNumber } from "@/lib/pokedex";
import { type PokemonRow } from "@/lib/normalize";
import { getPokemonClassificationForNat } from "@/lib/pokeapi";
import { getTopPvPIVs } from "@/lib/pvp";
import { getPokedexDataset } from "@/lib/sheets";
import { getSimilarPokemon } from "@/lib/similar";
import { getSuggestedTeammatesByLeague } from "@/lib/teammates";
import { getDualTypeHeroTheme, getPrimaryTypeSurfaceTint, getTypeTheme } from "@/lib/type-theme";
import { cn } from "@/lib/utils";

type PokemonDetailPageProps = {
  params: Promise<{ nat: string }>;
  searchParams: Promise<{ league?: string | string[] }>;
};

export const revalidate = 900;
const DISCOVERY_LIST_LIMIT = 24;

function findByNat(natParam: string, rows: Awaited<ReturnType<typeof getPokedexDataset>>["rows"]) {
  const exact = rows.find((row) => row.nat === natParam);
  if (exact) {
    return exact;
  }

  const numericParam = Number.parseFloat(natParam);
  if (!Number.isFinite(numericParam)) {
    return undefined;
  }

  return rows.find((row) => Number.parseFloat(row.nat) === numericParam);
}

function formatNatLabel(nat: string): string {
  const parsed = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
    return `#${String(parsed).padStart(3, "0")}`;
  }
  return `#${nat}`;
}

function formatLevel(level: number): string {
  return Number.isInteger(level) ? String(level) : level.toFixed(1);
}

function StatCard({
  label,
  value,
  barPercent,
  icon: Icon,
  iconClass,
  surfaceClass,
  barClass,
}: {
  label: string;
  value: string;
  barPercent?: number;
  icon?: LucideIcon;
  iconClass?: string;
  surfaceClass?: string;
  barClass?: string;
}) {
  return (
    <div className={cn("bg-card hover:border-primary/30 rounded-md border p-2.5 transition-colors sm:p-3", surfaceClass)}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
        {Icon ? <Icon className={cn("size-3.5", iconClass)} /> : null}
        <span>{label}</span>
      </p>
      <p className="mt-1 text-right text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      {barPercent !== undefined ? (
        <div className="bg-muted/85 dark:bg-muted/65 mt-2 h-1.5 overflow-hidden rounded-full">
          <div className={cn("h-full rounded-full", barClass ?? "bg-primary")} style={{ width: `${Math.max(4, Math.min(100, barPercent))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function getPvpTeaser(row: PokemonRow): string {
  const topGreat = getTopPvPIVs(row, 1500, 1)[0];
  if (!topGreat) {
    return "PvP data unavailable";
  }
  return `GL best: ${topGreat.atkIV}/${topGreat.defIV}/${topGreat.hpIV} @ L${formatLevel(topGreat.level)}`;
}

export default async function PokemonDetailPage({ params, searchParams }: PokemonDetailPageProps) {
  const { nat } = await params;
  const query = await searchParams;
  const rawLeague = Array.isArray(query.league) ? query.league[0] : query.league;
  const initialLeague = parseDetailLeague(rawLeague);
  const requestedNat = decodeURIComponent(nat);
  const dataset = await getPokedexDataset();
  const row = findByNat(requestedNat, dataset.rows);

  if (!row) {
    notFound();
  }

  const pvpTeaser = getPvpTeaser(row);
  const suggestedTeammatesByLeague = getSuggestedTeammatesByLeague(row, dataset.rows, DISCOVERY_LIST_LIMIT);
  const similarPokemon = getSimilarPokemon(row, dataset.rows, DISCOVERY_LIST_LIMIT);
  const barMax = Math.max(row.pogoHp ?? 0, row.pogoAtk ?? 0, row.pogoDef ?? 0, 1);
  const classification = await getPokemonClassificationForNat(row.nat).catch(() => null);
  const greatLeagueMetaRank = await getMetaRankForPokemon(row, "great").catch(() => null);
  const primaryTypeTheme = getTypeTheme(row.type1);
  const heroTypeTheme = getDualTypeHeroTheme(row.type1, row.type2);
  const primarySurfaceTint = getPrimaryTypeSurfaceTint(row.type1);
  const battleStatSurfaceClass = cn("bg-background/70", heroTypeTheme.borderClass);
  const neutralInfoBadgeClass = "bg-card text-foreground border-border";

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <DetailLeagueProvider initialLeague={initialLeague} allowAllLeagues>
        <DetailStickyHeader pokemonName={row.name} />

        <Card className={cn(primarySurfaceTint.bgClass, primarySurfaceTint.borderClass)}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3 text-2xl sm:text-3xl">
              <span>{row.name}</span>
              <span className="text-muted-foreground text-base font-medium">{formatNatLabel(row.nat)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={row.type1} />
              {row.type2 ? <TypeBadge type={row.type2} /> : null}
              <ClassificationBadge classification={classification} />
              <Badge variant="outline" className={neutralInfoBadgeClass}>Max CP40: {formatNumber(row.maxCp40)}</Badge>
              <Badge variant="outline" className={neutralInfoBadgeClass}>Max CP50: {formatNumber(row.maxCp50)}</Badge>
              <MetaRankSwitcher
                nat={row.nat}
                initialGreatEntry={greatLeagueMetaRank}
              />
              <Badge variant="outline" className={neutralInfoBadgeClass}>{pvpTeaser}</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="flex min-h-[220px] items-center justify-center md:justify-start">
                {row.spriteUrl ? (
                  <Image
                    src={row.spriteUrl}
                    alt={row.name}
                    width={192}
                    height={192}
                    priority
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">No sprite</p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className={cn("text-sm font-semibold tracking-wide uppercase", heroTypeTheme.accentClass)}>GO Battle Stats</h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">Quick snapshot for raids and league prep.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                  <StatCard
                    label="PoGO HP"
                    value={formatNumber(row.pogoHp)}
                    barPercent={((row.pogoHp ?? 0) / barMax) * 100}
                    icon={HeartPulseIcon}
                    iconClass="text-emerald-600 dark:text-emerald-400"
                    surfaceClass={battleStatSurfaceClass}
                    barClass={primaryTypeTheme.statBarClass}
                  />
                  <StatCard
                    label="PoGO ATK"
                    value={formatNumber(row.pogoAtk)}
                    barPercent={((row.pogoAtk ?? 0) / barMax) * 100}
                    icon={SwordsIcon}
                    iconClass="text-rose-600 dark:text-rose-400"
                    surfaceClass={battleStatSurfaceClass}
                    barClass={primaryTypeTheme.statBarClass}
                  />
                  <StatCard
                    label="PoGO DEF"
                    value={formatNumber(row.pogoDef)}
                    barPercent={((row.pogoDef ?? 0) / barMax) * 100}
                    icon={ShieldIcon}
                    iconClass="text-sky-600 dark:text-sky-400"
                    surfaceClass={battleStatSurfaceClass}
                    barClass={primaryTypeTheme.statBarClass}
                  />
                  <StatCard
                    label="Max CP Lv 40"
                    value={formatNumber(row.maxCp40)}
                    icon={GaugeIcon}
                    iconClass={heroTypeTheme.accentClass}
                    surfaceClass={battleStatSurfaceClass}
                  />
                  <StatCard
                    label="Max CP Lv 50"
                    value={formatNumber(row.maxCp50)}
                    icon={GaugeIcon}
                    iconClass={heroTypeTheme.accentClass}
                    surfaceClass={battleStatSurfaceClass}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="mt-4 space-y-4" data-access-tier="free">
          <TypeMatchupsCard type1={row.type1} type2={row.type2} />
          <Suspense fallback={<EvolutionSectionSkeleton />}>
            <EvolutionSection
              nat={row.nat}
              currentName={row.name}
              currentType1={row.type1}
            />
          </Suspense>
        </section>

        <section className="mt-4 space-y-4" data-access-tier="free">
          <TeamBuilderCard target={row} teammatesByLeague={suggestedTeammatesByLeague} />
          <CounterMatchupsCard target={row} teammatesByLeague={suggestedTeammatesByLeague} />
          <SuggestedTeammatesCard
            teammatesByLeague={suggestedTeammatesByLeague}
            currentName={row.name}
            showDeepAnalytics
          />
          <SimilarPokemonCard
            similar={similarPokemon}
            currentName={row.name}
            target={row}
            showDeepAnalytics
          />
          <PvPIvSection key={`${row.nat}-${row.name}`} pokemon={row} />
        </section>
      </DetailLeagueProvider>
    </main>
  );
}
