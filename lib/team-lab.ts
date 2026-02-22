import { DETAIL_LEAGUE_OPTIONS, type DetailLeague } from "@/lib/detail-league";
import { type PokemonRow } from "@/lib/normalize";
import { GO_POKEMON_TYPES, getDefensiveMatchups, type GoPokemonType } from "@/lib/type-effectiveness";

const SCORE_WEIGHT_COVERAGE = 0.68;
const SCORE_WEIGHT_LEAGUE_FIT = 0.22;
const SCORE_WEIGHT_DIVERSITY = 0.1;

export type LeagueFitContext = {
  fieldMax: {
    pogoAtk: number;
    pogoDef: number;
    pogoHp: number;
    maxCp50: number;
  };
  bulkMax: number;
  cpMax: number;
};

export type TeamThreatEntry = {
  type: GoPokemonType;
  weaknessWeight: number;
  resistanceWeight: number;
  net: number;
  pressure: number;
};

export type TeamMemberEntry = {
  nat: string;
  name: string;
  leagueFit: number;
  weaknesses: GoPokemonType[];
  resistances: GoPokemonType[];
  coversForTeam: GoPokemonType[];
  uniqueCoverage: GoPokemonType[];
};

export type TeamScoreBreakdown = {
  weights: {
    coverage: number;
    leagueFit: number;
    diversity: number;
  };
  components: {
    coverage: number;
    leagueFit: number;
    diversity: number;
  };
  weighted: {
    coverage: number;
    leagueFit: number;
    diversity: number;
  };
};

export type TeamAnalysis = {
  score: number;
  coverageRatio: number;
  avgLeagueFit: number;
  diversityRatio: number;
  coveredTypes: GoPokemonType[];
  uncoveredTypes: GoPokemonType[];
  perMemberLeagueFit: Array<{ nat: string; name: string; leagueFit: number }>;
  members: TeamMemberEntry[];
  scoreBreakdown: TeamScoreBreakdown;
  topThreats: TeamThreatEntry[];
};

function getFieldMax(rows: PokemonRow[], field: "pogoAtk" | "pogoDef" | "pogoHp" | "maxCp50"): number {
  let max = 0;
  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined) {
      continue;
    }
    if (value > max) {
      max = value;
    }
  }
  return max > 0 ? max : 1;
}

