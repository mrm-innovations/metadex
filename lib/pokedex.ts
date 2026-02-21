import type { PokemonRow } from "@/lib/normalize";

export type PokedexSortKey =
  | "name"
  | "nat"
  | "pogoAtk"
  | "pogoDef"
  | "pogoHp";

export const POKEDEX_SORT_OPTIONS: Array<{
  value: PokedexSortKey;
  label: string;
}> = [
  { value: "name", label: "Name (A-Z)" },
  { value: "nat", label: "National Dex (#)" },
  { value: "pogoAtk", label: "PoGO ATK (High-Low)" },
  { value: "pogoDef", label: "PoGO DEF (High-Low)" },
  { value: "pogoHp", label: "PoGO HP (High-Low)" },
];

export function parseNatSortValue(nat: string): number {
  const normalized = nat.trim().replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return parsed;
}

export function sortPokemonRows(rows: PokemonRow[], sortBy: PokedexSortKey): PokemonRow[] {
  const copy = [...rows];

  copy.sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }

    if (sortBy === "nat") {
      const diff = parseNatSortValue(a.nat) - parseNatSortValue(b.nat);
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name);
    }

    const aValue = a[sortBy] ?? -1;
    const bValue = b[sortBy] ?? -1;
    if (aValue !== bValue) {
      return bValue - aValue;
    }

    return a.name.localeCompare(b.name);
  });

  return copy;
}

export function collectTypes(rows: PokemonRow[]): string[] {
  const typeSet = new Set<string>();
  for (const row of rows) {
    if (row.type1) {
      typeSet.add(row.type1);
    }
    if (row.type2) {
      typeSet.add(row.type2);
    }
  }

  return [...typeSet].sort((a, b) => a.localeCompare(b));
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString();
}

export function hasAdvancedStats(row: PokemonRow): boolean {
  return (
    row.mainHp !== null ||
    row.mainAtk !== null ||
    row.mainDef !== null ||
    row.mainSpa !== null ||
    row.mainSpd !== null ||
    row.mainSpe !== null ||
    row.mainTotal !== null
  );
}
