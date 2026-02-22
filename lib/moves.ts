import { parseNatSortValue } from "@/lib/pokedex";
import { type PokemonRow } from "@/lib/normalize";
import { getPokedexDataset } from "@/lib/sheets";

export const MOVE_CACHE_TTL_SECONDS = 12 * 60 * 60;
const MOVE_CACHE_TTL_MS = MOVE_CACHE_TTL_SECONDS * 1000;

const DEFAULT_FAST_MOVES_URL = "https://pogoapi.net/api/v1/fast_moves.json";
const DEFAULT_CHARGED_MOVES_URL = "https://pogoapi.net/api/v1/charged_moves.json";
const DEFAULT_POKEMON_MOVES_URL = "https://pogoapi.net/api/v1/current_pokemon_moves.json";

type MoveCategory = "fast" | "charged";

type RawMoveEntry = Record<string, unknown>;
type RawPokemonMoveEntry = Record<string, unknown>;

type RawMovesOverride = {
  fastMoves?: RawMoveEntry[];
  chargedMoves?: RawMoveEntry[];
  pokemonMoves?: RawPokemonMoveEntry[];
};

export type GoMove = {
  id: string;
  category: MoveCategory;
  name: string;
  type: string | null;
  moveId: number | null;
  power: number | null;
  energyDelta: number | null;
  energyGain: number | null;
  energyCost: number | null;
  durationMs: number | null;
  turns: number | null;
};

export type PokemonMovePool = {
  nat: string;
  baseNat: number | null;
  name: string;
  forms: string[];
  fastMoveIds: string[];
  chargedMoveIds: string[];
  eliteFastMoveIds: string[];
  eliteChargedMoveIds: string[];
};

export type ResolvedPokemonMovePool = {
  nat: string;
  baseNat: number | null;
  name: string;
  forms: string[];
  fastMoves: GoMove[];
  chargedMoves: GoMove[];
  eliteFastMoves: GoMove[];
  eliteChargedMoves: GoMove[];
};

export type MovesDataset = {
  fetchedAt: string;
  sourceUrls: string[];
  warnings: string[];
  moves: GoMove[];
  pools: PokemonMovePool[];
};

type InternalMovesDataset = MovesDataset & {
  moveById: Map<string, GoMove>;
};

type RawSourcePayload = {
  fastMoves: RawMoveEntry[];
  chargedMoves: RawMoveEntry[];
  pokemonMoves: RawPokemonMoveEntry[];
  sourceUrls: string[];
};

type MemoryCache = {
  value: InternalMovesDataset;
  expiresAt: number;
};

type MutablePool = {
  nat: string;
  baseNat: number | null;
  name: string;
  forms: Set<string>;
  fastMoveIds: Set<string>;
  chargedMoveIds: Set<string>;
  eliteFastMoveIds: Set<string>;
  eliteChargedMoveIds: Set<string>;
};

type MutableRawPool = {
  baseNat: number | null;
  name: string;
  forms: Set<string>;
  fastMoveNames: Set<string>;
  chargedMoveNames: Set<string>;
  eliteFastMoveNames: Set<string>;
  eliteChargedMoveNames: Set<string>;
};

let cache: MemoryCache | null = null;
let pending: Promise<InternalMovesDataset> | null = null;

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseStringArray(value: unknown): string[] {
  return toArray(value)
    .map((item) => asNonEmptyString(item))
    .filter((item): item is string => Boolean(item));
}

function parseBaseNat(value: unknown): number | null {
  const num = asNumber(value);
  if (!num || num <= 0) {
    return null;
  }
  return Math.floor(num);
}

function getMoveName(raw: RawMoveEntry): string | null {
  const direct = asNonEmptyString(raw.name);
  if (direct) {
    return direct;
  }

  return (
    asNonEmptyString(raw.move_name) ??
    asNonEmptyString(raw.moveName) ??
    asNonEmptyString(raw.id)
  );
}

function getMoveType(raw: RawMoveEntry): string | null {
  return (
    asNonEmptyString(raw.type) ??
    asNonEmptyString(raw.move_type) ??
    asNonEmptyString(raw.moveType)
  );
}

function getMoveId(raw: RawMoveEntry): number | null {
  return (
    asNumber(raw.move_id) ??
    asNumber(raw.moveId) ??
    asNumber(raw.id)
  );
}

