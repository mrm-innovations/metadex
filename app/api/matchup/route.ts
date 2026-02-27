import { NextResponse } from "next/server";

import { simulateBattle, type BattleMoveInput, type BattlePokemonInput } from "@/lib/battle-engine";
import { getResolvedMovePool, type GoMove, type ResolvedPokemonMovePool } from "@/lib/moves";
import { parseNatSortValue } from "@/lib/pokedex";
import { type PokemonRow } from "@/lib/normalize";
import { getTopPvPIVs, POGO_CPM_TABLE } from "@/lib/pvp";
import { getPokedexDataset } from "@/lib/sheets";

export const revalidate = 300;

type SideKey = "left" | "right";
type MatchupConfidenceLevel = "high" | "medium" | "low";
type IvPreset = "hundo" | "pvp_rank1" | "custom";
type LevelPreset = "auto" | "40" | "50" | "custom";

type ResolvedStatProfile = {
  atk: number;
  def: number;
  hp: number;
  atkIv: number;
  defIv: number;
  hpIv: number;
  level: number;
  cp: number;
  ivPreset: IvPreset;
  levelPreset: LevelPreset;
};

function parseIntInRange(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function parseFloatInRange(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function parseIvPreset(value: string | null): IvPreset {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "custom") {
    return "custom";
  }
  if (normalized === "pvp_rank1") {
    return "pvp_rank1";
  }
  return "hundo";
}

function parseLevelPreset(value: string | null): LevelPreset {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "40" || normalized === "50" || normalized === "custom") {
    return normalized;
  }
  return "auto";
}

function getLeagueCap(league: string): number {
  if (league === "great") {
    return 1500;
  }
  if (league === "ultra") {
    return 2500;
  }
  return Number.POSITIVE_INFINITY;
}

function calculateCp(
  baseAtk: number,
  baseDef: number,
  baseHp: number,
  atkIv: number,
  defIv: number,
  hpIv: number,
  cpmSquared: number,
): number {
  return Math.floor(
    (((baseAtk + atkIv) * Math.sqrt(baseDef + defIv) * Math.sqrt(baseHp + hpIv) * cpmSquared) / 10),
  );
}

function findLevelEntry(level: number): { level: number; cpm: number; cpmSquared: number } | null {
  const rounded = Math.round(level * 2) / 2;
  return POGO_CPM_TABLE.find((entry) => entry.level === rounded) ?? null;
}

function findHighestLevelUnderCap(
  baseAtk: number,
  baseDef: number,
  baseHp: number,
  atkIv: number,
  defIv: number,
  hpIv: number,
  leagueCap: number,
): { level: number; cpm: number; cpmSquared: number; cp: number } | null {
  const descending = [...POGO_CPM_TABLE].sort((a, b) => b.level - a.level);

  if (!Number.isFinite(leagueCap)) {
    const max = descending[0];
    if (!max) {
      return null;
    }
    return {
      ...max,
      cp: calculateCp(baseAtk, baseDef, baseHp, atkIv, defIv, hpIv, max.cpmSquared),
    };
  }

  for (const entry of descending) {
    const cp = calculateCp(baseAtk, baseDef, baseHp, atkIv, defIv, hpIv, entry.cpmSquared);
    if (cp <= leagueCap) {
      return { ...entry, cp };
    }
  }

  return null;
}

