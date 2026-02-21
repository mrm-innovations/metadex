import type { PokemonRow } from "@/lib/normalize";

export type SimilarPokemonEntry = {
  row: PokemonRow;
  score: number;
};

const SIMILARITY_FIELDS: Array<keyof Pick<PokemonRow, "pogoAtk" | "pogoDef" | "pogoHp" | "maxCp50">> = [
  "pogoAtk",
  "pogoDef",
  "pogoHp",
  "maxCp50",
];

function normalizeType(type?: string): string | null {
  const normalized = type?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function getTypeSimilarity(target: PokemonRow, candidate: PokemonRow): number {
  const target1 = normalizeType(target.type1);
  const target2 = normalizeType(target.type2);
  const candidate1 = normalizeType(candidate.type1);
  const candidate2 = normalizeType(candidate.type2);

  const targetTypes = new Set([target1, target2].filter(Boolean) as string[]);
  const candidateTypes = new Set([candidate1, candidate2].filter(Boolean) as string[]);

  const sharedTypeCount = [...targetTypes].filter((type) => candidateTypes.has(type)).length;
  const exactSameTypes =
    targetTypes.size > 0 &&
    targetTypes.size === candidateTypes.size &&
    [...targetTypes].every((type) => candidateTypes.has(type));

  if (exactSameTypes) {
    return 1;
  }
  if (target1 && candidate1 && target1 === candidate1) {
    return 0.82;
  }
  if (sharedTypeCount > 0) {
    return 0.58;
  }

  return 0;
}

function getFieldRange(rows: PokemonRow[], field: (typeof SIMILARITY_FIELDS)[number]): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined) {
      continue;
    }
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return 1;
  }

  const range = max - min;
  return range > 0 ? range : 1;
}

function getStatSimilarity(target: PokemonRow, candidate: PokemonRow, ranges: Record<string, number>): number {
  const scores: number[] = [];

  for (const field of SIMILARITY_FIELDS) {
    const targetValue = target[field];
    const candidateValue = candidate[field];

    if (targetValue === null || targetValue === undefined) {
      continue;
    }
    if (candidateValue === null || candidateValue === undefined) {
      continue;
    }

    const diff = Math.abs(targetValue - candidateValue);
    const range = ranges[field] ?? 1;
    const normalizedDiff = Math.min(1, diff / range);
    scores.push(1 - normalizedDiff);
  }

  if (scores.length === 0) {
    return 0;
  }

  return scores.reduce((acc, value) => acc + value, 0) / scores.length;
}

function getSimilarityScore(target: PokemonRow, candidate: PokemonRow, ranges: Record<string, number>): number {
  const typeSimilarity = getTypeSimilarity(target, candidate);
  if (typeSimilarity <= 0) {
    return 0;
  }

  const statSimilarity = getStatSimilarity(target, candidate, ranges);
  return typeSimilarity * 0.58 + statSimilarity * 0.42;
}

export function getSimilarPokemon(
  target: PokemonRow,
  allRows: PokemonRow[],
  limit = 8,
): SimilarPokemonEntry[] {
  if (limit <= 0) {
    return [];
  }

  const ranges = Object.fromEntries(
    SIMILARITY_FIELDS.map((field) => [field, getFieldRange(allRows, field)]),
  ) as Record<string, number>;

  const entries: SimilarPokemonEntry[] = [];

  for (const row of allRows) {
    if (row.nat === target.nat && row.name === target.name) {
      continue;
    }

    const score = getSimilarityScore(target, row, ranges);
    if (score <= 0) {
      continue;
    }

    entries.push({ row, score });
  }

  entries.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    const cpA = a.row.maxCp50 ?? -1;
    const cpB = b.row.maxCp50 ?? -1;
    if (cpA !== cpB) {
      return cpB - cpA;
    }

    return a.row.name.localeCompare(b.row.name);
  });

  return entries.slice(0, limit);
}
