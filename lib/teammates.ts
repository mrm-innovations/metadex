import type { PokemonRow } from "@/lib/normalize";
import { formatTypeName, getDefensiveMatchups, type GoPokemonType } from "@/lib/type-effectiveness";

export const TEAMMATE_LEAGUE_MODES = ["general", "great", "ultra", "master"] as const;
export type TeammateLeagueMode = (typeof TEAMMATE_LEAGUE_MODES)[number];

export type SuggestedTeammateEntry = {
  row: PokemonRow;
  score: number;
  coverage: number;
  leagueFit: number;
  coveredWeaknesses: GoPokemonType[];
};

const POWER_FIELDS: Array<keyof Pick<PokemonRow, "pogoAtk" | "pogoDef" | "pogoHp" | "maxCp50">> = [
  "pogoAtk",
  "pogoDef",
  "pogoHp",
  "maxCp50",
];

const LEAGUE_CAP_BY_MODE: Partial<Record<TeammateLeagueMode, number>> = {
  great: 1500,
  ultra: 2500,
};

type RankingContext = {
  fieldMax: Record<string, number>;
  bulkMax: number;
  cpMax: number;
};

function getTypeKey(value?: string): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized !== "unknown" ? normalized : null;
}

function getTypeOverlapRatio(target: PokemonRow, candidate: PokemonRow): number {
  const targetTypes = new Set([getTypeKey(target.type1), getTypeKey(target.type2)].filter(Boolean) as string[]);
  const candidateTypes = new Set([getTypeKey(candidate.type1), getTypeKey(candidate.type2)].filter(Boolean) as string[]);

  if (targetTypes.size === 0 || candidateTypes.size === 0) {
    return 0;
  }

  const overlap = [...targetTypes].filter((type) => candidateTypes.has(type)).length;
  return overlap / targetTypes.size;
}

function getFieldMax(rows: PokemonRow[], field: (typeof POWER_FIELDS)[number]): number {
  let max = 0;
  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined) {
      continue;
    }
    if (value > max) {
      max = value;
    }
  }
  return max > 0 ? max : 1;
}

