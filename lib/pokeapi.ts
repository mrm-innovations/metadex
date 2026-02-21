const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
export const POKEAPI_CACHE_TTL_SECONDS = 24 * 60 * 60;
const POKEAPI_CACHE_TTL_MS = POKEAPI_CACHE_TTL_SECONDS * 1000;

type NamedResource = {
  name: string;
  url: string;
};

type PokemonSpeciesResponse = {
  id: number;
  name: string;
  is_legendary: boolean;
  is_mythical: boolean;
  evolution_chain?: {
    url: string;
  };
};

type EvolutionChainResponse = {
  id: number;
  chain: EvolutionChainLink;
};

type EvolutionChainLink = {
  species: NamedResource;
  evolves_to: EvolutionChainLink[];
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export type EvolutionNode = {
  nat: number | null;
  name: string;
  displayName: string;
  spriteUrl?: string;
  children: EvolutionNode[];
};

export type EvolutionChainResult = {
  speciesNat: number;
  chainId: number;
  root: EvolutionNode;
};

type EvolutionOverrideEntry = {
  chainId: number;
  root: EvolutionNode;
};

type SpeciesOverrideEntry = {
  name?: string;
  isLegendary?: boolean;
  isMythical?: boolean;
  evolutionChainUrl?: string;
};

const speciesCache = new Map<number, CacheEntry<PokemonSpeciesResponse>>();
const chainCache = new Map<string, CacheEntry<EvolutionChainResult>>();
const pendingSpecies = new Map<number, Promise<PokemonSpeciesResponse>>();
const pendingChain = new Map<string, Promise<EvolutionChainResult>>();
let parsedEvolutionOverrides: Record<string, EvolutionOverrideEntry> | null | undefined = undefined;
let parsedSpeciesOverrides: Record<string, SpeciesOverrideEntry> | null | undefined = undefined;

export type PokemonClassification = "Legendary" | "Mythical" | null;

function now() {
  return Date.now();
}

function titleCasePokemonName(name: string): string {
  return name
    .split("-")
    .map((part) => {
      if (!part) {
        return part;
      }
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function parseNatFromSpeciesUrl(url: string): number | null {
  const match = url.match(/\/pokemon-species\/(\d+)\/?$/i);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

function buildArtworkUrl(nat: number | null): string | undefined {
  if (!nat || nat <= 0) {
    return undefined;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${nat}.png`;
}

function normalizeChainLink(link: EvolutionChainLink): EvolutionNode {
  const nat = parseNatFromSpeciesUrl(link.species.url);
  return {
    nat,
    name: link.species.name,
    displayName: titleCasePokemonName(link.species.name),
    spriteUrl: buildArtworkUrl(nat),
    children: link.evolves_to.map(normalizeChainLink),
  };
}

function resolveSpeciesNat(nat: string | number): number | null {
  const parsed =
    typeof nat === "number" ? nat : Number.parseFloat(nat.trim().replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function parseEvolutionOverridesFromEnv(): Record<string, EvolutionOverrideEntry> | null {
  if (parsedEvolutionOverrides !== undefined) {
    return parsedEvolutionOverrides;
  }

  const rawJson = process.env.POKEAPI_EVOLUTION_OVERRIDES_JSON;
  const rawBase64 = process.env.POKEAPI_EVOLUTION_OVERRIDES_BASE64;

  if (!rawJson && !rawBase64) {
    parsedEvolutionOverrides = null;
    return parsedEvolutionOverrides;
  }

  try {
    const json = rawJson
      ? rawJson
      : Buffer.from(rawBase64 ?? "", "base64").toString("utf8");
    const parsed = JSON.parse(json) as Record<string, EvolutionOverrideEntry>;
    parsedEvolutionOverrides = parsed;
    return parsedEvolutionOverrides;
  } catch {
    throw new Error("Invalid POKEAPI_EVOLUTION_OVERRIDES configuration.");
  }
}

function parseSpeciesOverridesFromEnv(): Record<string, SpeciesOverrideEntry> | null {
  if (parsedSpeciesOverrides !== undefined) {
    return parsedSpeciesOverrides;
  }

  const rawJson = process.env.POKEAPI_SPECIES_OVERRIDES_JSON;
  const rawBase64 = process.env.POKEAPI_SPECIES_OVERRIDES_BASE64;

  if (!rawJson && !rawBase64) {
    parsedSpeciesOverrides = null;
    return parsedSpeciesOverrides;
  }

  try {
    const json = rawJson ? rawJson : Buffer.from(rawBase64 ?? "", "base64").toString("utf8");
    const parsed = JSON.parse(json) as Record<string, SpeciesOverrideEntry>;
    parsedSpeciesOverrides = parsed;
    return parsedSpeciesOverrides;
  } catch {
    throw new Error("Invalid POKEAPI_SPECIES_OVERRIDES configuration.");
  }
}

function getSpeciesOverride(speciesNat: number): PokemonSpeciesResponse | null {
  const overrides = parseSpeciesOverridesFromEnv();
  if (!overrides) {
    return null;
  }

  const entry = overrides[String(speciesNat)];
  if (!entry) {
    return null;
  }

  return {
    id: speciesNat,
    name: entry.name ?? `pokemon-${speciesNat}`,
    is_legendary: entry.isLegendary ?? false,
    is_mythical: entry.isMythical ?? false,
    evolution_chain: entry.evolutionChainUrl
      ? {
          url: entry.evolutionChainUrl,
        }
      : undefined,
  };
}

function getEvolutionOverride(speciesNat: number): EvolutionChainResult | null {
  const overrides = parseEvolutionOverridesFromEnv();
  if (!overrides) {
    return null;
  }

  const entry = overrides[String(speciesNat)];
  if (!entry) {
    return null;
  }

  return {
    speciesNat,
    chainId: entry.chainId,
    root: entry.root,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    next: { revalidate: POKEAPI_CACHE_TTL_SECONDS },
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`PokeAPI request failed (${response.status}): ${url}`);
  }

  return (await response.json()) as T;
}

async function getSpecies(speciesNat: number, forceRefresh = false): Promise<PokemonSpeciesResponse> {
  const speciesOverride = getSpeciesOverride(speciesNat);
  if (speciesOverride) {
    return speciesOverride;
  }

  const cached = speciesCache.get(speciesNat);
  if (!forceRefresh && cached && cached.expiresAt > now()) {
    return cached.value;
  }

  if (!forceRefresh) {
    const pending = pendingSpecies.get(speciesNat);
    if (pending) {
      return pending;
    }
  }

  const promise = (async () => {
    const data = await fetchJson<PokemonSpeciesResponse>(
      `${POKEAPI_BASE_URL}/pokemon-species/${speciesNat}`,
    );
    speciesCache.set(speciesNat, {
      value: data,
      expiresAt: now() + POKEAPI_CACHE_TTL_MS,
    });
    return data;
  })();

  pendingSpecies.set(speciesNat, promise);
  try {
    return await promise;
  } finally {
    pendingSpecies.delete(speciesNat);
  }
}

export async function getEvolutionChainForNat(
  nat: string | number,
  options?: { forceRefresh?: boolean },
): Promise<EvolutionChainResult> {
  const speciesNat = resolveSpeciesNat(nat);
  if (!speciesNat) {
    throw new Error("Invalid nat value. Expected a positive Pokemon dex number.");
  }

  const override = getEvolutionOverride(speciesNat);
  if (override) {
    return override;
  }

  const forceRefresh = options?.forceRefresh ?? false;
  const species = await getSpecies(speciesNat, forceRefresh);

  if (!species.evolution_chain?.url) {
    throw new Error(`No evolution chain found for species nat ${speciesNat}.`);
  }

  const chainUrl = species.evolution_chain.url;
  const cached = chainCache.get(chainUrl);
  if (!forceRefresh && cached && cached.expiresAt > now()) {
    return cached.value;
  }

  if (!forceRefresh) {
    const pending = pendingChain.get(chainUrl);
    if (pending) {
      return pending;
    }
  }

  const promise = (async () => {
    const chainResponse = await fetchJson<EvolutionChainResponse>(chainUrl);
    const result: EvolutionChainResult = {
      speciesNat,
      chainId: chainResponse.id,
      root: normalizeChainLink(chainResponse.chain),
    };

    chainCache.set(chainUrl, {
      value: result,
      expiresAt: now() + POKEAPI_CACHE_TTL_MS,
    });

    return result;
  })();

  pendingChain.set(chainUrl, promise);
  try {
    return await promise;
  } finally {
    pendingChain.delete(chainUrl);
  }
}

export async function getPokemonClassificationForNat(
  nat: string | number,
  options?: { forceRefresh?: boolean },
): Promise<PokemonClassification> {
  const speciesNat = resolveSpeciesNat(nat);
  if (!speciesNat) {
    throw new Error("Invalid nat value. Expected a positive Pokemon dex number.");
  }

  const species = await getSpecies(speciesNat, options?.forceRefresh ?? false);

  if (species.is_mythical) {
    return "Mythical";
  }
  if (species.is_legendary) {
    return "Legendary";
  }
  return null;
}

export function clearPokeApiCache(): void {
  speciesCache.clear();
  chainCache.clear();
  pendingSpecies.clear();
  pendingChain.clear();
  parsedEvolutionOverrides = undefined;
  parsedSpeciesOverrides = undefined;
}
