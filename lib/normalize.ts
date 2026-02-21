export type PokemonRow = {
  nat: string;
  name: string;
  type1: string;
  type2?: string;
  pogoHp: number | null;
  pogoAtk: number | null;
  pogoDef: number | null;
  maxCp40: number | null;
  maxCp50: number | null;
  spriteUrl?: string;
  mainHp?: number | null;
  mainAtk?: number | null;
  mainDef?: number | null;
  mainSpa?: number | null;
  mainSpd?: number | null;
  mainSpe?: number | null;
  mainTotal?: number | null;
};

export type PokemonField =
  | "nat"
  | "name"
  | "type1"
  | "type2"
  | "pogoHp"
  | "pogoAtk"
  | "pogoDef"
  | "maxCp40"
  | "maxCp50"
  | "spriteUrl"
  | "mainHp"
  | "mainAtk"
  | "mainDef"
  | "mainSpa"
  | "mainSpd"
  | "mainSpe"
  | "mainTotal";

export type NormalizationMetadata = {
  headers: string[];
  fieldToHeader: Partial<Record<PokemonField, string>>;
  skippedRows: number;
};

const FIELD_ALIASES: Record<PokemonField, string[]> = {
  nat: ["nat", "nationaldex", "national", "dexnumber", "pokedex", "number"],
  name: ["pokemon", "name", "pokmon"],
  type1: ["typei", "type1", "primarytype", "typeprimary"],
  type2: ["typeii", "type2", "secondarytype", "typesecondary"],
  pogoHp: ["hppogo", "gohp", "hpgo", "finalhp", "hpnerf"],
  pogoAtk: ["atkpogo", "goatk", "atkgo", "finalatk", "atknerf"],
  pogoDef: ["defpogo", "godef", "defgo", "finaldef", "defnerf"],
  maxCp40: [
    "maxcplvl40",
    "maxcp40",
    "maxcplevel40",
    "finalcplvl40iv100",
    "maxcpnerflvl40",
  ],
  maxCp50: [
    "maxcplvl50",
    "maxcp50",
    "maxcplevel50",
    "finalcplvl50iv100",
    "maxcpnerflvl50",
  ],
  spriteUrl: ["spriteurl", "sprite", "image", "img", "icon", "picture"],
  mainHp: ["hp"],
  mainAtk: ["atk", "attack"],
  mainDef: ["def", "defense"],
  mainSpa: ["spa", "specialattack", "spatk"],
  mainSpd: ["spd", "specialdefense", "spdef"],
  mainSpe: ["spe", "speed"],
  mainTotal: ["total", "basestattotal"],
};

function canonicalHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanCell(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.replace(/\uFEFF/g, "").trim();
}

