import type { PokemonRow } from "@/lib/normalize";

export const META_RANK_CACHE_TTL_SECONDS = 6 * 60 * 60;
const META_RANK_CACHE_TTL_MS = META_RANK_CACHE_TTL_SECONDS * 1000;

const META_RANK_BASE_URL = "https://vps.gobattlelog.com/data/overall";

export const META_LEAGUES = ["great", "ultra", "master"] as const;
export type MetaLeague = (typeof META_LEAGUES)[number];
export type MetaTier = "S" | "A" | "B" | "C" | "D";

type RawMetaEntry = {
  speciesId?: string;
  speciesName?: string;
  rating?: number;
};

export type MetaRankEntry = {
  speciesId: string;
  speciesName: string;
  rating: number;
  rank: number;
  tier: MetaTier;
};

export type MetaRankDataset = {
  league: MetaLeague;
  entries: MetaRankEntry[];
  fetchedAt: string;
  sourceUrl: string;
};

type MemoryCache = {
  expiresAt: number;
  value: MetaRankDataset;
};

const LEAGUE_FILE_BY_KEY: Record<MetaLeague, string> = {
  great: "rankings-1500.json",
  ultra: "rankings-2500.json",
  master: "rankings-10000.json",
};

const PREFIX_TOKENS_TO_IGNORE = [
  "mega",
  "shadow",
  "primal",
  "alolan",
  "galarian",
  "hisuian",
  "paldean",
];

const cache: Partial<Record<MetaLeague, MemoryCache>> = {};
const pending: Partial<Record<MetaLeague, Promise<MetaRankDataset>>> = {};

export function normalizeMetaSpeciesKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function buildSpeciesCandidateKeys(name: string): string[] {
  const full = normalizeMetaSpeciesKey(name);
  if (!full) {
    return [];
  }

  const tokens = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const compactWithoutPrefixes = normalizeMetaSpeciesKey(
    tokens.filter((token) => !PREFIX_TOKENS_TO_IGNORE.includes(token)).join(" "),
  );

  const withoutParenthetical = normalizeMetaSpeciesKey(name.replace(/\([^)]*\)/g, " "));

  return [...new Set([full, compactWithoutPrefixes, withoutParenthetical].filter(Boolean))];
}

export function getMetaTier(rank: number, total: number): MetaTier {
  if (rank <= 0 || total <= 0) {
    return "D";
  }

  const sCutoff = Math.max(10, Math.ceil(total * 0.02));
  const aCutoff = Math.max(30, Math.ceil(total * 0.07));
  const bCutoff = Math.max(75, Math.ceil(total * 0.15));
  const cCutoff = Math.max(150, Math.ceil(total * 0.3));

  if (rank <= sCutoff) {
    return "S";
  }
  if (rank <= aCutoff) {
    return "A";
  }
  if (rank <= bCutoff) {
    return "B";
  }
  if (rank <= cCutoff) {
    return "C";
  }
  return "D";
}

function getSourceUrl(league: MetaLeague): string {
  return `${META_RANK_BASE_URL}/${LEAGUE_FILE_BY_KEY[league]}`;
}

function parseLeague(value?: string | null): MetaLeague | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if ((META_LEAGUES as readonly string[]).includes(normalized)) {
    return normalized as MetaLeague;
  }
  return null;
}

function normalizeMetaEntries(rawEntries: RawMetaEntry[]): MetaRankEntry[] {
  const sanitized = rawEntries
    .filter((entry) => typeof entry.speciesId === "string" && typeof entry.speciesName === "string")
    .map((entry) => ({
      speciesId: entry.speciesId as string,
      speciesName: entry.speciesName as string,
      rating: Number.isFinite(entry.rating) ? (entry.rating as number) : 0,
    }));

  sanitized.sort((a, b) => b.rating - a.rating);

  const total = sanitized.length;
  return sanitized.map((entry, index) => {
    const rank = index + 1;
    return {
      ...entry,
      rank,
      tier: getMetaTier(rank, total),
    };
  });
}

function getEntryLookup(entries: MetaRankEntry[]): Map<string, MetaRankEntry> {
  const lookup = new Map<string, MetaRankEntry>();
  for (const entry of entries) {
    const keys = [
      normalizeMetaSpeciesKey(entry.speciesName),
      normalizeMetaSpeciesKey(entry.speciesId),
    ].filter(Boolean);

    for (const key of keys) {
      if (!lookup.has(key)) {
        lookup.set(key, entry);
      }
    }
  }
  return lookup;
}

async function fetchMetaRankDataset(league: MetaLeague): Promise<MetaRankDataset> {
  const sourceUrl = getSourceUrl(league);
  const response = await fetch(sourceUrl, {
    next: { revalidate: META_RANK_CACHE_TTL_SECONDS },
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch meta rank data (${response.status}) for ${league}.`);
  }

  const payload = (await response.json()) as RawMetaEntry[];
  if (!Array.isArray(payload)) {
    throw new Error(`Unexpected meta rank payload for ${league}.`);
  }

  return {
    league,
    entries: normalizeMetaEntries(payload),
    fetchedAt: new Date().toISOString(),
    sourceUrl,
  };
}

export async function getMetaRankDataset(
  leagueInput: MetaLeague | string = "great",
  options?: { forceRefresh?: boolean },
): Promise<MetaRankDataset> {
  const league = parseLeague(leagueInput) ?? "great";
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();
  const cached = cache[league];

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (!forceRefresh && pending[league]) {
    return pending[league] as Promise<MetaRankDataset>;
  }

  pending[league] = (async () => {
    const dataset = await fetchMetaRankDataset(league);
    cache[league] = {
      value: dataset,
      expiresAt: Date.now() + META_RANK_CACHE_TTL_MS,
    };
    return dataset;
  })();

  try {
    return await (pending[league] as Promise<MetaRankDataset>);
  } finally {
    pending[league] = undefined;
  }
}

export function findMetaRankByName(entries: MetaRankEntry[], pokemonName: string): MetaRankEntry | null {
  const lookup = getEntryLookup(entries);
  const candidateKeys = buildSpeciesCandidateKeys(pokemonName);
  for (const key of candidateKeys) {
    const match = lookup.get(key);
    if (match) {
      return match;
    }
  }
  return null;
}

export async function getMetaRankForPokemon(
  pokemon: Pick<PokemonRow, "name">,
  leagueInput: MetaLeague | string = "great",
): Promise<MetaRankEntry | null> {
  const dataset = await getMetaRankDataset(leagueInput);
  return findMetaRankByName(dataset.entries, pokemon.name);
}

export function getMetaLeagueFromSearchParam(value: string | null): MetaLeague {
  return parseLeague(value) ?? "great";
}