function getPowerScore(row: PokemonRow, fieldMax: Record<string, number>): number {
  const scores: number[] = [];
  for (const field of POWER_FIELDS) {
    const value = row[field];
    if (value === null || value === undefined) {
      continue;
    }
    const max = fieldMax[field] ?? 1;
    scores.push(Math.min(1, value / max));
  }

  if (scores.length === 0) {
    return 0;
  }

  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function getBulkStatProduct(row: PokemonRow): number {
  const atk = row.pogoAtk ?? 0;
  const def = row.pogoDef ?? 0;
  const hp = row.pogoHp ?? 0;

  if (atk <= 0 || def <= 0 || hp <= 0) {
    return 0;
  }

  // Lightweight PvP proxy: defensive bulk adjusted by lower attack pressure.
  return (def * hp) / atk;
}

function getLeagueViability(row: PokemonRow, mode: TeammateLeagueMode, context: RankingContext): number {
  const cpPotential = row.maxCp50 ?? row.maxCp40 ?? 0;
  const powerScore = getPowerScore(row, context.fieldMax);

  if (mode === "general") {
    return powerScore;
  }

  if (mode === "master") {
    const cpScore = Math.min(1, cpPotential / context.cpMax);
    return cpScore * 0.55 + powerScore * 0.45;
  }

  const cap = LEAGUE_CAP_BY_MODE[mode];
  if (!cap) {
    return powerScore;
  }

  const reachCapScore = Math.min(1, cpPotential / cap);
  const bulkScore = Math.min(1, getBulkStatProduct(row) / context.bulkMax);
  return reachCapScore * 0.6 + bulkScore * 0.4;
}

function createRankingContext(rows: PokemonRow[]): RankingContext {
  const fieldMax = Object.fromEntries(
    POWER_FIELDS.map((field) => [field, getFieldMax(rows, field)]),
  ) as Record<string, number>;

  let bulkMax = 0;
  let cpMax = 0;
  for (const row of rows) {
    bulkMax = Math.max(bulkMax, getBulkStatProduct(row));
    cpMax = Math.max(cpMax, row.maxCp50 ?? row.maxCp40 ?? 0);
  }

  return {
    fieldMax,
    bulkMax: bulkMax > 0 ? bulkMax : 1,
    cpMax: cpMax > 0 ? cpMax : 1,
  };
}

function getCoverage(
  targetWeaknesses: ReturnType<typeof getDefensiveMatchups>["weaknesses"],
  candidate: PokemonRow,
): {
  ratio: number;
  coveredWeaknesses: GoPokemonType[];
} {
  const candidateResistances = new Map(
    getDefensiveMatchups(candidate.type1, candidate.type2).resistances.map((item) => [item.attackType, item.multiplier]),
  );

  if (targetWeaknesses.length === 0) {
    return { ratio: 0, coveredWeaknesses: [] };
  }

  let coveredWeight = 0;
  let totalWeight = 0;
  const coveredWeaknesses: GoPokemonType[] = [];

  for (const weakness of targetWeaknesses) {
    const weaknessWeight = weakness.multiplier;
    totalWeight += weaknessWeight;

    const resistance = candidateResistances.get(weakness.attackType);
    if (resistance === undefined) {
      continue;
    }

    // Double resistances are slightly more valuable for safe swaps.
    const resistanceBoost = resistance <= 0.390625 ? 1.15 : 1;
    coveredWeight += weaknessWeight * resistanceBoost;
    coveredWeaknesses.push(weakness.attackType);
  }

  if (totalWeight === 0) {
    return { ratio: 0, coveredWeaknesses: [] };
  }

  return {
    ratio: Math.min(1, coveredWeight / totalWeight),
    coveredWeaknesses,
  };
}

function getTeammateScore(
  target: PokemonRow,
  targetWeaknesses: ReturnType<typeof getDefensiveMatchups>["weaknesses"],
  candidate: PokemonRow,
  mode: TeammateLeagueMode,
  context: RankingContext,
) {
  const coverage = getCoverage(targetWeaknesses, candidate);
  if (coverage.ratio <= 0) {
    return null;
  }

  const leagueViability = getLeagueViability(candidate, mode, context);
  const overlapRatio = getTypeOverlapRatio(target, candidate);
  const diversityScore = 1 - overlapRatio;

  const score =
    mode === "general"
      ? coverage.ratio * 0.72 + diversityScore * 0.18 + leagueViability * 0.1
      : coverage.ratio * 0.58 + diversityScore * 0.14 + leagueViability * 0.28;

  return {
    score,
    coverage: coverage.ratio,
    leagueFit: leagueViability,
    coveredWeaknesses: coverage.coveredWeaknesses,
  };
}

function getSuggestedTeammatesForMode(
  target: PokemonRow,
  allRows: PokemonRow[],
  targetWeaknesses: ReturnType<typeof getDefensiveMatchups>["weaknesses"],
  context: RankingContext,
  limit = 8,
  mode: TeammateLeagueMode = "general",
): SuggestedTeammateEntry[] {
  if (limit <= 0) {
    return [];
  }
  if (targetWeaknesses.length === 0) {
    return [];
  }

  const results: SuggestedTeammateEntry[] = [];

  for (const row of allRows) {
    if (row.nat === target.nat && row.name === target.name) {
      continue;
    }

    const ranking = getTeammateScore(target, targetWeaknesses, row, mode, context);
    if (!ranking) {
      continue;
    }

    results.push({
      row,
      score: ranking.score,
      coverage: ranking.coverage,
      leagueFit: ranking.leagueFit,
      coveredWeaknesses: ranking.coveredWeaknesses,
    });
  }

  results.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    if (a.coverage !== b.coverage) {
      return b.coverage - a.coverage;
    }

    const cpA = a.row.maxCp50 ?? -1;
    const cpB = b.row.maxCp50 ?? -1;
    if (cpA !== cpB) {
      return cpB - cpA;
    }

    return a.row.name.localeCompare(b.row.name);
  });

  return results.slice(0, limit);
}

export function getSuggestedTeammates(
  target: PokemonRow,
  allRows: PokemonRow[],
  limit = 8,
  mode: TeammateLeagueMode = "general",
): SuggestedTeammateEntry[] {
  const targetWeaknesses = getDefensiveMatchups(target.type1, target.type2).weaknesses;
  const context = createRankingContext(allRows);
  return getSuggestedTeammatesForMode(target, allRows, targetWeaknesses, context, limit, mode);
}

export function getSuggestedTeammatesByLeague(
  target: PokemonRow,
  allRows: PokemonRow[],
  limit = 8,
): Record<TeammateLeagueMode, SuggestedTeammateEntry[]> {
  const targetWeaknesses = getDefensiveMatchups(target.type1, target.type2).weaknesses;
  const context = createRankingContext(allRows);

  return {
    general: getSuggestedTeammatesForMode(target, allRows, targetWeaknesses, context, limit, "general"),
    great: getSuggestedTeammatesForMode(target, allRows, targetWeaknesses, context, limit, "great"),
    ultra: getSuggestedTeammatesForMode(target, allRows, targetWeaknesses, context, limit, "ultra"),
    master: getSuggestedTeammatesForMode(target, allRows, targetWeaknesses, context, limit, "master"),
  };
}

export function formatCoveredTypes(types: GoPokemonType[]): string {
  if (types.length === 0) {
    return "No direct weakness coverage";
  }
  return `Covers: ${types.map((type) => formatTypeName(type)).join(", ")}`;
}
