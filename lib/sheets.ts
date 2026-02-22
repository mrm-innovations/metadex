import { normalizePokedexRows, type PokemonRow } from "@/lib/normalize";

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QDk6pGO6hbh3GrdeJp_0bx-xVMiG0zYAfpWZUV7ZaME/edit?gid=746396920#gid=746396920";

export const POKEDEX_CACHE_TTL_SECONDS = 15 * 60;
const POKEDEX_CACHE_TTL_MS = POKEDEX_CACHE_TTL_SECONDS * 1000;

type CsvSource = {
  sheetId: string;
  gid: string;
};

export type PokedexDataset = {
  rows: PokemonRow[];
  sourceUrl: string;
  fetchedAt: string;
  headers: string[];
  fieldToHeader: Record<string, string>;
  skippedRows: number;
};

type MemoryCache = {
  expiresAt: number;
  value: PokedexDataset;
};

let cache: MemoryCache | null = null;
let pending: Promise<PokedexDataset> | null = null;

function parseSheetUrl(sheetUrl: string): CsvSource {
  const url = new URL(sheetUrl);
  const idMatch = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = idMatch?.[1];
  const gidFromQuery = url.searchParams.get("gid");
  const gidFromHash = url.hash.match(/gid=([0-9]+)/)?.[1];
  const gid = gidFromQuery ?? gidFromHash;

  if (!sheetId || !gid) {
    throw new Error("Unable to parse Google Sheet URL. Expected sheet ID and gid.");
  }

  return { sheetId, gid };
}

export function buildGoogleSheetCsvExportUrls(sheetUrl: string): string[] {
  const { sheetId, gid } = parseSheetUrl(sheetUrl);

  return [
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
  ];
}

async function fetchCsv(urls: string[]): Promise<{ csv: string; sourceUrl: string }> {
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        next: { revalidate: POKEDEX_CACHE_TTL_SECONDS },
        cache: "force-cache",
      });

      if (!response.ok) {
        errors.push(`${url} (${response.status})`);
        continue;
      }

      const csv = await response.text();
      if (!csv.trim()) {
        errors.push(`${url} (empty response)`);
        continue;
      }

      return { csv, sourceUrl: url };
    } catch (error) {
      errors.push(`${url} (${error instanceof Error ? error.message : "unknown error"})`);
    }
  }

  throw new Error(`Unable to download sheet CSV. Tried URLs: ${errors.join(", ")}`);
}

function buildDataset(csv: string, sourceUrl: string): PokedexDataset {
  const normalized = normalizePokedexRows(csv);
  return {
    rows: normalized.rows,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    headers: normalized.metadata.headers,
    fieldToHeader: normalized.metadata.fieldToHeader as Record<string, string>,
    skippedRows: normalized.metadata.skippedRows,
  };
}

function getConfiguredSheetUrl(): string {
  return process.env.POKEDEX_SHEET_URL ?? DEFAULT_SHEET_URL;
}

function getCsvOverrideFromEnv(): string | null {
  const rawOverride = process.env.POKEDEX_CSV_OVERRIDE;
  if (rawOverride && rawOverride.trim()) {
    return rawOverride;
  }

  const base64Override = process.env.POKEDEX_CSV_BASE64;
  if (base64Override && base64Override.trim()) {
    try {
      return Buffer.from(base64Override, "base64").toString("utf8");
    } catch {
      throw new Error("Invalid POKEDEX_CSV_BASE64 value.");
    }
  }

  return null;
}

export async function getPokedexDataset(options?: {
  forceRefresh?: boolean;
}): Promise<PokedexDataset> {
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();

  if (!forceRefresh && cache && cache.expiresAt > now) {
    return cache.value;
  }

  if (!forceRefresh && pending) {
    return pending;
  }

  pending = (async () => {
    const overrideCsv = getCsvOverrideFromEnv();
    if (overrideCsv) {
      const dataset = buildDataset(overrideCsv, "env://POKEDEX_CSV_OVERRIDE");
      cache = {
        value: dataset,
        expiresAt: Date.now() + POKEDEX_CACHE_TTL_MS,
      };
      return dataset;
    }

    const urls = buildGoogleSheetCsvExportUrls(getConfiguredSheetUrl());
    const { csv, sourceUrl } = await fetchCsv(urls);
    const dataset = buildDataset(csv, sourceUrl);

    cache = {
      value: dataset,
      expiresAt: Date.now() + POKEDEX_CACHE_TTL_MS,
    };

    return dataset;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}

export function clearPokedexCache(): void {
  cache = null;
  pending = null;
}
