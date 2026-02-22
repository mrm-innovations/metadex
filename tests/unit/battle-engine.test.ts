import { describe, expect, it } from "vitest";

import { simulateBattle, type BattlePokemonInput } from "@/lib/battle-engine";

const VINE_WHIP = {
  id: "fast-214",
  name: "Vine Whip",
  type: "Grass",
  power: 7,
  energyDelta: 6,
  durationMs: 600,
};

const POWER_WHIP = {
  id: "charged-90",
  name: "Power Whip",
  type: "Grass",
  power: 90,
  energyDelta: -50,
  durationMs: 2600,
};

const FIRE_SPIN = {
  id: "fast-269",
  name: "Fire Spin",
  type: "Fire",
  power: 14,
  energyDelta: 10,
  durationMs: 1100,
};

const BLAST_BURN = {
  id: "charged-100",
  name: "Blast Burn",
  type: "Fire",
  power: 110,
  energyDelta: -50,
  durationMs: 3300,
};

function createBulbasaur(): BattlePokemonInput {
  return {
    name: "Bulbasaur",
    type1: "Grass",
    type2: "Poison",
    atk: 118,
    def: 111,
    hp: 128,
    fastMove: VINE_WHIP,
    chargedMoves: [POWER_WHIP],
  };
}

function createCharizard(): BattlePokemonInput {
  return {
    name: "Charizard",
    type1: "Fire",
    type2: "Flying",
    atk: 223,
    def: 173,
    hp: 186,
    fastMove: FIRE_SPIN,
    chargedMoves: [BLAST_BURN],
  };
}

describe("simulateBattle", () => {
  it("favors type-effective side in baseline fight", () => {
    const result = simulateBattle(createBulbasaur(), createCharizard());

    expect(result.winner).toBe("right");
    expect(result.reason).toBe("faint");
    expect(result.right.hpRemaining).toBeGreaterThan(0);
    expect(result.left.hpRemaining).toBe(0);
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it("uses shields against lethal charged moves", () => {
    const attacker: BattlePokemonInput = {
      name: "Attacker",
      type1: "Water",
      atk: 200,
      def: 150,
      hp: 180,
      startingEnergy: 100,
      fastMove: {
        name: "Splash Pulse",
        type: "Water",
        power: 4,
        energyDelta: 8,
        durationMs: 500,
      },
      chargedMoves: [
        {
          name: "Hydro Cannon",
          type: "Water",
          power: 150,
          energyDelta: -50,
          durationMs: 2500,
        },
      ],
    };

    const defender: BattlePokemonInput = {
      name: "Defender",
      type1: "Fire",
      atk: 150,
      def: 120,
      hp: 140,
      startingShields: 1,
      fastMove: {
        name: "Scratch",
        type: "Normal",
        power: 5,
        energyDelta: 7,
        durationMs: 500,
      },
      chargedMoves: [],
    };

    const result = simulateBattle(attacker, defender);
    const firstCharged = result.timeline.find((event) => event.action === "charged");

    expect(firstCharged).toBeDefined();
    expect(firstCharged?.shielded).toBe(true);
    expect(firstCharged?.shieldReason).toBe("lethal");
    expect(result.right.shieldsRemaining).toBe(0);
  });

  it("is deterministic for identical inputs", () => {
    const left = createBulbasaur();
    const right = createCharizard();

    const first = simulateBattle(left, right);
    const second = simulateBattle(left, right);

    expect(second).toEqual(first);
  });
});
