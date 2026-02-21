import { describe, expect, it } from "vitest";

import { formatGoMultiplier, getDefensiveMatchups } from "@/lib/type-effectiveness";

describe("type effectiveness", () => {
  it("computes expected defensive weaknesses and resistances for Bulbasaur typing", () => {
    const matchups = getDefensiveMatchups("Grass", "Poison");

    const weaknesses = new Map(matchups.weaknesses.map((entry) => [entry.attackType, entry.multiplier]));
    expect(weaknesses.get("fire")).toBe(1.6);
    expect(weaknesses.get("ice")).toBe(1.6);
    expect(weaknesses.get("flying")).toBe(1.6);
    expect(weaknesses.get("psychic")).toBe(1.6);

    const resistances = new Map(matchups.resistances.map((entry) => [entry.attackType, entry.multiplier]));
    expect(resistances.get("water")).toBe(0.625);
    expect(resistances.get("electric")).toBe(0.625);
    expect(resistances.get("fighting")).toBe(0.625);
    expect(resistances.get("grass")).toBe(0.390625);
    expect(resistances.get("fairy")).toBe(0.625);
  });

  it("supports double weaknesses and double resistances", () => {
    const matchups = getDefensiveMatchups("Fire", "Flying");

    const weaknesses = new Map(matchups.weaknesses.map((entry) => [entry.attackType, entry.multiplier]));
    expect(weaknesses.get("rock")).toBe(2.56);
    expect(weaknesses.get("water")).toBe(1.6);
    expect(weaknesses.get("electric")).toBe(1.6);

    const resistances = new Map(matchups.resistances.map((entry) => [entry.attackType, entry.multiplier]));
    expect(resistances.get("fighting")).toBe(0.625);
    expect(resistances.get("grass")).toBe(0.390625);
    expect(resistances.get("bug")).toBe(0.390625);
  });

  it("formats common GO multipliers for display", () => {
    expect(formatGoMultiplier(2.56)).toBe("x2.56");
    expect(formatGoMultiplier(1.6)).toBe("x1.6");
    expect(formatGoMultiplier(0.625)).toBe("x0.625");
    expect(formatGoMultiplier(0.390625)).toBe("x0.39");
  });
});