function resolveStatProfile(args: {
  side: SideKey;
  row: PokemonRow;
  leagueCap: number;
  ivPreset: IvPreset;
  levelPreset: LevelPreset;
  customLevelRaw: string | null;
  customAtkIvRaw: string | null;
  customDefIvRaw: string | null;
  customHpIvRaw: string | null;
}): { data: ResolvedStatProfile } | { error: string } {
  const baseAtk = args.row.pogoAtk ?? args.row.mainAtk ?? null;
  const baseDef = args.row.pogoDef ?? args.row.mainDef ?? null;
  const baseHp = args.row.pogoHp ?? args.row.mainHp ?? null;
  if (baseAtk === null || baseDef === null || baseHp === null) {
    return { error: `${args.side} side is missing required battle stats.` };
  }

  let atkIv = 15;
  let defIv = 15;
  let hpIv = 15;
  let level = 50;
  let cp = 0;

  if (args.ivPreset === "pvp_rank1") {
    const top = getTopPvPIVs(args.row, args.leagueCap, 1)[0];
    if (!top) {
      return { error: `${args.side} side has no PvP rank data for the selected league.` };
    }

    atkIv = top.atkIV;
    defIv = top.defIV;
    hpIv = top.hpIV;
    level = top.level;
    cp = top.cp;
  } else {
    if (args.ivPreset === "custom") {
      const parsedAtkIv = parseIntInRange(args.customAtkIvRaw, 15, 0, 15);
      const parsedDefIv = parseIntInRange(args.customDefIvRaw, 15, 0, 15);
      const parsedHpIv = parseIntInRange(args.customHpIvRaw, 15, 0, 15);
      if (parsedAtkIv === null || parsedDefIv === null || parsedHpIv === null) {
        return { error: `${args.side} custom IVs must be integers between 0 and 15.` };
      }
      atkIv = parsedAtkIv;
      defIv = parsedDefIv;
      hpIv = parsedHpIv;
    }

    if (args.levelPreset === "auto") {
      const best = findHighestLevelUnderCap(baseAtk, baseDef, baseHp, atkIv, defIv, hpIv, args.leagueCap);
      if (!best) {
        return { error: `${args.side} profile does not fit under league cap.` };
      }
      level = best.level;
      cp = best.cp;
    } else {
      const manualLevel =
        args.levelPreset === "40"
          ? 40
          : args.levelPreset === "50"
            ? 50
            : parseFloatInRange(args.customLevelRaw, 40, 1, 50);

      if (manualLevel === null || Math.round(manualLevel * 2) !== manualLevel * 2) {
        return { error: `${args.side} level must be between 1 and 50 in 0.5 steps.` };
      }

      const entry = findLevelEntry(manualLevel);
      if (!entry) {
        return { error: `${args.side} level ${manualLevel} is not supported.` };
      }

      level = entry.level;
      cp = calculateCp(baseAtk, baseDef, baseHp, atkIv, defIv, hpIv, entry.cpmSquared);
      if (Number.isFinite(args.leagueCap) && cp > args.leagueCap) {
        return {
          error: `${args.side} profile CP ${cp} exceeds league cap ${Math.floor(args.leagueCap)}. Use auto level or lower IV/level.`,
        };
      }
    }
  }

  const levelEntry = findLevelEntry(level);
  if (!levelEntry) {
    return { error: `${args.side} could not resolve CPM for level ${level}.` };
  }

  const atk = (baseAtk + atkIv) * levelEntry.cpm;
  const def = (baseDef + defIv) * levelEntry.cpm;
  const hp = Math.floor((baseHp + hpIv) * levelEntry.cpm);

  return {
    data: {
      atk,
      def,
      hp,
      atkIv,
      defIv,
      hpIv,
      level,
      cp,
      ivPreset: args.ivPreset,
      levelPreset: args.levelPreset,
    },
  };
}