function getPowerScore(row: PokemonRow, context: LeagueFitContext): number {
  const values: number[] = [];
  const fields: Array<"pogoAtk" | "pogoDef" | "pogoHp" | "maxCp50"> = [
    "pogoAtk",
    "pogoDef",
    "pogoHp",
    "maxCp50",
  ];

  for (const field of fields) {
    const value = row[field];
    if (value === null || value === undefined) {
      continue;
    }
    const max = context.fieldMax[field] ?? 1;
    values.push(Math.min(1, value / max));
  }

  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function getBulkStatProduct(row: PokemonRow): number {
  const atk = row.pogoAtk ?? 0;
  const def = row.pogoDef ?? 0;
  const hp = row.pogoHp ?? 0;
  if (atk <= 0 || def <= 0 || hp <= 0) {
    return 0;
  }
  return (def * hp) / atk;
}

function createRankingContext(rows: PokemonRow[]): LeagueFitContext {
  let bulkMax = 0;
  let cpMax = 0;
  for (const row of rows) {
    bulkMax = Math.max(bulkMax, getBulkStatProduct(row));
    cpMax = Math.max(cpMax, row.maxCp50 ?? row.maxCp40 ?? 0);
  }

  return {
    fieldMax: {
      pogoAtk: getFieldMax(rows, "pogoAtk"),
      pogoDef: getFieldMax(rows, "pogoDef"),
      pogoHp: getFieldMax(rows, "pogoHp"),
      maxCp50: getFieldMax(rows, "maxCp50"),
    },
    bulkMax: bulkMax > 0 ? bulkMax : 1,
    cpMax: cpMax > 0 ? cpMax : 1,
  };
}

function getLeagueFit(
  row: PokemonRow,
  league: DetailLeague,
  context: LeagueFitContext,
): number {
  const cpPotential = row.maxCp50 ?? row.maxCp40 ?? 0;
  const powerScore = getPowerScore(row, context);

  if (league === "master") {
    const cpScore = Math.min(1, cpPotential / context.cpMax);
    return cpScore * 0.55 + powerScore * 0.45;
  }

  const cap = DETAIL_LEAGUE_OPTIONS[league].pvpCap;
  const reachCap = Math.min(1, cpPotential / cap);
  const bulkScore = Math.min(1, getBulkStatProduct(row) / context.bulkMax);
  return reachCap * 0.6 + bulkScore * 0.4;
}

export function createLeagueFitContext(rows: PokemonRow[]): LeagueFitContext {
  return createRankingContext(rows);
}

export function getLeagueFitScore(
  row: PokemonRow,
  league: DetailLeague,
  context: LeagueFitContext,
): number {
  return getLeagueFit(row, league, context);
}

function getTeamDiversityRatio(rows: PokemonRow[]): number {
  const types = new Set<string>();
  for (const row of rows) {
    if (row.type1) {
      types.add(row.type1.toLowerCase());
    }
    if (row.type2) {
      types.add(row.type2.toLowerCase());
    }
  }
  return Math.min(1, types.size / 6);
}

function getResistanceBoost(multiplier: number): number {
  if (multiplier <= 0.390625) {
    return 1.4;
  }
  if (multiplier <= 0.625) {
    return 1;
  }
  return 0;
}

export function analyzeTeam(
  rows: PokemonRow[],
  allRows: PokemonRow[],
  league: DetailLeague,
): TeamAnalysis {
  if (rows.length === 0) {
    return {
      score: 0,
      coverageRatio: 0,
      avgLeagueFit: 0,
      diversityRatio: 0,
      coveredTypes: [],
      uncoveredTypes: [],
      perMemberLeagueFit: [],
      members: [],
      scoreBreakdown: {
        weights: {
          coverage: SCORE_WEIGHT_COVERAGE,
          leagueFit: SCORE_WEIGHT_LEAGUE_FIT,
          diversity: SCORE_WEIGHT_DIVERSITY,
        },
        components: {
          coverage: 0,
          leagueFit: 0,
          diversity: 0,
        },
        weighted: {
          coverage: 0,
          leagueFit: 0,
          diversity: 0,
        },
      },
      topThreats: [],
    };
  }

  const context = createLeagueFitContext(allRows);
  const perMemberLeagueFit = rows.map((row) => ({
    nat: row.nat,
    name: row.name,
    leagueFit: getLeagueFit(row, league, context),
  }));
  const avgLeagueFit =
    perMemberLeagueFit.reduce((sum, item) => sum + item.leagueFit, 0) / perMemberLeagueFit.length;

  let totalWeaknessWeight = 0;
  let coveredWeaknessWeight = 0;
  const coveredTypes = new Set<GoPokemonType>();
  const uncoveredTypes = new Set<GoPokemonType>();

  const weaknessByType = new Map<GoPokemonType, number>();
  const resistanceByType = new Map<GoPokemonType, number>();

  const matchups = rows.map((row) => getDefensiveMatchups(row.type1, row.type2));
  const weaknessSets = matchups.map(
    (matchup) => new Set(matchup.weaknesses.map((item) => item.attackType)),
  );
  const resistanceSets = matchups.map(
    (matchup) => new Set(matchup.resistances.map((item) => item.attackType)),
  );

  for (let i = 0; i < rows.length; i += 1) {
    const weaknesses = matchups[i].weaknesses;
    for (const weakness of weaknesses) {
      totalWeaknessWeight += weakness.multiplier;
      weaknessByType.set(
        weakness.attackType,
        (weaknessByType.get(weakness.attackType) ?? 0) + weakness.multiplier,
      );

      let isCoveredByTeammate = false;
      for (let j = 0; j < rows.length; j += 1) {
        if (i === j) {
          continue;
        }
        const resist = matchups[j].resistances.find(
          (item) => item.attackType === weakness.attackType,
        );
        if (!resist) {
          continue;
        }
        isCoveredByTeammate = true;
        resistanceByType.set(
          weakness.attackType,
          (resistanceByType.get(weakness.attackType) ?? 0) + getResistanceBoost(resist.multiplier),
        );
      }

      if (isCoveredByTeammate) {
        coveredWeaknessWeight += weakness.multiplier;
        coveredTypes.add(weakness.attackType);
      } else {
        uncoveredTypes.add(weakness.attackType);
      }
    }
  }

  const coverageRatio =
    totalWeaknessWeight > 0 ? coveredWeaknessWeight / totalWeaknessWeight : 1;
  const diversityRatio = getTeamDiversityRatio(rows);
  const score =
    coverageRatio * SCORE_WEIGHT_COVERAGE +
    avgLeagueFit * SCORE_WEIGHT_LEAGUE_FIT +
    diversityRatio * SCORE_WEIGHT_DIVERSITY;

  const scoreBreakdown: TeamScoreBreakdown = {
    weights: {
      coverage: SCORE_WEIGHT_COVERAGE,
      leagueFit: SCORE_WEIGHT_LEAGUE_FIT,
      diversity: SCORE_WEIGHT_DIVERSITY,
    },
    components: {
      coverage: coverageRatio,
      leagueFit: avgLeagueFit,
      diversity: diversityRatio,
    },
    weighted: {
      coverage: coverageRatio * SCORE_WEIGHT_COVERAGE,
      leagueFit: avgLeagueFit * SCORE_WEIGHT_LEAGUE_FIT,
      diversity: diversityRatio * SCORE_WEIGHT_DIVERSITY,
    },
  };

  const topThreats = GO_POKEMON_TYPES.map((type) => {
    const weaknessWeight = weaknessByType.get(type) ?? 0;
    const resistanceWeight = resistanceByType.get(type) ?? 0;
    const net = weaknessWeight - resistanceWeight;
    return {
      type,
      weaknessWeight,
      resistanceWeight,
      net,
      pressure: weaknessWeight > 0 ? Math.max(0, net / weaknessWeight) : 0,
    };
  })
    .filter((item) => item.net > 0)
    .sort((a, b) => {
      if (a.net !== b.net) {
        return b.net - a.net;
      }
      return a.type.localeCompare(b.type);
    })
    .slice(0, 5);

  const members: TeamMemberEntry[] = rows.map((row, index) => {
    const memberResists = resistanceSets[index];
    const coversForTeam = new Set<GoPokemonType>();
    const uniqueCoverage = new Set<GoPokemonType>();

    for (const threatType of GO_POKEMON_TYPES) {
      if (!memberResists.has(threatType)) {
        continue;
      }

      const teammatesWeakToType = rows.some(
        (_, teammateIndex) => teammateIndex !== index && weaknessSets[teammateIndex].has(threatType),
      );
      if (!teammatesWeakToType) {
        continue;
      }

      coversForTeam.add(threatType);

      const otherResists = rows.some(
        (_, teammateIndex) =>
          teammateIndex !== index && resistanceSets[teammateIndex].has(threatType),
      );
      if (!otherResists) {
        uniqueCoverage.add(threatType);
      }
    }

    return {
      nat: row.nat,
      name: row.name,
      leagueFit: perMemberLeagueFit[index]?.leagueFit ?? 0,
      weaknesses: [...weaknessSets[index]].sort((a, b) => a.localeCompare(b)),
      resistances: [...resistanceSets[index]].sort((a, b) => a.localeCompare(b)),
      coversForTeam: [...coversForTeam].sort((a, b) => a.localeCompare(b)),
      uniqueCoverage: [...uniqueCoverage].sort((a, b) => a.localeCompare(b)),
    };
  });

  return {
    score,
    coverageRatio,
    avgLeagueFit,
    diversityRatio,
    coveredTypes: [...coveredTypes].sort((a, b) => a.localeCompare(b)),
    uncoveredTypes: [...uncoveredTypes].sort((a, b) => a.localeCompare(b)),
    perMemberLeagueFit,
    members,
    scoreBreakdown,
    topThreats,
  };
}