function parseNumber(value: string | undefined): number | null {
  const cleaned = cleanCell(value).replace(/,/g, "");
  if (!cleaned) {
    return null;
  }

  const normalized = cleaned.replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseImageCell(value: string | undefined): string | undefined {
  const cell = cleanCell(value);
  if (!cell) {
    return undefined;
  }

  if (/^https?:\/\//i.test(cell)) {
    return cell;
  }

  const matched = cell.match(/https?:\/\/[^")\s]+/i);
  return matched?.[0];
}

function buildSpriteFromNat(nat: string): string | undefined {
  const numericPart = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numericPart)) {
    return undefined;
  }

  const dexNumber = Math.floor(numericPart);
  if (dexNumber <= 0) {
    return undefined;
  }

  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexNumber}.png`;
}

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    if (char === "\r") {
      if (csv[i + 1] === "\n") {
        continue;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cleanCell(cell).length > 0));
}

function resolveHeaders(headers: string[]): {
  indexToHeader: string[];
  fieldToIndex: Partial<Record<PokemonField, number>>;
  fieldToHeader: Partial<Record<PokemonField, string>>;
} {
  const indexToHeader = headers.map((h, index) => {
    const trimmed = cleanCell(h);
    return trimmed || `column_${index + 1}`;
  });

  const canonicalToIndex = new Map<string, number>();
  indexToHeader.forEach((header, index) => {
    const canonical = canonicalHeader(header);
    if (!canonical || canonicalToIndex.has(canonical)) {
      return;
    }
    canonicalToIndex.set(canonical, index);
  });

  const findMatch = (
    field: PokemonField,
    fallbackMatch?: (canonical: string) => boolean,
  ): number | undefined => {
    for (const alias of FIELD_ALIASES[field]) {
      const match = canonicalToIndex.get(canonicalHeader(alias));
      if (match !== undefined) {
        return match;
      }
    }

    if (!fallbackMatch) {
      return undefined;
    }

    for (let i = 0; i < indexToHeader.length; i += 1) {
      if (fallbackMatch(canonicalHeader(indexToHeader[i]))) {
        return i;
      }
    }

    return undefined;
  };

  const fieldToIndex: Partial<Record<PokemonField, number>> = {
    nat: findMatch("nat"),
    name: findMatch("name"),
    type1: findMatch("type1", (h) => h.includes("type") && (h.endsWith("i") || h.endsWith("1"))),
    type2: findMatch("type2", (h) => h.includes("type") && (h.includes("ii") || h.endsWith("2"))),
    pogoHp: findMatch("pogoHp", (h) => h.includes("hp") && (h.includes("pogo") || h.includes("final"))),
    pogoAtk: findMatch("pogoAtk", (h) => h.includes("atk") && (h.includes("pogo") || h.includes("final"))),
    pogoDef: findMatch("pogoDef", (h) => h.includes("def") && (h.includes("pogo") || h.includes("final"))),
    maxCp40: findMatch("maxCp40", (h) => h.includes("cp") && h.includes("40")),
    maxCp50: findMatch("maxCp50", (h) => h.includes("cp") && h.includes("50")),
    spriteUrl: findMatch("spriteUrl", (h) => h.includes("image") || h.includes("sprite")),
    mainHp: findMatch("mainHp"),
    mainAtk: findMatch("mainAtk"),
    mainDef: findMatch("mainDef"),
    mainSpa: findMatch("mainSpa"),
    mainSpd: findMatch("mainSpd"),
    mainSpe: findMatch("mainSpe"),
    mainTotal: findMatch("mainTotal"),
  };

  const fieldToHeader: Partial<Record<PokemonField, string>> = {};
  for (const [field, index] of Object.entries(fieldToIndex) as Array<[PokemonField, number | undefined]>) {
    if (index !== undefined) {
      fieldToHeader[field] = indexToHeader[index];
    }
  }

  return { indexToHeader, fieldToIndex, fieldToHeader };
}

function at(row: string[], index: number | undefined): string | undefined {
  if (index === undefined) {
    return undefined;
  }
  return row[index];
}

export function normalizePokedexRows(csv: string): {
  rows: PokemonRow[];
  metadata: NormalizationMetadata;
} {
  const matrix = parseCsv(csv);
  if (matrix.length === 0) {
    return {
      rows: [],
      metadata: { headers: [], fieldToHeader: {}, skippedRows: 0 },
    };
  }

  const [headerRow, ...dataRows] = matrix;
  const { indexToHeader, fieldToIndex, fieldToHeader } = resolveHeaders(headerRow);

  let skippedRows = 0;
  const rows: PokemonRow[] = [];

  for (const sourceRow of dataRows) {
    const nat = cleanCell(at(sourceRow, fieldToIndex.nat));
    const name = cleanCell(at(sourceRow, fieldToIndex.name));

    if (!nat || !name) {
      skippedRows += 1;
      continue;
    }

    const spriteUrl =
      parseImageCell(at(sourceRow, fieldToIndex.spriteUrl)) ?? buildSpriteFromNat(nat);

    rows.push({
      nat,
      name,
      type1: cleanCell(at(sourceRow, fieldToIndex.type1)) || "Unknown",
      type2: cleanCell(at(sourceRow, fieldToIndex.type2)) || undefined,
      pogoHp: parseNumber(at(sourceRow, fieldToIndex.pogoHp)),
      pogoAtk: parseNumber(at(sourceRow, fieldToIndex.pogoAtk)),
      pogoDef: parseNumber(at(sourceRow, fieldToIndex.pogoDef)),
      maxCp40: parseNumber(at(sourceRow, fieldToIndex.maxCp40)),
      maxCp50: parseNumber(at(sourceRow, fieldToIndex.maxCp50)),
      spriteUrl,
      mainHp: parseNumber(at(sourceRow, fieldToIndex.mainHp)),
      mainAtk: parseNumber(at(sourceRow, fieldToIndex.mainAtk)),
      mainDef: parseNumber(at(sourceRow, fieldToIndex.mainDef)),
      mainSpa: parseNumber(at(sourceRow, fieldToIndex.mainSpa)),
      mainSpd: parseNumber(at(sourceRow, fieldToIndex.mainSpd)),
      mainSpe: parseNumber(at(sourceRow, fieldToIndex.mainSpe)),
      mainTotal: parseNumber(at(sourceRow, fieldToIndex.mainTotal)),
    });
  }

  return {
    rows,
    metadata: {
      headers: indexToHeader,
      fieldToHeader,
      skippedRows,
    },
  };
}
