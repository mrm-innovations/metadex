export const GO_POKEMON_TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

export type GoPokemonType = (typeof GO_POKEMON_TYPES)[number];

type AttackEffectiveness = {
  superEffective: GoPokemonType[];
  notVeryEffective: GoPokemonType[];
  immune: GoPokemonType[];
};

type Matchup = {
  attackType: GoPokemonType;
  multiplier: number;
};

export type DefensiveMatchups = {
  weaknesses: Matchup[];
  resistances: Matchup[];
};

const ATTACK_CHART: Record<GoPokemonType, AttackEffectiveness> = {
  normal: {
    superEffective: [],
    notVeryEffective: ["rock", "steel"],
    immune: ["ghost"],
  },
  fire: {
    superEffective: ["grass", "ice", "bug", "steel"],
    notVeryEffective: ["fire", "water", "rock", "dragon"],
    immune: [],
  },
  water: {
    superEffective: ["fire", "ground", "rock"],
    notVeryEffective: ["water", "grass", "dragon"],
    immune: [],
  },
  electric: {
    superEffective: ["water", "flying"],
    notVeryEffective: ["electric", "grass", "dragon"],
    immune: ["ground"],
  },
  grass: {
    superEffective: ["water", "ground", "rock"],
    notVeryEffective: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"],
    immune: [],
  },
  ice: {
    superEffective: ["grass", "ground", "flying", "dragon"],
    notVeryEffective: ["fire", "water", "ice", "steel"],
    immune: [],
  },
  fighting: {
    superEffective: ["normal", "ice", "rock", "dark", "steel"],
    notVeryEffective: ["poison", "flying", "psychic", "bug", "fairy"],
    immune: ["ghost"],
  },
  poison: {
    superEffective: ["grass", "fairy"],
    notVeryEffective: ["poison", "ground", "rock", "ghost"],
    immune: ["steel"],
  },
  ground: {
    superEffective: ["fire", "electric", "poison", "rock", "steel"],
    notVeryEffective: ["grass", "bug"],
    immune: ["flying"],
  },
  flying: {
    superEffective: ["grass", "fighting", "bug"],
    notVeryEffective: ["electric", "rock", "steel"],
    immune: [],
  },
  psychic: {
    superEffective: ["fighting", "poison"],
    notVeryEffective: ["psychic", "steel"],
    immune: ["dark"],
  },
  bug: {
    superEffective: ["grass", "psychic", "dark"],
    notVeryEffective: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"],
    immune: [],
  },
  rock: {
    superEffective: ["fire", "ice", "flying", "bug"],
    notVeryEffective: ["fighting", "ground", "steel"],
    immune: [],
  },
  ghost: {
    superEffective: ["psychic", "ghost"],
    notVeryEffective: ["dark"],
    immune: ["normal"],
  },
  dragon: {
    superEffective: ["dragon"],
    notVeryEffective: ["steel"],
    immune: ["fairy"],
  },
  dark: {
    superEffective: ["psychic", "ghost"],
    notVeryEffective: ["fighting", "dark", "fairy"],
    immune: [],
  },
  steel: {
    superEffective: ["ice", "rock", "fairy"],
    notVeryEffective: ["fire", "water", "electric", "steel"],
    immune: [],
  },
  fairy: {
    superEffective: ["fighting", "dragon", "dark"],
    notVeryEffective: ["fire", "poison", "steel"],
    immune: [],
  },
};

function normalizeType(value?: string): GoPokemonType | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if ((GO_POKEMON_TYPES as readonly string[]).includes(normalized)) {
    return normalized as GoPokemonType;
  }

  return null;
}

function getAttackMultiplierAgainstSingleType(
  attackType: GoPokemonType,
  defenderType: GoPokemonType,
): number {
  const attack = ATTACK_CHART[attackType];
  if (attack.superEffective.includes(defenderType)) {
    return 1.6;
  }
  if (attack.notVeryEffective.includes(defenderType)) {
    return 0.625;
  }
  if (attack.immune.includes(defenderType)) {
    // Pokemon GO maps immunities to double resistance.
    return 0.390625;
  }
  return 1;
}

function roundMultiplier(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

export function getDefensiveMatchups(type1?: string, type2?: string): DefensiveMatchups {
  const t1 = normalizeType(type1);
  const t2 = normalizeType(type2);

  if (!t1) {
    return { weaknesses: [], resistances: [] };
  }

  const weaknesses: Matchup[] = [];
  const resistances: Matchup[] = [];

  for (const attackType of GO_POKEMON_TYPES) {
    const type1Multiplier = getAttackMultiplierAgainstSingleType(attackType, t1);
    const type2Multiplier = t2 ? getAttackMultiplierAgainstSingleType(attackType, t2) : 1;
    const multiplier = roundMultiplier(type1Multiplier * type2Multiplier);

    if (multiplier > 1) {
      weaknesses.push({ attackType, multiplier });
    } else if (multiplier < 1) {
      resistances.push({ attackType, multiplier });
    }
  }

  weaknesses.sort((a, b) => {
    if (a.multiplier !== b.multiplier) {
      return b.multiplier - a.multiplier;
    }
    return a.attackType.localeCompare(b.attackType);
  });

  resistances.sort((a, b) => {
    if (a.multiplier !== b.multiplier) {
      return a.multiplier - b.multiplier;
    }
    return a.attackType.localeCompare(b.attackType);
  });

  return { weaknesses, resistances };
}

export function formatGoMultiplier(multiplier: number): string {
  if (Math.abs(multiplier - 2.56) < 0.0001) {
    return "x2.56";
  }
  if (Math.abs(multiplier - 1.6) < 0.0001) {
    return "x1.6";
  }
  if (Math.abs(multiplier - 0.625) < 0.0001) {
    return "x0.625";
  }
  if (Math.abs(multiplier - 0.390625) < 0.0001) {
    return "x0.39";
  }

  const compact = Number(multiplier.toFixed(3));
  return `x${compact}`;
}

export function formatTypeName(type: GoPokemonType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
