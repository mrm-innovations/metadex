import { afterEach, describe, expect, it, vi } from "vitest";

import { clearMovesCache, getMovesDataset, getResolvedMovePool } from "@/lib/moves";
import { clearPokedexCache } from "@/lib/sheets";

const ORIGINAL_ENV = { ...process.env };

const TEST_CSV = [
  "Nat,Pokemon,Type I,Type II,HP Pogo,Atk Pogo,Def Pogo,MAX CP lvl 40,MAX CP lvl 50",
  "1,Bulbasaur,Grass,Poison,128,118,111,1115,1260",
  "6.1,Mega Charizard X,Fire,Dragon,186,273,213,3850,4353",
  "150,Mewtwo,Psychic,,214,300,182,4178,4724",
].join("\n");

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  clearMovesCache();
  clearPokedexCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("moves dataset normalization", () => {
  it("maps Pokemon move pools to pokedex forms by base nat and adds synthetic move entries", async () => {
    process.env.POKEDEX_CSV_OVERRIDE = TEST_CSV;
    process.env.POGO_MOVES_OVERRIDE_JSON = JSON.stringify({
      fastMoves: [
        {
          move_id: 214,
          name: "Vine Whip",
          type: "Grass",
          power: 7,
          energy_delta: 6,
          duration: 600,
        },
        {
          move_id: 269,
          name: "Fire Spin",
          type: "Fire",
          power: 14,
          energy_delta: 10,
          duration: 1100,
        },
      ],
      chargedMoves: [
        {
          move_id: 90,
          name: "Power Whip",
          type: "Grass",
          power: 90,
          energy_delta: -50,
          duration: 2600,
        },
        {
          move_id: 100,
          name: "Blast Burn",
          type: "Fire",
          power: 110,
          energy_delta: -50,
          duration: 3300,
        },
      ],
      pokemonMoves: [
        {
          pokemon_id: 1,
          pokemon_name: "Bulbasaur",
          form: "Normal",
          fast_moves: ["Vine Whip"],
          charged_moves: ["Power Whip"],
          elite_fast_moves: [],
          elite_charged_moves: [],
        },
        {
          pokemon_id: 6,
          pokemon_name: "Charizard",
          form: "Normal",
          fast_moves: ["Fire Spin"],
          charged_moves: ["Blast Burn"],
          elite_fast_moves: ["Legacy Breath"],
          elite_charged_moves: [],
        },
      ],
    });

    const dataset = await getMovesDataset({ forceRefresh: true });

    expect(dataset.sourceUrls).toContain("env://POGO_MOVES_OVERRIDE");
    expect(dataset.pools.length).toBeGreaterThan(0);

    const megaCharizardPool = dataset.pools.find((entry) => entry.nat === "6.1");
    expect(megaCharizardPool).toBeDefined();
    expect(megaCharizardPool?.fastMoveIds.length).toBe(1);
    expect(megaCharizardPool?.chargedMoveIds.length).toBe(1);
    expect(megaCharizardPool?.eliteFastMoveIds.length).toBe(1);
    expect(dataset.warnings.some((warning) => warning.includes("Legacy Breath"))).toBe(true);

    const resolved = await getResolvedMovePool({ nat: "6.1" });
    expect(resolved?.name).toBe("Mega Charizard X");
    expect(resolved?.fastMoves.map((move) => move.name)).toContain("Fire Spin");
    expect(resolved?.chargedMoves.map((move) => move.name)).toContain("Blast Burn");
    expect(resolved?.eliteFastMoves.map((move) => move.name)).toContain("Legacy Breath");
  });
});

describe("moves dataset caching", () => {
  it("fetches source payload once unless force refresh is requested", async () => {
    process.env.POKEDEX_CSV_OVERRIDE = TEST_CSV;
    process.env.POGO_FAST_MOVES_URL = "https://example.com/fast-moves.json";
    process.env.POGO_CHARGED_MOVES_URL = "https://example.com/charged-moves.json";
    process.env.POGO_POKEMON_MOVES_URL = "https://example.com/pokemon-moves.json";

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/fast-moves.json")) {
        return new Response(
          JSON.stringify([
            {
              move_id: 214,
              name: "Vine Whip",
              type: "Grass",
              power: 7,
              energy_delta: 6,
              duration: 600,
            },
          ]),
          { status: 200 },
        );
      }
      if (url.endsWith("/charged-moves.json")) {
        return new Response(
          JSON.stringify([
            {
              move_id: 90,
              name: "Power Whip",
              type: "Grass",
              power: 90,
              energy_delta: -50,
              duration: 2600,
            },
          ]),
          { status: 200 },
        );
      }
      if (url.endsWith("/pokemon-moves.json")) {
        return new Response(
          JSON.stringify([
            {
              pokemon_id: 1,
              pokemon_name: "Bulbasaur",
              form: "Normal",
              fast_moves: ["Vine Whip"],
              charged_moves: ["Power Whip"],
              elite_fast_moves: [],
              elite_charged_moves: [],
            },
          ]),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getMovesDataset();
    await getMovesDataset();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await getMovesDataset({ forceRefresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

