import { getDefensiveMatchups } from "@/lib/type-effectiveness";

type BattleSide = "left" | "right";
type BattleActionType = "fast" | "charged";

const DEFAULT_FAST_POWER = 5;
const DEFAULT_FAST_ENERGY_GAIN = 8;
const DEFAULT_FAST_TURNS = 1;
const DEFAULT_CHARGED_POWER = 70;
const DEFAULT_CHARGED_ENERGY_COST = 50;
const DEFAULT_CHARGED_TURNS = 1;
const DEFAULT_SHIELDS = 2;
const DEFAULT_MAX_TURNS = 300;
const ENERGY_CAP = 100;
const STAB_MULTIPLIER = 1.2;

function normalizeType(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function toFiniteNumber(value: number | null | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

export type BattleMoveInput = {
  id?: string;
  name: string;
  type?: string | null;
  power?: number | null;
  energyDelta?: number | null;
  energyGain?: number | null;
  energyCost?: number | null;
  turns?: number | null;
  durationMs?: number | null;
};

export type BattlePokemonInput = {
  name: string;
  type1: string;
  type2?: string | null;
  atk: number;
  def: number;
  hp: number;
  fastMove: BattleMoveInput;
  chargedMoves: BattleMoveInput[];
  startingEnergy?: number;
  startingShields?: number;
};

export type BattleSimulationConfig = {
  maxTurns?: number;
};

export type ShieldDecisionReason = "lethal" | "high_damage" | "low_hp";

export type BattleEvent = {
  turn: number;
  actor: BattleSide;
  target: BattleSide;
  action: BattleActionType;
  moveId: string;
  moveName: string;
  damage: number;
  shielded: boolean;
  shieldReason: ShieldDecisionReason | null;
  effectiveness: number;
  actorEnergyAfter: number;
  targetHpAfter: number;
};

export type BattleResult = {
  winner: BattleSide | "draw";
  reason: "faint" | "turn_limit";
  turnsElapsed: number;
  timeline: BattleEvent[];
  left: {
    name: string;
    hpRemaining: number;
    energyRemaining: number;
    shieldsRemaining: number;
  };
  right: {
    name: string;
    hpRemaining: number;
    energyRemaining: number;
    shieldsRemaining: number;
  };
};

type NormalizedBattleMove = {
  id: string;
  name: string;
  type: string | null;
  action: BattleActionType;
  power: number;
  energyGain: number;
  energyCost: number;
  turns: number;
};

type SideState = {
  side: BattleSide;
  name: string;
  type1: string;
  type2?: string | null;
  atk: number;
  def: number;
  maxHp: number;
  hp: number;
  energy: number;
  shields: number;
  cooldown: number;
  fastMove: NormalizedBattleMove;
  chargedMoves: NormalizedBattleMove[];
};

type PlannedAction = {
  actor: BattleSide;
  target: BattleSide;
  move: NormalizedBattleMove;
  action: BattleActionType;
  priority: number;
};

function buildMoveId(move: BattleMoveInput, action: BattleActionType): string {
  if (move.id?.trim()) {
    return move.id.trim();
  }
  return `${action}-${move.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function deriveTurns(move: BattleMoveInput, fallbackTurns: number): number {
  const turns = toFiniteNumber(move.turns, NaN);
  if (Number.isFinite(turns) && turns > 0) {
    return Math.max(1, Math.round(turns));
  }

  const durationMs = toFiniteNumber(move.durationMs, NaN);
  if (Number.isFinite(durationMs) && durationMs > 0) {
    return Math.max(1, Math.round(durationMs / 500));
  }

  return fallbackTurns;
}

function normalizeFastMove(move: BattleMoveInput): NormalizedBattleMove {
  const energyGainCandidate =
    move.energyGain ??
    (typeof move.energyDelta === "number" && move.energyDelta > 0 ? move.energyDelta : null);

  return {
    id: buildMoveId(move, "fast"),
    name: move.name,
    type: normalizeType(move.type),
    action: "fast",
    power: Math.max(1, Math.round(toFiniteNumber(move.power, DEFAULT_FAST_POWER))),
    energyGain: Math.max(0, Math.round(toFiniteNumber(energyGainCandidate, DEFAULT_FAST_ENERGY_GAIN))),
    energyCost: 0,
    turns: deriveTurns(move, DEFAULT_FAST_TURNS),
  };
}

function normalizeChargedMove(move: BattleMoveInput): NormalizedBattleMove {
  const energyCostCandidate =
    move.energyCost ??
    (typeof move.energyDelta === "number" && move.energyDelta < 0 ? Math.abs(move.energyDelta) : null);

  return {
    id: buildMoveId(move, "charged"),
    name: move.name,
    type: normalizeType(move.type),
    action: "charged",
    power: Math.max(1, Math.round(toFiniteNumber(move.power, DEFAULT_CHARGED_POWER))),
    energyGain: 0,
    energyCost: Math.max(1, Math.round(toFiniteNumber(energyCostCandidate, DEFAULT_CHARGED_ENERGY_COST))),
    turns: deriveTurns(move, DEFAULT_CHARGED_TURNS),
  };
}

function normalizeSide(side: BattleSide, input: BattlePokemonInput): SideState {
  const maxHp = Math.max(1, Math.round(toFiniteNumber(input.hp, 1)));
  const startingEnergy = Math.max(0, Math.min(ENERGY_CAP, Math.round(toFiniteNumber(input.startingEnergy, 0))));
  const startingShields = Math.max(0, Math.round(toFiniteNumber(input.startingShields, DEFAULT_SHIELDS)));

  const chargedMoves = input.chargedMoves.map(normalizeChargedMove);

  return {
    side,
    name: input.name,
    type1: input.type1,
    type2: input.type2,
    atk: Math.max(1, toFiniteNumber(input.atk, 1)),
    def: Math.max(1, toFiniteNumber(input.def, 1)),
    maxHp,
    hp: maxHp,
    energy: startingEnergy,
    shields: startingShields,
    cooldown: 0,
    fastMove: normalizeFastMove(input.fastMove),
    chargedMoves,
  };
}

function getTypeEffectiveness(moveType: string | null, defenderType1: string, defenderType2?: string | null): number {
  if (!moveType) {
    return 1;
  }

  const normalizedAttack = normalizeType(moveType);
  if (!normalizedAttack) {
    return 1;
  }

  const matchups = getDefensiveMatchups(defenderType1, defenderType2 ?? undefined);
  const weakness = matchups.weaknesses.find((item) => item.attackType === normalizedAttack);
  if (weakness) {
    return weakness.multiplier;
  }
  const resistance = matchups.resistances.find((item) => item.attackType === normalizedAttack);
  if (resistance) {
    return resistance.multiplier;
  }
  return 1;
}

function getStabMultiplier(attacker: SideState, move: NormalizedBattleMove): number {
  const moveType = normalizeType(move.type);
  if (!moveType) {
    return 1;
  }

  const type1 = normalizeType(attacker.type1);
  const type2 = normalizeType(attacker.type2 ?? undefined);
  if (moveType === type1 || moveType === type2) {
    return STAB_MULTIPLIER;
  }
  return 1;
}

function calculateDamage(attacker: SideState, defender: SideState, move: NormalizedBattleMove): {
  damage: number;
  effectiveness: number;
} {
  const effectiveness = getTypeEffectiveness(move.type, defender.type1, defender.type2);
  const stab = getStabMultiplier(attacker, move);

  const raw = 0.5 * move.power * (attacker.atk / defender.def) * effectiveness * stab;
  const damage = Math.max(1, Math.floor(raw) + 1);
  return { damage, effectiveness };
}

function pickChargedMove(attacker: SideState, defender: SideState): NormalizedBattleMove | null {
  const ready = attacker.chargedMoves
    .filter((move) => attacker.energy >= move.energyCost)
    .sort((a, b) => a.energyCost - b.energyCost || b.power - a.power || a.name.localeCompare(b.name));

  if (ready.length === 0) {
    return null;
  }

  const cheapest = ready[0];
  const strongest = [...ready].sort((a, b) => {
    const damageA = calculateDamage(attacker, defender, a).damage;
    const damageB = calculateDamage(attacker, defender, b).damage;
    if (damageA !== damageB) {
      return damageB - damageA;
    }
    return b.energyCost - a.energyCost;
  })[0];

  if (!strongest) {
    return cheapest;
  }

  if (defender.shields <= 0) {
    return strongest;
  }

  const strongestDamage = calculateDamage(attacker, defender, strongest).damage;
  if (strongestDamage >= defender.hp) {
    return strongest;
  }

  if (attacker.energy >= strongest.energyCost + cheapest.energyCost) {
    return strongest;
  }

  return cheapest;
}

function shouldUseShield(
  defender: SideState,
  incomingDamage: number,
): {
  useShield: boolean;
  reason: ShieldDecisionReason | null;
} {
  if (defender.shields <= 0) {
    return { useShield: false, reason: null };
  }

  if (incomingDamage >= defender.hp) {
    return { useShield: true, reason: "lethal" };
  }

  const hpRatio = defender.hp / defender.maxHp;
  if (incomingDamage >= defender.maxHp * 0.35) {
    return { useShield: true, reason: "high_damage" };
  }

  if (hpRatio <= 0.45) {
    return { useShield: true, reason: "low_hp" };
  }

  return { useShield: false, reason: null };
}

function planAction(actor: SideState, target: SideState): PlannedAction | null {
  if (actor.hp <= 0 || actor.cooldown > 0) {
    return null;
  }

  const charged = pickChargedMove(actor, target);
  if (charged) {
    return {
      actor: actor.side,
      target: target.side,
      move: charged,
      action: "charged",
      priority: 2,
    };
  }

  return {
    actor: actor.side,
    target: target.side,
    move: actor.fastMove,
    action: "fast",
    priority: 1,
  };
}

function executeAction(action: PlannedAction, left: SideState, right: SideState, turn: number): BattleEvent | null {
  const actor = action.actor === "left" ? left : right;
  const target = action.target === "left" ? left : right;
  if (actor.hp <= 0 || target.hp <= 0) {
    return null;
  }

  if (action.action === "fast") {
    const { damage, effectiveness } = calculateDamage(actor, target, action.move);
    target.hp = Math.max(0, target.hp - damage);
    actor.energy = Math.min(ENERGY_CAP, actor.energy + action.move.energyGain);
    actor.cooldown = action.move.turns;

    return {
      turn,
      actor: actor.side,
      target: target.side,
      action: "fast",
      moveId: action.move.id,
      moveName: action.move.name,
      damage,
      shielded: false,
      shieldReason: null,
      effectiveness,
      actorEnergyAfter: actor.energy,
      targetHpAfter: target.hp,
    };
  }

  actor.energy = Math.max(0, actor.energy - action.move.energyCost);
  const { damage, effectiveness } = calculateDamage(actor, target, action.move);
  const shieldDecision = shouldUseShield(target, damage);
  const shielded = shieldDecision.useShield;

  if (shielded) {
    target.shields = Math.max(0, target.shields - 1);
  }

  const appliedDamage = shielded ? 1 : damage;
  target.hp = Math.max(0, target.hp - appliedDamage);
  actor.cooldown = action.move.turns;

  return {
    turn,
    actor: actor.side,
    target: target.side,
    action: "charged",
    moveId: action.move.id,
    moveName: action.move.name,
    damage: appliedDamage,
    shielded,
    shieldReason: shielded ? shieldDecision.reason : null,
    effectiveness,
    actorEnergyAfter: actor.energy,
    targetHpAfter: target.hp,
  };
}

function compareActionPriority(a: PlannedAction, b: PlannedAction, left: SideState, right: SideState): number {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }

  const atkA = a.actor === "left" ? left.atk : right.atk;
  const atkB = b.actor === "left" ? left.atk : right.atk;
  if (atkA !== atkB) {
    return atkB - atkA;
  }

  return a.actor.localeCompare(b.actor);
}

function buildResult(
  left: SideState,
  right: SideState,
  timeline: BattleEvent[],
  turnsElapsed: number,
  reason: "faint" | "turn_limit",
): BattleResult {
  let winner: BattleSide | "draw" = "draw";
  if (left.hp > 0 && right.hp <= 0) {
    winner = "left";
  } else if (right.hp > 0 && left.hp <= 0) {
    winner = "right";
  } else if (left.hp > right.hp) {
    winner = "left";
  } else if (right.hp > left.hp) {
    winner = "right";
  }

  return {
    winner,
    reason,
    turnsElapsed,
    timeline,
    left: {
      name: left.name,
      hpRemaining: left.hp,
      energyRemaining: left.energy,
      shieldsRemaining: left.shields,
    },
    right: {
      name: right.name,
      hpRemaining: right.hp,
      energyRemaining: right.energy,
      shieldsRemaining: right.shields,
    },
  };
}

export function simulateBattle(
  leftInput: BattlePokemonInput,
  rightInput: BattlePokemonInput,
  config?: BattleSimulationConfig,
): BattleResult {
  const left = normalizeSide("left", leftInput);
  const right = normalizeSide("right", rightInput);
  const maxTurns = Math.max(1, Math.round(toFiniteNumber(config?.maxTurns, DEFAULT_MAX_TURNS)));
  const timeline: BattleEvent[] = [];

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    if (left.cooldown > 0) {
      left.cooldown -= 1;
    }
    if (right.cooldown > 0) {
      right.cooldown -= 1;
    }

    const planned: PlannedAction[] = [];
    const leftAction = planAction(left, right);
    const rightAction = planAction(right, left);
    if (leftAction) {
      planned.push(leftAction);
    }
    if (rightAction) {
      planned.push(rightAction);
    }

    planned.sort((a, b) => compareActionPriority(a, b, left, right));

    for (const action of planned) {
      const event = executeAction(action, left, right, turn);
      if (event) {
        timeline.push(event);
      }
      if (left.hp <= 0 || right.hp <= 0) {
        return buildResult(left, right, timeline, turn, "faint");
      }
    }
  }

  return buildResult(left, right, timeline, maxTurns, "turn_limit");
}