function getMoveDurationMs(raw: RawMoveEntry): number | null {
  return (
    asNumber(raw.duration) ??
    asNumber(raw.duration_ms) ??
    asNumber(raw.durationMs) ??
    asNumber(raw.cooldown) ??
    asNumber(raw.cooldown_ms)
  );
}

function getMovePower(raw: RawMoveEntry): number | null {
  return asNumber(raw.power) ?? asNumber(raw.damage);
}

function getMoveEnergyDelta(raw: RawMoveEntry): number | null {
  return (
    asNumber(raw.energy_delta) ??
    asNumber(raw.energyDelta) ??
    asNumber(raw.energy)
  );
}

function getMoveLookupKey(name: string, category: MoveCategory): string {
  return `${category}:${normalizeKey(name)}`;
}

function parseMovesOverrideFromEnv(): RawMovesOverride | null {
  const rawJson = process.env.POGO_MOVES_OVERRIDE_JSON;
  const rawBase64 = process.env.POGO_MOVES_OVERRIDE_BASE64;

  if (!rawJson && !rawBase64) {
    return null;
  }

  try {
    const payload = rawJson
      ? rawJson
      : Buffer.from(rawBase64 ?? "", "base64").toString("utf8");
    const parsed = JSON.parse(payload) as RawMovesOverride;
    return parsed;
  } catch {
    throw new Error("Invalid POGO_MOVES_OVERRIDE configuration.");
  }
}

function getSourceUrlsFromEnv(): {
  fastMovesUrl: string;
  chargedMovesUrl: string;
  pokemonMovesUrl: string;
} {
  return {
    fastMovesUrl: process.env.POGO_FAST_MOVES_URL ?? DEFAULT_FAST_MOVES_URL,
    chargedMovesUrl: process.env.POGO_CHARGED_MOVES_URL ?? DEFAULT_CHARGED_MOVES_URL,
    pokemonMovesUrl: process.env.POGO_POKEMON_MOVES_URL ?? DEFAULT_POKEMON_MOVES_URL,
  };
}

