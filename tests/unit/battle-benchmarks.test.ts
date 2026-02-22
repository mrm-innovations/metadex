import { describe, expect, it } from "vitest";

import battleBenchmarks from "@/tests/fixtures/battle-benchmarks.json";
import {
  simulateBattle,
  type BattlePokemonInput,
  type BattleResult,
  type BattleSimulationConfig,
} from "@/lib/battle-engine";

type ExpectedEvent = {
  actor?: "left" | "right";
  action?: "fast" | "charged";
  moveName?: string;
  shielded?: boolean;
};

type BenchmarkExpected = {
  winner?: "left" | "right" | "draw";
  reason?: "faint" | "turn_limit";
  turnsElapsed?: number;
  timelineMin?: number;
  timelineMax?: number;
  maxActorEnergyAfter?: number;
  leftShieldsRemaining?: number;
  rightShieldsRemaining?: number;
  rightActionCountGreaterThanLeft?: boolean;
  firstEvent?: ExpectedEvent;
};

type BenchmarkCase = {
  id: string;
  description: string;
  left: BattlePokemonInput;
  right: BattlePokemonInput;
  config?: BattleSimulationConfig;
  expected: BenchmarkExpected;
};

function assertExpected(
  result: BattleResult,
  expected: BenchmarkExpected,
): void {
  if (expected.winner !== undefined) {
    expect(result.winner).toBe(expected.winner);
  }
  if (expected.reason !== undefined) {
    expect(result.reason).toBe(expected.reason);
  }
  if (expected.turnsElapsed !== undefined) {
    expect(result.turnsElapsed).toBe(expected.turnsElapsed);
  }
  if (expected.timelineMin !== undefined) {
    expect(result.timeline.length).toBeGreaterThanOrEqual(expected.timelineMin);
  }
  if (expected.timelineMax !== undefined) {
    expect(result.timeline.length).toBeLessThanOrEqual(expected.timelineMax);
  }
  if (expected.maxActorEnergyAfter !== undefined) {
    const maxEnergyAfter = result.timeline.reduce(
      (acc, event) => Math.max(acc, event.actorEnergyAfter),
      0,
    );
    expect(maxEnergyAfter).toBeLessThanOrEqual(expected.maxActorEnergyAfter);
  }
  if (expected.leftShieldsRemaining !== undefined) {
    expect(result.left.shieldsRemaining).toBe(expected.leftShieldsRemaining);
  }
  if (expected.rightShieldsRemaining !== undefined) {
    expect(result.right.shieldsRemaining).toBe(expected.rightShieldsRemaining);
  }
  if (expected.rightActionCountGreaterThanLeft) {
    const leftActions = result.timeline.filter((event) => event.actor === "left").length;
    const rightActions = result.timeline.filter((event) => event.actor === "right").length;
    expect(rightActions).toBeGreaterThan(leftActions);
  }
  if (expected.firstEvent) {
    const firstEvent = result.timeline[0];
    expect(firstEvent).toBeDefined();
    if (!firstEvent) {
      return;
    }
    if (expected.firstEvent.actor !== undefined) {
      expect(firstEvent.actor).toBe(expected.firstEvent.actor);
    }
    if (expected.firstEvent.action !== undefined) {
      expect(firstEvent.action).toBe(expected.firstEvent.action);
    }
    if (expected.firstEvent.moveName !== undefined) {
      expect(firstEvent.moveName).toBe(expected.firstEvent.moveName);
    }
    if (expected.firstEvent.shielded !== undefined) {
      expect(firstEvent.shielded).toBe(expected.firstEvent.shielded);
    }
  }
}

describe("battle engine benchmark fixture set", () => {
  const cases = battleBenchmarks as BenchmarkCase[];

  it("contains a useful benchmark set size", () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
  });

  for (const fixture of cases) {
    it(`${fixture.id}: ${fixture.description}`, () => {
      const result = simulateBattle(fixture.left, fixture.right, fixture.config);
      assertExpected(result, fixture.expected);
    });

    it(`${fixture.id}: deterministic replay`, () => {
      const first = simulateBattle(fixture.left, fixture.right, fixture.config);
      const second = simulateBattle(fixture.left, fixture.right, fixture.config);
      expect(second).toEqual(first);
    });
  }
});
