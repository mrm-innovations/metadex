import { describe, expect, it } from "vitest";

import { clearPvPIVCache, getTopPvPIVs } from "@/lib/pvp";
import type { PokemonRow } from "@/lib/normalize";

const BULBASAUR: PokemonRow = {
  nat: "1",
  name: "Bulbasaur",
  type1: "Grass",
  type2: "Poison",
  pogoHp: 128,
  pogoAtk: 118,
  pogoDef: 111,
  maxCp40: 1115,
  maxCp50: 1260,
};

const CHARIZARD: PokemonRow = {
  nat: "6",
  name: "Charizard",
  type1: "Fire",
  type2: "Flying",
  pogoHp: 186,
  pogoAtk: 223,
  pogoDef: 173,
  maxCp40: 2889,
  maxCp50: 3266,
};

describe("getTopPvPIVs", () => {
  it("returns top N rows that respect the league CP cap", () => {
    clearPvPIVCache();
    const top = getTopPvPIVs(BULBASAUR, 1500, 5);

    expect(top).toHaveLength(5);
    for (const row of top) {
      expect(row.cp).toBeLessThanOrEqual(1500);
    }
  });

  it("sorts results by stat product descending", () => {
    clearPvPIVCache();
    const top = getTopPvPIVs(BULBASAUR, 1500, 50);

    for (let i = 1; i < top.length; i += 1) {
      expect(top[i - 1].statProduct).toBeGreaterThanOrEqual(top[i].statProduct);
    }
  });

  it("uses level 50 for no-cap master league ranking", () => {
    clearPvPIVCache();
    const top = getTopPvPIVs(BULBASAUR, Number.POSITIVE_INFINITY, 1);

    expect(top).toHaveLength(1);
    expect(top[0].level).toBe(50);
    expect(top[0].atkIV).toBe(15);
    expect(top[0].defIV).toBe(15);
    expect(top[0].hpIV).toBe(15);
  });

  it("caches results per pokemon+league key", () => {
    clearPvPIVCache();
    const first = getTopPvPIVs(BULBASAUR, 1500, 5);
    const second = getTopPvPIVs(BULBASAUR, 1500, 5);

    expect(first[0]).toBe(second[0]);
  });

  it("returns empty results for missing PoGO base stats", () => {
    clearPvPIVCache();
    const invalidPokemon: PokemonRow = {
      ...BULBASAUR,
      pogoAtk: null,
    };

    const top = getTopPvPIVs(invalidPokemon, 1500, 5);
    expect(top).toEqual([]);
  });

  it("normalizes non-positive league cap as no-cap behavior", () => {
    clearPvPIVCache();
    const negativeCap = getTopPvPIVs(BULBASAUR, -1, 1);
    const infinityCap = getTopPvPIVs(BULBASAUR, Number.POSITIVE_INFINITY, 1);

    expect(negativeCap).toEqual(infinityCap);
  });

  it("returns stable deterministic ordering between repeated calls", () => {
    clearPvPIVCache();
    const first = getTopPvPIVs(CHARIZARD, 2500, 10);
    clearPvPIVCache();
    const second = getTopPvPIVs(CHARIZARD, 2500, 10);

    expect(first).toEqual(second);
  });

  it("respects topN bounds", () => {
    clearPvPIVCache();
    expect(getTopPvPIVs(BULBASAUR, 1500, 0)).toEqual([]);
    expect(getTopPvPIVs(BULBASAUR, 1500, -5)).toEqual([]);
    expect(getTopPvPIVs(BULBASAUR, 1500, 1)).toHaveLength(1);
  });
});