function parseCsv(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getMoveMatchValue(move: GoMove): string {
  return move.name.trim().toLowerCase();
}

function uniqueMoves(moves: GoMove[]): GoMove[] {
  const seen = new Set<string>();
  const values: GoMove[] = [];
  for (const move of moves) {
    if (seen.has(move.id)) {
      continue;
    }
    seen.add(move.id);
    values.push(move);
  }
  return values;
}

function findPokemonByNat(rows: PokemonRow[], natParam: string): PokemonRow | undefined {
  const exact = rows.find((row) => row.nat === natParam);
  if (exact) {
    return exact;
  }

  const parsedNat = parseNatSortValue(natParam);
  if (!Number.isFinite(parsedNat) || parsedNat === Number.MAX_SAFE_INTEGER) {
    return undefined;
  }

  return rows.find((row) => parseNatSortValue(row.nat) === parsedNat);
}

function pickFastMove(
  pool: ResolvedPokemonMovePool,
  queryValues: string[],
): GoMove | null {
  const fastMoves = uniqueMoves([...pool.fastMoves, ...pool.eliteFastMoves]);
  if (fastMoves.length === 0) {
    return null;
  }

  for (const query of queryValues) {
    const normalized = query.trim().toLowerCase();
    const matched =
      fastMoves.find((move) => move.id.toLowerCase() === normalized) ??
      fastMoves.find((move) => getMoveMatchValue(move) === normalized);
    if (matched) {
      return matched;
    }
  }

  return fastMoves[0] ?? null;
}

function pickChargedMoves(
  pool: ResolvedPokemonMovePool,
  queryValues: string[],
): GoMove[] {
  const chargedMoves = uniqueMoves([...pool.chargedMoves, ...pool.eliteChargedMoves]);
  if (chargedMoves.length === 0) {
    return [];
  }

  const chosen: GoMove[] = [];
  for (const query of queryValues) {
    const normalized = query.trim().toLowerCase();
    const matched =
      chargedMoves.find((move) => move.id.toLowerCase() === normalized) ??
      chargedMoves.find((move) => getMoveMatchValue(move) === normalized);
    if (!matched) {
      continue;
    }
    if (!chosen.some((entry) => entry.id === matched.id)) {
      chosen.push(matched);
    }
    if (chosen.length >= 2) {
      break;
    }
  }

  if (chosen.length > 0) {
    return chosen;
  }

  return [chargedMoves[0]];
}

function toBattleMoveInput(move: GoMove): BattleMoveInput {
  return {
    id: move.id,
    name: move.name,
    type: move.type,
    power: move.power,
    energyDelta: move.energyDelta,
    energyGain: move.energyGain,
    energyCost: move.energyCost,
    turns: move.turns,
    durationMs: move.durationMs,
  };
}

function buildSideInput(args: {
  side: SideKey;
  row: PokemonRow;
  stats: ResolvedStatProfile;
  pool: ResolvedPokemonMovePool;
  fastQuery: string[];
  chargedQuery: string[];
  startingShields: number;
  startingEnergy: number;
}): { input: BattlePokemonInput; selection: { fast: GoMove; charged: GoMove[] } } | { error: string } {
  const fast = pickFastMove(args.pool, args.fastQuery);
  if (!fast) {
    return { error: `${args.side} side has no available fast moves.` };
  }

  const charged = pickChargedMoves(args.pool, args.chargedQuery);
  if (charged.length === 0) {
    return { error: `${args.side} side has no available charged moves.` };
  }

  return {
    input: {
      name: args.row.name,
      type1: args.row.type1,
      type2: args.row.type2,
      atk: args.stats.atk,
      def: args.stats.def,
      hp: args.stats.hp,
      fastMove: toBattleMoveInput(fast),
      chargedMoves: charged.map(toBattleMoveInput),
      startingEnergy: args.startingEnergy,
      startingShields: args.startingShields,
    },
    selection: {
      fast,
      charged,
    },
  };
}

function sortRows(rows: PokemonRow[]): PokemonRow[] {
  return [...rows].sort((a, b) => {
    const diff = parseNatSortValue(a.nat) - parseNatSortValue(b.nat);
    if (diff !== 0) {
      return diff;
    }
    return a.name.localeCompare(b.name);
  });
}

function buildFallbackMove(args: {
  id: string;
  category: "fast" | "charged";
  name: string;
  type: string;
  power: number;
  energyDelta: number;
  turns: number;
  durationMs: number;
}): GoMove {
  return {
    id: args.id,
    category: args.category,
    name: args.name,
    type: args.type,
    moveId: null,
    power: args.power,
    energyDelta: args.energyDelta,
    energyGain: args.energyDelta > 0 ? args.energyDelta : null,
    energyCost: args.energyDelta < 0 ? Math.abs(args.energyDelta) : null,
    durationMs: args.durationMs,
    turns: args.turns,
  };
}

function buildFallbackPool(row: PokemonRow): ResolvedPokemonMovePool {
  const primaryType = row.type1 || "Normal";
  const secondaryType = row.type2 || row.type1 || "Normal";

  const fastPrimary = buildFallbackMove({
    id: `fallback-fast-${row.nat}-primary`,
    category: "fast",
    name: `${primaryType} Jab`,
    type: primaryType,
    power: 7,
    energyDelta: 8,
    turns: 1,
    durationMs: 500,
  });
  const fastSecondary = buildFallbackMove({
    id: `fallback-fast-${row.nat}-secondary`,
    category: "fast",
    name: `${secondaryType} Swipe`,
    type: secondaryType,
    power: 9,
    energyDelta: 7,
    turns: 2,
    durationMs: 1000,
  });
  const chargedPrimary = buildFallbackMove({
    id: `fallback-charged-${row.nat}-primary`,
    category: "charged",
    name: `${primaryType} Burst`,
    type: primaryType,
    power: 95,
    energyDelta: -50,
    turns: 1,
    durationMs: 2500,
  });
  const chargedSecondary = buildFallbackMove({
    id: `fallback-charged-${row.nat}-secondary`,
    category: "charged",
    name: `${secondaryType} Impact`,
    type: secondaryType,
    power: 80,
    energyDelta: -45,
    turns: 1,
    durationMs: 2300,
  });

  return {
    nat: row.nat,
    baseNat: Number.isFinite(parseNatSortValue(row.nat))
      ? Math.floor(parseNatSortValue(row.nat))
      : null,
    name: row.name,
    forms: [],
    fastMoves: [fastPrimary, fastSecondary],
    chargedMoves: [chargedPrimary, chargedSecondary],
    eliteFastMoves: [],
    eliteChargedMoves: [],
  };
}

function buildConfidence(args: {
  leftUsedFallbackPool: boolean;
  rightUsedFallbackPool: boolean;
}): {
  level: MatchupConfidenceLevel;
  notes: string[];
} {
  const notes: string[] = [];

  if (args.leftUsedFallbackPool) {
    notes.push(
      "Left side used fallback moves because move data was unavailable.",
    );
  }
  if (args.rightUsedFallbackPool) {
    notes.push(
      "Right side used fallback moves because move data was unavailable.",
    );
  }

  if (args.leftUsedFallbackPool && args.rightUsedFallbackPool) {
    return { level: "low", notes };
  }
  if (args.leftUsedFallbackPool || args.rightUsedFallbackPool) {
    return { level: "medium", notes };
  }

  return { level: "high", notes };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const leftNat = url.searchParams.get("leftNat")?.trim();
    const rightNat = url.searchParams.get("rightNat")?.trim();
    const refresh = url.searchParams.get("refresh") === "1";
    const includeTimeline = url.searchParams.get("timeline") !== "0";
    const league = url.searchParams.get("league")?.trim().toLowerCase() ?? "great";
    const leagueCap = getLeagueCap(league);

    if (!leftNat || !rightNat) {
      return NextResponse.json(
        { error: "Missing required params: leftNat and rightNat." },
        { status: 400 },
      );
    }

    const leftShields = parseIntInRange(url.searchParams.get("leftShields"), 2, 0, 2);
    const rightShields = parseIntInRange(url.searchParams.get("rightShields"), 2, 0, 2);
    const leftEnergy = parseIntInRange(url.searchParams.get("leftEnergy"), 0, 0, 100);
    const rightEnergy = parseIntInRange(url.searchParams.get("rightEnergy"), 0, 0, 100);
    const maxTurns = parseIntInRange(url.searchParams.get("maxTurns"), 300, 20, 1000);
    const leftIvPreset = parseIvPreset(url.searchParams.get("leftIvPreset"));
    const rightIvPreset = parseIvPreset(url.searchParams.get("rightIvPreset"));
    const leftLevelPreset = parseLevelPreset(url.searchParams.get("leftLevelPreset"));
    const rightLevelPreset = parseLevelPreset(url.searchParams.get("rightLevelPreset"));

    if (
      leftShields === null ||
      rightShields === null ||
      leftEnergy === null ||
      rightEnergy === null ||
      maxTurns === null
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid numeric parameters. Shields: 0-2, Energy: 0-100, maxTurns: 20-1000.",
        },
        { status: 400 },
      );
    }

    const [dataset, leftPoolResult, rightPoolResult] = await Promise.all([
      getPokedexDataset({ forceRefresh: refresh }),
      getResolvedMovePool({ nat: leftNat, forceRefresh: refresh }).catch(() => null),
      getResolvedMovePool({ nat: rightNat, forceRefresh: refresh }).catch(() => null),
    ]);

    const rows = sortRows(dataset.rows);
    const leftRow = findPokemonByNat(rows, leftNat);
    const rightRow = findPokemonByNat(rows, rightNat);

    if (!leftRow || !rightRow) {
      return NextResponse.json(
        { error: "Pokemon not found for provided nat values." },
        { status: 404 },
      );
    }

    const leftPool = leftPoolResult ?? buildFallbackPool(leftRow);
    const rightPool = rightPoolResult ?? buildFallbackPool(rightRow);

    const leftStatsResolved = resolveStatProfile({
      side: "left",
      row: leftRow,
      leagueCap,
      ivPreset: leftIvPreset,
      levelPreset: leftLevelPreset,
      customLevelRaw: url.searchParams.get("leftLevel"),
      customAtkIvRaw: url.searchParams.get("leftAtkIv"),
      customDefIvRaw: url.searchParams.get("leftDefIv"),
      customHpIvRaw: url.searchParams.get("leftHpIv"),
    });
    if ("error" in leftStatsResolved) {
      return NextResponse.json({ error: leftStatsResolved.error }, { status: 400 });
    }

    const rightStatsResolved = resolveStatProfile({
      side: "right",
      row: rightRow,
      leagueCap,
      ivPreset: rightIvPreset,
      levelPreset: rightLevelPreset,
      customLevelRaw: url.searchParams.get("rightLevel"),
      customAtkIvRaw: url.searchParams.get("rightAtkIv"),
      customDefIvRaw: url.searchParams.get("rightDefIv"),
      customHpIvRaw: url.searchParams.get("rightHpIv"),
    });
    if ("error" in rightStatsResolved) {
      return NextResponse.json({ error: rightStatsResolved.error }, { status: 400 });
    }

    const leftBuilt = buildSideInput({
      side: "left",
      row: leftRow,
      stats: leftStatsResolved.data,
      pool: leftPool,
      fastQuery: parseCsv(url.searchParams.get("leftFast")),
      chargedQuery: parseCsv(url.searchParams.get("leftCharged")),
      startingShields: leftShields,
      startingEnergy: leftEnergy,
    });
    if ("error" in leftBuilt) {
      return NextResponse.json({ error: leftBuilt.error }, { status: 400 });
    }

    const rightBuilt = buildSideInput({
      side: "right",
      row: rightRow,
      stats: rightStatsResolved.data,
      pool: rightPool,
      fastQuery: parseCsv(url.searchParams.get("rightFast")),
      chargedQuery: parseCsv(url.searchParams.get("rightCharged")),
      startingShields: rightShields,
      startingEnergy: rightEnergy,
    });
    if ("error" in rightBuilt) {
      return NextResponse.json({ error: rightBuilt.error }, { status: 400 });
    }

    const simulation = simulateBattle(leftBuilt.input, rightBuilt.input, {
      maxTurns,
    });

    const confidence = buildConfidence({
      leftUsedFallbackPool: !leftPoolResult,
      rightUsedFallbackPool: !rightPoolResult,
    });

    return NextResponse.json(
      {
        data: {
          ...simulation,
          timeline: includeTimeline ? simulation.timeline : [],
        },
        meta: {
          league,
          left: {
            nat: leftRow.nat,
            name: leftRow.name,
            usedFallbackPool: !leftPoolResult,
            fast: leftBuilt.selection.fast,
            charged: leftBuilt.selection.charged,
            stats: leftStatsResolved.data,
          },
          right: {
            nat: rightRow.nat,
            name: rightRow.name,
            usedFallbackPool: !rightPoolResult,
            fast: rightBuilt.selection.fast,
            charged: rightBuilt.selection.charged,
            stats: rightStatsResolved.data,
          },
          config: {
            leftShields,
            rightShields,
            leftEnergy,
            rightEnergy,
            maxTurns,
            timelineIncluded: includeTimeline,
          },
          confidence,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to run matchup simulation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
