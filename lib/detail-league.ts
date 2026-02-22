export const DETAIL_LEAGUES = ["great", "ultra", "master"] as const;
export type DetailLeague = (typeof DETAIL_LEAGUES)[number];

export const DETAIL_LEAGUE_OPTIONS: Record<
  DetailLeague,
  { label: string; shortLabel: string; pvpCap: number }
> = {
  great: { label: "Great League (1500)", shortLabel: "GL", pvpCap: 1500 },
  ultra: { label: "Ultra League (2500)", shortLabel: "UL", pvpCap: 2500 },
  master: {
    label: "Master League (No Cap)",
    shortLabel: "ML",
    pvpCap: Number.POSITIVE_INFINITY,
  },
};

export function parseDetailLeague(
  rawValue?: string | null,
  fallback: DetailLeague = "great",
): DetailLeague {
  const value = (rawValue ?? "").trim().toLowerCase();
  if ((DETAIL_LEAGUES as readonly string[]).includes(value)) {
    return value as DetailLeague;
  }
  return fallback;
}
