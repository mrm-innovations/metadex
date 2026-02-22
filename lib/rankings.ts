import {
  buildSpeciesCandidateKeys,
  normalizeMetaSpeciesKey,
  type MetaLeague,
  type MetaRankEntry,
  type MetaTier,
} from "@/lib/gobattlelog";
import type { PokemonRow } from "@/lib/normalize";

export type RankingMetaSnapshot = {
  rank: number;
  tier: MetaTier;
  rating: number;
};

export type RankingsRow = Pick<
  PokemonRow,
  "nat" | "name" | "type1" | "type2" | "spriteUrl" | "pogoAtk" | "pogoDef" | "pogoHp" | "maxCp50"
> & {
  meta: Partial<Record<MetaLeague, RankingMetaSnapshot>>;
  pvpProxy: Record<MetaLeague, number>;
};

type PvpProxyContext = {
  maxAtk: number;
  maxDef: number;
  maxHp: number;
  maxCp: number;
  maxBulk: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function getBulkProxy(row: PokemonRow): number {
  const atk = row.pogoAtk ?? 0;
  const def = row.pogoDef ?? 0;
  const hp = row.pogoHp ?? 0;
  if (atk <= 0 || def <= 0 || hp <= 0) {
    return 0;
  }
  return (def * hp) / atk;
}

function createPvpProxyContext(rows: PokemonRow[]): PvpProxyContext {
  let maxAtk = 1;
  let maxDef = 1;
  let maxHp = 1;
  let maxCp = 1;
  let maxBulk = 1;

  for (const row of rows) {
    maxAtk = Math.max(maxAtk, row.pogoAtk ?? 0);
    maxDef = Math.max(maxDef, row.pogoDef ?? 0);
    maxHp = Math.max(maxHp, row.pogoHp ?? 0);
    maxCp = Math.max(maxCp, row.maxCp50 ?? 0);
    maxBulk = Math.max(maxBulk, getBulkProxy(row));
  }

  return { maxAtk, maxDef, maxHp, maxCp, maxBulk };
}

function getPowerScore(row: PokemonRow, context: PvpProxyContext): number {
  const atkScore = clamp01((row.pogoAtk ?? 0) / context.maxAtk);
  const defScore = clamp01((row.pogoDef ?? 0) / context.maxDef);
  const hpScore = clamp01((row.pogoHp ?? 0) / context.maxHp);
  const cpScore = clamp01((row.maxCp50 ?? 0) / context.maxCp);
  return (atkScore + defScore + hpScore + cpScore) / 4;
}

function getLeagueProxyScore(
  row: PokemonRow,
  league: MetaLeague,
  context: PvpProxyContext,
): number {
  const cpPotential = row.maxCp50 ?? 0;
  const bulkScore = clamp01(getBulkProxy(row) / context.maxBulk);
  const powerScore = getPowerScore(row, context);

  if (league === "master") {
    const cpScore = clamp01(cpPotential / context.maxCp);
    return cpScore * 0.55 + powerScore * 0.45;
  }

  const cap = league === "great" ? 1500 : 2500;
  const reachCapScore = clamp01(cpPotential / cap);
  return reachCapScore * 0.6 + bulkScore * 0.4;
}

function buildMetaLookup(entries: MetaRankEntry[]): Map<string, RankingMetaSnapshot> {
  const lookup = new Map<string, RankingMetaSnapshot>();

  for (const entry of entries) {
    const value: RankingMetaSnapshot = {
      rank: entry.rank,
      tier: entry.tier,
      rating: entry.rating,
    };

    for (const rawKey of [entry.speciesId, entry.speciesName]) {
      const key = normalizeMetaSpeciesKey(rawKey);
      if (key && !lookup.has(key)) {
        lookup.set(key, value);
      }
    }
  }

  return lookup;
}

function findMetaForPokemon(
  row: PokemonRow,
  lookupsByLeague: Record<MetaLeague, Map<string, RankingMetaSnapshot>>,
): Partial<Record<MetaLeague, RankingMetaSnapshot>> {
  const result: Partial<Record<MetaLeague, RankingMetaSnapshot>> = {};
  const candidateKeys = buildSpeciesCandidateKeys(row.name);

  for (const league of ["great", "ultra", "master"] as const) {
    const lookup = lookupsByLeague[league];
    for (const key of candidateKeys) {
      const hit = lookup.get(key);
      if (hit) {
        result[league] = hit;
        break;
      }
    }
  }

  return result;
}

export function buildRankingsRows(
  rows: PokemonRow[],
  metaByLeague: Record<MetaLeague, MetaRankEntry[]>,
): RankingsRow[] {
  const context = createPvpProxyContext(rows);
  const lookupsByLeague: Record<MetaLeague, Map<string, RankingMetaSnapshot>> = {
    great: buildMetaLookup(metaByLeague.great),
    ultra: buildMetaLookup(metaByLeague.ultra),
    master: buildMetaLookup(metaByLeague.master),
  };

  return rows.map((row) => ({
    nat: row.nat,
    name: row.name,
    type1: row.type1,
    type2: row.type2,
    spriteUrl: row.spriteUrl,
    pogoAtk: row.pogoAtk,
    pogoDef: row.pogoDef,
    pogoHp: row.pogoHp,
    maxCp50: row.maxCp50,
    meta: findMetaForPokemon(row, lookupsByLeague),
    pvpProxy: {
      great: getLeagueProxyScore(row, "great", context),
      ultra: getLeagueProxyScore(row, "ultra", context),
      master: getLeagueProxyScore(row, "master", context),
    },
  }));
}