async function fetchJsonArray(url: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(url, {
    next: { revalidate: MOVE_CACHE_TTL_SECONDS },
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Moves request failed (${response.status}): ${url}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Expected JSON array for moves source: ${url}`);
  }

  return data.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
}

async function loadRawMovePayload(): Promise<RawSourcePayload> {
  const override = parseMovesOverrideFromEnv();
  if (override) {
    return {
      fastMoves: override.fastMoves ?? [],
      chargedMoves: override.chargedMoves ?? [],
      pokemonMoves: override.pokemonMoves ?? [],
      sourceUrls: ["env://POGO_MOVES_OVERRIDE"],
    };
  }

  const { fastMovesUrl, chargedMovesUrl, pokemonMovesUrl } = getSourceUrlsFromEnv();
  const [fastMoves, chargedMoves, pokemonMoves] = await Promise.all([
    fetchJsonArray(fastMovesUrl),
    fetchJsonArray(chargedMovesUrl),
    fetchJsonArray(pokemonMovesUrl),
  ]);

  return {
    fastMoves,
    chargedMoves,
    pokemonMoves,
    sourceUrls: [fastMovesUrl, chargedMovesUrl, pokemonMovesUrl],
  };
}

function createMoveRecord(raw: RawMoveEntry, category: MoveCategory): GoMove | null {
  const name = getMoveName(raw);
  if (!name) {
    return null;
  }

  const moveId = getMoveId(raw);
  const durationMs = getMoveDurationMs(raw);
  const energyDelta = getMoveEnergyDelta(raw);

  return {
    id: moveId !== null ? `${category}-${moveId}` : `${category}-${slugify(name)}`,
    category,
    name,
    type: getMoveType(raw),
    moveId,
    power: getMovePower(raw),
    energyDelta,
    energyGain: energyDelta !== null && energyDelta > 0 ? energyDelta : null,
    energyCost: energyDelta !== null && energyDelta < 0 ? Math.abs(energyDelta) : null,
    durationMs,
    turns: durationMs !== null ? Math.max(1, Math.round(durationMs / 500)) : null,
  };
}

function getPokemonMoveName(raw: RawPokemonMoveEntry): string | null {
  return (
    asNonEmptyString(raw.pokemon_name) ??
    asNonEmptyString(raw.pokemonName) ??
    asNonEmptyString(raw.name)
  );
}

function getPokemonMoveNat(raw: RawPokemonMoveEntry): number | null {
  return (
    parseBaseNat(raw.pokemon_id) ??
    parseBaseNat(raw.pokemonId) ??
    parseBaseNat(raw.dex) ??
    parseBaseNat(raw.nat)
  );
}

function getPokemonMoveForm(raw: RawPokemonMoveEntry): string | null {
  return asNonEmptyString(raw.form) ?? asNonEmptyString(raw.variant);
}

function extractRawPools(rawEntries: RawPokemonMoveEntry[]): MutableRawPool[] {
  const byBaseNat = new Map<number, MutableRawPool>();
  const byName = new Map<string, MutableRawPool>();

  for (const entry of rawEntries) {
    const name = getPokemonMoveName(entry);
    if (!name) {
      continue;
    }

    const baseNat = getPokemonMoveNat(entry);
    const key = baseNat !== null ? `nat:${baseNat}` : `name:${normalizeKey(name)}`;
    const existing =
      (baseNat !== null ? byBaseNat.get(baseNat) : byName.get(normalizeKey(name))) ??
      {
        baseNat,
        name,
        forms: new Set<string>(),
        fastMoveNames: new Set<string>(),
        chargedMoveNames: new Set<string>(),
        eliteFastMoveNames: new Set<string>(),
        eliteChargedMoveNames: new Set<string>(),
      };

    const form = getPokemonMoveForm(entry);
    if (form) {
      existing.forms.add(form);
    }

    for (const value of parseStringArray(entry.fast_moves ?? entry.fastMoves ?? entry.quick_moves ?? entry.quickMoves)) {
      existing.fastMoveNames.add(value);
    }
    for (const value of parseStringArray(entry.charged_moves ?? entry.chargedMoves ?? entry.charge_moves ?? entry.chargeMoves)) {
      existing.chargedMoveNames.add(value);
    }
    for (const value of parseStringArray(entry.elite_fast_moves ?? entry.eliteFastMoves)) {
      existing.eliteFastMoveNames.add(value);
    }
    for (const value of parseStringArray(entry.elite_charged_moves ?? entry.eliteChargedMoves)) {
      existing.eliteChargedMoveNames.add(value);
    }

    if (baseNat !== null) {
      byBaseNat.set(baseNat, existing);
    } else {
      byName.set(normalizeKey(name), existing);
    }

    if (key.startsWith("name:")) {
      byName.set(key.replace("name:", ""), existing);
    }
  }

  return [...byBaseNat.values(), ...byName.values()].filter((pool, index, all) => all.indexOf(pool) === index);
}

function createMoveResolver(
  moveById: Map<string, GoMove>,
  moveIdByLookup: Map<string, string>,
  warnings: string[],
) {
  const syntheticIds = new Set<string>();

  const resolveMoveId = (name: string, category: MoveCategory): string => {
    const lookupKey = getMoveLookupKey(name, category);
    const existing = moveIdByLookup.get(lookupKey);
    if (existing) {
      return existing;
    }

    const syntheticId = `${category}-synthetic-${slugify(name)}`;
    if (!moveById.has(syntheticId)) {
      moveById.set(syntheticId, {
        id: syntheticId,
        category,
        name,
        type: null,
        moveId: null,
        power: null,
        energyDelta: null,
        energyGain: null,
        energyCost: null,
        durationMs: null,
        turns: null,
      });
    }
    moveIdByLookup.set(lookupKey, syntheticId);
    if (!syntheticIds.has(syntheticId)) {
      warnings.push(`Move "${name}" (${category}) missing from move catalog. Added synthetic entry.`);
      syntheticIds.add(syntheticId);
    }
    return syntheticId;
  };

  return resolveMoveId;
}

function buildPools(
  rows: PokemonRow[],
  rawPools: MutableRawPool[],
  resolveMoveId: (name: string, category: MoveCategory) => string,
): PokemonMovePool[] {
  const poolsByNat = new Map<string, MutablePool>();
  const rawByBaseNat = new Map<number, MutableRawPool>();
  const rawByName = new Map<string, MutableRawPool>();

  for (const pool of rawPools) {
    if (pool.baseNat !== null) {
      rawByBaseNat.set(pool.baseNat, pool);
    }
    rawByName.set(normalizeKey(pool.name), pool);
  }

  for (const row of rows) {
    const baseNat = (() => {
      const parsed = parseNatSortValue(row.nat);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
      }
      return Math.floor(parsed);
    })();
    const raw =
      (baseNat !== null ? rawByBaseNat.get(baseNat) : null) ??
      rawByName.get(normalizeKey(row.name));

    if (!raw) {
      continue;
    }

    const existing = poolsByNat.get(row.nat) ?? {
      nat: row.nat,
      baseNat,
      name: row.name,
      forms: new Set<string>(),
      fastMoveIds: new Set<string>(),
      chargedMoveIds: new Set<string>(),
      eliteFastMoveIds: new Set<string>(),
      eliteChargedMoveIds: new Set<string>(),
    };

    for (const value of raw.forms) {
      existing.forms.add(value);
    }
    for (const value of raw.fastMoveNames) {
      existing.fastMoveIds.add(resolveMoveId(value, "fast"));
    }
    for (const value of raw.chargedMoveNames) {
      existing.chargedMoveIds.add(resolveMoveId(value, "charged"));
    }
    for (const value of raw.eliteFastMoveNames) {
      existing.eliteFastMoveIds.add(resolveMoveId(value, "fast"));
    }
    for (const value of raw.eliteChargedMoveNames) {
      existing.eliteChargedMoveIds.add(resolveMoveId(value, "charged"));
    }

    poolsByNat.set(row.nat, existing);
  }

  for (const raw of rawPools) {
    if (raw.baseNat === null) {
      continue;
    }
    const fallbackNat = String(raw.baseNat);
    if (poolsByNat.has(fallbackNat)) {
      continue;
    }

    const fallback: MutablePool = {
      nat: fallbackNat,
      baseNat: raw.baseNat,
      name: raw.name,
      forms: new Set(raw.forms),
      fastMoveIds: new Set<string>(),
      chargedMoveIds: new Set<string>(),
      eliteFastMoveIds: new Set<string>(),
      eliteChargedMoveIds: new Set<string>(),
    };

    for (const value of raw.fastMoveNames) {
      fallback.fastMoveIds.add(resolveMoveId(value, "fast"));
    }
    for (const value of raw.chargedMoveNames) {
      fallback.chargedMoveIds.add(resolveMoveId(value, "charged"));
    }
    for (const value of raw.eliteFastMoveNames) {
      fallback.eliteFastMoveIds.add(resolveMoveId(value, "fast"));
    }
    for (const value of raw.eliteChargedMoveNames) {
      fallback.eliteChargedMoveIds.add(resolveMoveId(value, "charged"));
    }

    poolsByNat.set(fallbackNat, fallback);
  }

  return [...poolsByNat.values()]
    .map((pool) => ({
      nat: pool.nat,
      baseNat: pool.baseNat,
      name: pool.name,
      forms: [...pool.forms].sort((a, b) => a.localeCompare(b)),
      fastMoveIds: [...pool.fastMoveIds].sort((a, b) => a.localeCompare(b)),
      chargedMoveIds: [...pool.chargedMoveIds].sort((a, b) => a.localeCompare(b)),
      eliteFastMoveIds: [...pool.eliteFastMoveIds].sort((a, b) => a.localeCompare(b)),
      eliteChargedMoveIds: [...pool.eliteChargedMoveIds].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => parseNatSortValue(a.nat) - parseNatSortValue(b.nat));
}

function buildDataset(
  payload: RawSourcePayload,
  rows: PokemonRow[],
): InternalMovesDataset {
  const warnings: string[] = [];
  const moveById = new Map<string, GoMove>();
  const moveIdByLookup = new Map<string, string>();

  const pushMove = (raw: RawMoveEntry, category: MoveCategory) => {
    const move = createMoveRecord(raw, category);
    if (!move) {
      return;
    }

    if (!moveById.has(move.id)) {
      moveById.set(move.id, move);
    }

    const lookup = getMoveLookupKey(move.name, category);
    if (!moveIdByLookup.has(lookup)) {
      moveIdByLookup.set(lookup, move.id);
    }
  };

  for (const entry of payload.fastMoves) {
    pushMove(entry, "fast");
  }
  for (const entry of payload.chargedMoves) {
    pushMove(entry, "charged");
  }

  const resolveMoveId = createMoveResolver(moveById, moveIdByLookup, warnings);
  const rawPools = extractRawPools(payload.pokemonMoves);
  const pools = buildPools(rows, rawPools, resolveMoveId);

  const moves = [...moveById.values()].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  if (pools.length === 0) {
    warnings.push("No Pokemon move pools were resolved from source payload.");
  }

  return {
    fetchedAt: new Date().toISOString(),
    sourceUrls: payload.sourceUrls,
    warnings,
    moves,
    pools,
    moveById,
  };
}

function splitCsvParam(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesNat(pool: PokemonMovePool, natParam: string): boolean {
  if (pool.nat === natParam) {
    return true;
  }

  const parsed = parseNatSortValue(natParam);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  return pool.baseNat !== null && pool.baseNat === Math.floor(parsed);
}

function expandMoveIds(ids: string[], moveById: Map<string, GoMove>): GoMove[] {
  const list: GoMove[] = [];
  for (const id of ids) {
    const move = moveById.get(id);
    if (move) {
      list.push(move);
    }
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function toPublicDataset(dataset: InternalMovesDataset): MovesDataset {
  return {
    fetchedAt: dataset.fetchedAt,
    sourceUrls: dataset.sourceUrls,
    warnings: dataset.warnings,
    moves: dataset.moves,
    pools: dataset.pools,
  };
}

export async function getMovesDataset(options?: {
  forceRefresh?: boolean;
}): Promise<MovesDataset> {
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();

  if (!forceRefresh && cache && cache.expiresAt > now) {
    return toPublicDataset(cache.value);
  }

  if (!forceRefresh && pending) {
    const shared = await pending;
    return toPublicDataset(shared);
  }

  pending = (async () => {
    const [rawPayload, pokedex] = await Promise.all([
      loadRawMovePayload(),
      getPokedexDataset(),
    ]);
    const built = buildDataset(rawPayload, pokedex.rows);

    cache = {
      value: built,
      expiresAt: Date.now() + MOVE_CACHE_TTL_MS,
    };

    return built;
  })();

  try {
    const built = await pending;
    return toPublicDataset(built);
  } finally {
    pending = null;
  }
}

export async function getResolvedMovePool(options: {
  nat?: string;
  name?: string;
  forceRefresh?: boolean;
}): Promise<ResolvedPokemonMovePool | null> {
  const forceRefresh = options.forceRefresh ?? false;
  const natQuery = options.nat?.trim();
  const nameQuery = options.name?.trim();
  if (!natQuery && !nameQuery) {
    return null;
  }

  const datasetInternal = await (async () => {
    const now = Date.now();
    if (!forceRefresh && cache && cache.expiresAt > now) {
      return cache.value;
    }

    if (!forceRefresh && pending) {
      return pending;
    }

    pending = (async () => {
      const [rawPayload, pokedex] = await Promise.all([
        loadRawMovePayload(),
        getPokedexDataset(),
      ]);
      const built = buildDataset(rawPayload, pokedex.rows);
      cache = {
        value: built,
        expiresAt: Date.now() + MOVE_CACHE_TTL_MS,
      };
      return built;
    })();

    try {
      return await pending;
    } finally {
      pending = null;
    }
  })();

  const names = new Set(splitCsvParam(nameQuery ?? null).map((item) => normalizeKey(item)));
  const nats = splitCsvParam(natQuery ?? null);

  const pool =
    datasetInternal.pools.find((item) => nats.some((nat) => item.nat === nat)) ??
    datasetInternal.pools.find((item) => nats.some((nat) => matchesNat(item, nat))) ??
    datasetInternal.pools.find((item) => names.has(normalizeKey(item.name)));

  if (!pool) {
    return null;
  }

  return {
    nat: pool.nat,
    baseNat: pool.baseNat,
    name: pool.name,
    forms: pool.forms,
    fastMoves: expandMoveIds(pool.fastMoveIds, datasetInternal.moveById),
    chargedMoves: expandMoveIds(pool.chargedMoveIds, datasetInternal.moveById),
    eliteFastMoves: expandMoveIds(pool.eliteFastMoveIds, datasetInternal.moveById),
    eliteChargedMoves: expandMoveIds(pool.eliteChargedMoveIds, datasetInternal.moveById),
  };
}

export function clearMovesCache(): void {
  cache = null;
  pending = null;
}
