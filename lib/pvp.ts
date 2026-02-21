import type { PokemonRow } from "@/lib/normalize";

export type PvPIvResult = {
  rank: number;
  atkIV: number;
  defIV: number;
  hpIV: number;
  level: number;
  cp: number;
  statProduct: number;
  finalAtk: number;
  finalDef: number;
  finalHp: number;
};

type CpmEntry = {
  level: number;
  cpm: number;
  cpmSquared: number;
};

const IV_MIN = 0;
const IV_MAX = 15;
const MAX_LEVEL = 50;

const RAW_CPM_TABLE: Array<{ level: number; cpm: number }> = [
  { level: 1, cpm: 0.094 },
  { level: 1.5, cpm: 0.135137432 },
  { level: 2, cpm: 0.16639787 },
  { level: 2.5, cpm: 0.192650919 },
  { level: 3, cpm: 0.21573247 },
  { level: 3.5, cpm: 0.236572661 },
  { level: 4, cpm: 0.25572005 },
  { level: 4.5, cpm: 0.273530381 },
  { level: 5, cpm: 0.29024988 },
  { level: 5.5, cpm: 0.306057377 },
  { level: 6, cpm: 0.3210876 },
  { level: 6.5, cpm: 0.335445036 },
  { level: 7, cpm: 0.34921268 },
  { level: 7.5, cpm: 0.362457751 },
  { level: 8, cpm: 0.37523559 },
  { level: 8.5, cpm: 0.387592406 },
  { level: 9, cpm: 0.39956728 },
  { level: 9.5, cpm: 0.411193551 },
  { level: 10, cpm: 0.4225 },
  { level: 10.5, cpm: 0.432926419 },
  { level: 11, cpm: 0.44310755 },
  { level: 11.5, cpm: 0.4530599578 },
  { level: 12, cpm: 0.46279839 },
  { level: 12.5, cpm: 0.472336083 },
  { level: 13, cpm: 0.48168495 },
  { level: 13.5, cpm: 0.4908558 },
  { level: 14, cpm: 0.49985844 },
  { level: 14.5, cpm: 0.508701765 },
  { level: 15, cpm: 0.51739395 },
  { level: 15.5, cpm: 0.525942511 },
  { level: 16, cpm: 0.53435433 },
  { level: 16.5, cpm: 0.542635767 },
  { level: 17, cpm: 0.55079269 },
  { level: 17.5, cpm: 0.558830576 },
  { level: 18, cpm: 0.56675452 },
  { level: 18.5, cpm: 0.574569153 },
  { level: 19, cpm: 0.58227891 },
  { level: 19.5, cpm: 0.589887917 },
  { level: 20, cpm: 0.5974 },
  { level: 20.5, cpm: 0.604818814 },
  { level: 21, cpm: 0.61215729 },
  { level: 21.5, cpm: 0.619399365 },
  { level: 22, cpm: 0.62656713 },
  { level: 22.5, cpm: 0.633644533 },
  { level: 23, cpm: 0.64065295 },
  { level: 23.5, cpm: 0.647576426 },
  { level: 24, cpm: 0.65443563 },
  { level: 24.5, cpm: 0.661214806 },
  { level: 25, cpm: 0.667934 },
  { level: 25.5, cpm: 0.674577537 },
  { level: 26, cpm: 0.68116492 },
  { level: 26.5, cpm: 0.687680648 },
  { level: 27, cpm: 0.69414365 },
  { level: 27.5, cpm: 0.700538673 },
  { level: 28, cpm: 0.70688421 },
  { level: 28.5, cpm: 0.713164996 },
  { level: 29, cpm: 0.71939909 },
  { level: 29.5, cpm: 0.725571552 },
  { level: 30, cpm: 0.7317 },
  { level: 30.5, cpm: 0.734741009 },
  { level: 31, cpm: 0.73776948 },
  { level: 31.5, cpm: 0.740785574 },
  { level: 32, cpm: 0.74378943 },
  { level: 32.5, cpm: 0.746781211 },
  { level: 33, cpm: 0.74976104 },
  { level: 33.5, cpm: 0.752729087 },
  { level: 34, cpm: 0.75568551 },
  { level: 34.5, cpm: 0.758630378 },
  { level: 35, cpm: 0.76156384 },
  { level: 35.5, cpm: 0.764486065 },
  { level: 36, cpm: 0.76739717 },
  { level: 36.5, cpm: 0.770297266 },
  { level: 37, cpm: 0.7731865 },
  { level: 37.5, cpm: 0.776064962 },
  { level: 38, cpm: 0.77893275 },
  { level: 38.5, cpm: 0.781790055 },
  { level: 39, cpm: 0.78463697 },
  { level: 39.5, cpm: 0.787473578 },
  { level: 40, cpm: 0.79030001 },
  { level: 40.5, cpm: 0.79280395 },
  { level: 41, cpm: 0.79530001 },
  { level: 41.5, cpm: 0.7978039 },
  { level: 42, cpm: 0.8003 },
  { level: 42.5, cpm: 0.8028039 },
  { level: 43, cpm: 0.8053 },
  { level: 43.5, cpm: 0.8078039 },
  { level: 44, cpm: 0.81029999 },
  { level: 44.5, cpm: 0.8128039 },
  { level: 45, cpm: 0.81529999 },
  { level: 45.5, cpm: 0.8178039 },
  { level: 46, cpm: 0.82029999 },
  { level: 46.5, cpm: 0.8228039 },
  { level: 47, cpm: 0.82529999 },
  { level: 47.5, cpm: 0.8278039 },
  { level: 48, cpm: 0.83029999 },
  { level: 48.5, cpm: 0.8328039 },
  { level: 49, cpm: 0.83529999 },
  { level: 49.5, cpm: 0.8378039 },
  { level: 50, cpm: 0.84029999 },
];

