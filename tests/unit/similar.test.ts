import { describe, expect, it } from "vitest";

import type { PokemonRow } from "@/lib/normalize";
import { getSimilarPokemon } from "@/lib/similar";

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

describe("similar pokemon ranking", () => {
  it("prefers same-typing and nearby stat profile", () => {
    const target = createRow({
      nat: "1",
      name: "Bulbasaur",
      type1: "Grass",
      type2: "Poison",
      pogoAtk: 118,
      pogoDef: 111,
      pogoHp: 128,
      maxCp50: 1260,
    });

    const rows: PokemonRow[] = [
      target,
      createRow({
        nat: "2",
        name: "Ivysaur",
        type1: "Grass",
        type2: "Poison",
        pogoAtk: 151,
        pogoDef: 143,
        pogoHp: 155,
        maxCp50: 1921,
      }),
      createRow({
        nat: "43",
        name: "Oddish",
        type1: "Grass",
        type2: "Poison",
        pogoAtk: 131,
        pogoDef: 112,
        pogoHp: 128,
        maxCp50: 1391,
      }),
      createRow({
        nat: "44",
        name: "Gloom",
        type1: "Grass",
        type2: "Poison",
        pogoAtk: 153,
        pogoDef: 136,
        pogoHp: 155,
        maxCp50: 1912,
      }),
      createRow({
        nat: "8",
        name: "Wartortle",
        type1: "Water",
        pogoAtk: 126,
        pogoDef: 155,
        pogoHp: 153,
        maxCp50: 1683,
      }),
    ];

    const similar = getSimilarPokemon(target, rows, 3);
    expect(similar).toHaveLength(3);
    expect(similar.map((item) => item.row.name)).toEqual(["Oddish", "Gloom", "Ivysaur"]);
    expect(similar.some((item) => item.row.name === "Wartortle")).toBe(false);
  });

  it("returns empty when no type overlap exists", () => {
    const target = createRow({
      nat: "4",
      name: "Charmander",
      type1: "Fire",
      pogoAtk: 116,
      pogoDef: 93,
      pogoHp: 118,
      maxCp50: 1108,
    });

    const rows: PokemonRow[] = [
      target,
      createRow({
        nat: "7",
        name: "Squirtle",
        type1: "Water",
        pogoAtk: 94,
        pogoDef: 121,
        pogoHp: 127,
        maxCp50: 1069,
      }),
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

    const similar = getSimilarPokemon(target, rows, 5);
    expect(similar).toEqual([]);
  });
});
