import { describe, expect, it } from "vitest";

import type { PokemonRow } from "@/lib/normalize";
import { getSuggestedTeammates } from "@/lib/teammates";

function createRow(partial: Partial<PokemonRow> & Pick<PokemonRow, "nat" | "name" | "type1">): PokemonRow {
  return {
    nat: partial.nat,
    name: partial.name,
    type1: partial.type1,
    type2: partial.type2,
    pogoAtk: partial.pogoAtk ?? null,
    pogoDef: partial.pogoDef ?? null,
    pogoHp: partial.pogoHp ?? null,
    maxCp40: partial.maxCp40 ?? null,
    maxCp50: partial.maxCp50 ?? null,
    spriteUrl: partial.spriteUrl,
    mainHp: null,
    mainAtk: null,
    mainDef: null,
    mainSpa: null,
    mainSpd: null,
    mainSpe: null,
    mainTotal: null,
  };
}

describe("suggested teammates ranking", () => {
  it("prioritizes candidates that cover key weaknesses", () => {
    const target = createRow({
      nat: "6",
      name: "Charizard",
      type1: "Fire",
      type2: "Flying",
      pogoAtk: 223,
      pogoDef: 173,
      pogoHp: 186,
      maxCp50: 3266,
    });

    const rows: PokemonRow[] = [
      target,
      createRow({
        nat: "260",
        name: "Swampert",
        type1: "Water",
        type2: "Ground",
        pogoAtk: 208,
        pogoDef: 175,
        pogoHp: 225,
        maxCp50: 3362,
      }),
      createRow({
        nat: "3",
        name: "Venusaur",
        type1: "Grass",
        type2: "Poison",
        pogoAtk: 198,
        pogoDef: 189,
        pogoHp: 190,
        maxCp50: 3075,
      }),
      createRow({
        nat: "68",
        name: "Machamp",
        type1: "Fighting",
        pogoAtk: 234,
        pogoDef: 159,
        pogoHp: 207,
        maxCp50: 3455,
      }),
    ];

    const teammates = getSuggestedTeammates(target, rows, 2);
    expect(teammates).toHaveLength(2);
    expect(teammates[0].row.name).toBe("Swampert");
    expect(teammates[0].coveredWeaknesses).toEqual(
      expect.arrayContaining(["rock", "electric"]),
    );
    expect(teammates.some((entry) => entry.row.name === "Machamp")).toBe(false);
  });

  it("returns empty list when target has no resolvable type weaknesses", () => {
    const target = createRow({
      nat: "0",
      name: "UnknownMon",
      type1: "Unknown",
      pogoAtk: 100,
      pogoDef: 100,
      pogoHp: 100,
      maxCp50: 1000,
    });

    const rows: PokemonRow[] = [
      target,
      createRow({
        nat: "1",
        name: "Bulbasaur",
        type1: "Grass",
        type2: "Poison",
        pogoAtk: 118,
        pogoDef: 111,
        pogoHp: 128,
        maxCp50: 1260,
      }),
    ];

    const teammates = getSuggestedTeammates(target, rows, 5);
    expect(teammates).toEqual([]);
  });

  it("applies league-aware viability penalties in capped formats", () => {
    const target = createRow({
      nat: "6",
      name: "Charizard",
      type1: "Fire",
      type2: "Flying",
      pogoAtk: 223,
      pogoDef: 173,
      pogoHp: 186,
      maxCp50: 3266,
    });

    const rows: PokemonRow[] = [
      target,
      createRow({
        nat: "81",
        name: "Magnemite",
        type1: "Electric",
        type2: "Steel",
        pogoAtk: 165,
        pogoDef: 121,
        pogoHp: 93,
        maxCp50: 872,
      }),
      createRow({
        nat: "171",
        name: "Lanturn",
        type1: "Water",
        type2: "Electric",
        pogoAtk: 146,
        pogoDef: 137,
        pogoHp: 268,
        maxCp50: 2641,
      }),
    ];

    const general = getSuggestedTeammates(target, rows, 5, "general");
    const great = getSuggestedTeammates(target, rows, 5, "great");

    const magnemiteGeneral = general.find((entry) => entry.row.name === "Magnemite");
    const magnemiteGreat = great.find((entry) => entry.row.name === "Magnemite");

    expect(magnemiteGeneral).toBeDefined();
    expect(magnemiteGreat).toBeDefined();
    expect(magnemiteGreat!.score).toBeLessThan(magnemiteGeneral!.score);
  });
});
