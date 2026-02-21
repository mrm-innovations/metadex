import { describe, expect, it } from "vitest";

import { normalizePokedexRows, parseCsv } from "@/lib/normalize";

describe("parseCsv", () => {
  it("handles quoted newlines in headers and cells", () => {
    const csv = [
      'Nat,Pokemon,"HP',
      'Pogo","MAX',
      'CP lvl 40"',
      '1,Bulbasaur,128,1115',
    ].join("\n");

    const rows = parseCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["Nat", "Pokemon", "HP\nPogo", "MAX\nCP lvl 40"]);
    expect(rows[1]).toEqual(["1", "Bulbasaur", "128", "1115"]);
  });
});

describe("normalizePokedexRows", () => {
  it("maps canonical sheet columns and extracts image URL from formulas", () => {
    const csv = [
      'Nat,Pokemon,Type I,Type II,"HP',
      'Pogo","Atk',
      'Pogo","Def',
      'Pogo","MAX',
      'CP lvl 40","MAX',
      'CP lvl 50",Image',
      '1,Bulbasaur,Grass,Poison,128,118,111,1115,1260,"=IMAGE(""https://img.test/bulba.png"")"',
    ].join("\n");

    const normalized = normalizePokedexRows(csv);

    expect(normalized.rows).toHaveLength(1);
    expect(normalized.rows[0]).toMatchObject({
      nat: "1",
      name: "Bulbasaur",
      type1: "Grass",
      type2: "Poison",
      pogoHp: 128,
      pogoAtk: 118,
      pogoDef: 111,
      maxCp40: 1115,
      maxCp50: 1260,
      spriteUrl: "https://img.test/bulba.png",
    });
    expect(normalized.metadata.fieldToHeader.nat).toBe("Nat");
    expect(normalized.metadata.fieldToHeader.maxCp50).toBe("MAX\nCP lvl 50");
  });

  it("handles defensive alias mapping and generates sprite URL when no image column exists", () => {
    const csv = [
      "Dex Number,Name,Primary Type,Secondary Type,GO HP,GO ATK,GO DEF,Max CP 40,Max CP 50",
      "3.1,Mega Venusaur,Grass,Poison,190,241,246,3688,4172",
    ].join("\n");

    const normalized = normalizePokedexRows(csv);
    expect(normalized.rows).toHaveLength(1);

    const row = normalized.rows[0];
    expect(row.nat).toBe("3.1");
    expect(row.name).toBe("Mega Venusaur");
    expect(row.type1).toBe("Grass");
    expect(row.type2).toBe("Poison");
    expect(row.pogoHp).toBe(190);
    expect(row.pogoAtk).toBe(241);
    expect(row.pogoDef).toBe(246);
    expect(row.maxCp40).toBe(3688);
    expect(row.maxCp50).toBe(4172);
    expect(row.spriteUrl).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/3.png",
    );
  });

  it("skips rows that are missing nat or name", () => {
    const csv = [
      "Nat,Pokemon,Type I,HP Pogo,Atk Pogo,Def Pogo,MAX CP lvl 40,MAX CP lvl 50",
      ",MissingNat,Normal,100,100,100,1000,1200",
      "25,,Electric,111,112,96,902,1020",
      "133,Eevee,Normal,146,104,114,1210,1372",
    ].join("\n");

    const normalized = normalizePokedexRows(csv);

    expect(normalized.rows).toHaveLength(1);
    expect(normalized.rows[0].name).toBe("Eevee");
    expect(normalized.metadata.skippedRows).toBe(2);
  });
});