export const POGO_CPM_TABLE: CpmEntry[] = RAW_CPM_TABLE.map((entry) => ({
  level: entry.level,
  cpm: entry.cpm,
  cpmSquared: entry.cpm * entry.cpm,
}));

const POGO_CPM_DESCENDING: CpmEntry[] = [...POGO_CPM_TABLE].sort((left, right) => right.level - left.level);
const MAX_LEVEL_ENTRY = POGO_CPM_TABLE.find((entry) => entry.level === MAX_LEVEL);

const pvpCache = new Map<string, PvPIvResult[]>();

function toLeagueCap(leagueCap: number): number {
  if (!Number.isFinite(leagueCap) || leagueCap <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return leagueCap;
}

function createCacheKey(pokemon: PokemonRow, leagueCap: number): string {
  return [
    pokemon.nat,
    pokemon.name,
    pokemon.pogoAtk ?? "na",
    pokemon.pogoDef ?? "na",
    pokemon.pogoHp ?? "na",
    leagueCap,
  ].join("|");
}

function calculateCp(
  baseAtk: number,
  baseDef: number,
  baseHp: number,
  atkIV: number,
  defIV: number,
  hpIV: number,
  cpmSquared: number,
): number {
  const cp = Math.floor(
    (((baseAtk + atkIV) * Math.sqrt(baseDef + defIV) * Math.sqrt(baseHp + hpIV) * cpmSquared) / 10),
  );
  return cp;
}

function findBestLevelUnderCap(
  baseAtk: number,
  baseDef: number,
  baseHp: number,
  atkIV: number,
  defIV: number,
  hpIV: number,
  leagueCap: number,
): { levelEntry: CpmEntry; cp: number } | null {
  if (!Number.isFinite(leagueCap)) {
    if (!MAX_LEVEL_ENTRY) {
      return null;
    }
    return {
      levelEntry: MAX_LEVEL_ENTRY,
      cp: calculateCp(baseAtk, baseDef, baseHp, atkIV, defIV, hpIV, MAX_LEVEL_ENTRY.cpmSquared),
    };
  }

  for (const entry of POGO_CPM_DESCENDING) {
    const cp = calculateCp(baseAtk, baseDef, baseHp, atkIV, defIV, hpIV, entry.cpmSquared);
    if (cp <= leagueCap) {
      return { levelEntry: entry, cp };
    }
  }

  return null;
}

function compareIvResults(left: PvPIvResult, right: PvPIvResult): number {
  if (left.statProduct !== right.statProduct) {
    return right.statProduct - left.statProduct;
  }
  if (left.cp !== right.cp) {
    return right.cp - left.cp;
  }
  if (left.finalHp !== right.finalHp) {
    return right.finalHp - left.finalHp;
  }
  if (left.atkIV !== right.atkIV) {
    return left.atkIV - right.atkIV;
  }
  if (left.defIV !== right.defIV) {
    return right.defIV - left.defIV;
  }
  if (left.hpIV !== right.hpIV) {
    return right.hpIV - left.hpIV;
  }
  return right.level - left.level;
}

function computeAllPvPIVs(baseAtk: number, baseDef: number, baseHp: number, leagueCap: number): PvPIvResult[] {
  const results: PvPIvResult[] = [];

  for (let atkIV = IV_MIN; atkIV <= IV_MAX; atkIV += 1) {
    for (let defIV = IV_MIN; defIV <= IV_MAX; defIV += 1) {
      for (let hpIV = IV_MIN; hpIV <= IV_MAX; hpIV += 1) {
        const levelResult = findBestLevelUnderCap(baseAtk, baseDef, baseHp, atkIV, defIV, hpIV, leagueCap);
        if (!levelResult) {
          continue;
        }

        const finalAtk = (baseAtk + atkIV) * levelResult.levelEntry.cpm;
        const finalDef = (baseDef + defIV) * levelResult.levelEntry.cpm;
        const finalHp = Math.floor((baseHp + hpIV) * levelResult.levelEntry.cpm);
        const statProduct = finalAtk * finalDef * finalHp;

        results.push({
          rank: 0,
          atkIV,
          defIV,
          hpIV,
          level: levelResult.levelEntry.level,
          cp: levelResult.cp,
          statProduct,
          finalAtk,
          finalDef,
          finalHp,
        });
      }
    }
  }

  results.sort(compareIvResults);

  return results.map((result, index) => ({
    ...result,
    rank: index + 1,
  }));
}

export function getTopPvPIVs(pokemon: PokemonRow, leagueCap: number, topN: number): PvPIvResult[] {
  const baseAtk = pokemon.pogoAtk;
  const baseDef = pokemon.pogoDef;
  const baseHp = pokemon.pogoHp;

  if (
    baseAtk === null ||
    baseDef === null ||
    baseHp === null ||
    !Number.isFinite(baseAtk) ||
    !Number.isFinite(baseDef) ||
    !Number.isFinite(baseHp) ||
    baseAtk <= 0 ||
    baseDef <= 0 ||
    baseHp <= 0
  ) {
    return [];
  }

  const normalizedLeagueCap = toLeagueCap(leagueCap);
  const key = createCacheKey(pokemon, normalizedLeagueCap);
  const cached = pvpCache.get(key);
  const safeTopN = Math.max(0, Math.floor(topN));

  if (cached) {
    return cached.slice(0, safeTopN);
  }

  const allResults = computeAllPvPIVs(baseAtk, baseDef, baseHp, normalizedLeagueCap);
  pvpCache.set(key, allResults);
  return allResults.slice(0, safeTopN);
}

export function clearPvPIVCache(): void {
  pvpCache.clear();
}
