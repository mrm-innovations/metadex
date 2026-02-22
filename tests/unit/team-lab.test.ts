import { describe, expect, it } from "vitest";

import { analyzeTeam } from "@/lib/team-lab";
import type { PokemonRow } from "@/lib/normalize";

const rows: PokemonRow[] = [
  {
    nat: "3",
    name: "Venusaur",
    type1: "Grass",
    type2: "Poison",
    pogoHp: 190,
    pogoAtk: 198,
    pogoDef: 189,
    maxCp40: 2720,
    maxCp50: 3075,
  },
  {
    nat: "6",
    name: "Charizard",
    type1: "Fire",
    type2: "Flying",
    pogoHp: 186,
    pogoAtk: 223,
    pogoDef: 173,
    maxCp40: 2889,
    maxCp50: 3266,
  },
  {
    nat: "9",
    name: "Blastoise",
    type1: "Water",
    pogoHp: 188,
    pogoAtk: 171,
    pogoDef: 207,
    maxCp40: 2466,
    maxCp50: 2788,
  },
];

describe("analyzeTeam", () => {
  it("returns expected coverage metrics for selected team", () => {
    const result = analyzeTeam(rows, rows, "great");

    expect(result.score).toBeGreaterThan(0);
    expect(result.coverageRatio).toBeGreaterThan(0);
    expect(result.avgLeagueFit).toBeGreaterThan(0);
    expect(result.diversityRatio).toBeGreaterThan(0);
    expect(result.perMemberLeagueFit).toHaveLength(3);
    expect(result.members).toHaveLength(3);
    expect(result.scoreBreakdown.weighted.coverage).toBeGreaterThan(0);
    expect(result.scoreBreakdown.weighted.coverage).toBeLessThanOrEqual(0.68);
  });

  it("returns empty metrics for empty team", () => {
    const result = analyzeTeam([], rows, "ultra");

    expect(result.score).toBe(0);
    expect(result.coverageRatio).toBe(0);
    expect(result.avgLeagueFit).toBe(0);
    expect(result.coveredTypes).toEqual([]);
    expect(result.uncoveredTypes).toEqual([]);
    expect(result.members).toEqual([]);
    expect(result.scoreBreakdown.weighted.coverage).toBe(0);
    expect(result.topThreats).toEqual([]);
  });
});
