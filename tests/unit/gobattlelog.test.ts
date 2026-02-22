import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSpeciesCandidateKeys,
  findMetaRankByName,
  getMetaLeagueFromSearchParam,
  getMetaRankDataset,
  getMetaTier,
  normalizeMetaSpeciesKey,
  type MetaRankEntry,
} from "@/lib/gobattlelog";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("gobattlelog helpers", () => {
  it("normalizes species keys and builds variant keys", () => {
    expect(normalizeMetaSpeciesKey("Mr. Mime")).toBe("mrmime");

    const keys = buildSpeciesCandidateKeys("Shadow Nidoqueen (Alolan)");
    expect(keys).toContain("shadownidoqueenalolan");
    expect(keys).toContain("nidoqueen");
  });

  it("matches entries by normalized name variants", () => {
    const entries: MetaRankEntry[] = [
      {
        speciesId: "nidoqueen",
        speciesName: "Nidoqueen",
        rating: 95.2,
        rank: 18,
        tier: "A",
      },
    ];

    const matched = findMetaRankByName(entries, "Shadow Nidoqueen");
    expect(matched?.speciesName).toBe("Nidoqueen");
    expect(matched?.rank).toBe(18);
  });

  it("parses league query params safely", () => {
    expect(getMetaLeagueFromSearchParam("great")).toBe("great");
    expect(getMetaLeagueFromSearchParam("ULTRA")).toBe("ultra");
    expect(getMetaLeagueFromSearchParam("unknown")).toBe("great");
    expect(getMetaLeagueFromSearchParam(null)).toBe("great");
  });

  it("assigns tiers by rank and total size", () => {
    expect(getMetaTier(1, 500)).toBe("S");
    expect(getMetaTier(25, 500)).toBe("A");
    expect(getMetaTier(60, 500)).toBe("B");
    expect(getMetaTier(140, 500)).toBe("C");
    expect(getMetaTier(350, 500)).toBe("D");
  });
});

describe("getMetaRankDataset", () => {
  it("fetches, sorts, ranks, and caches by league", async () => {
    const payloadA = [
      { speciesId: "venusaur", speciesName: "Venusaur", rating: 92.1 },
      { speciesId: "lanturn", speciesName: "Lanturn", rating: 95.6 },
      { speciesId: "swampert", speciesName: "Swampert", rating: 94.8 },
    ];
    const payloadB = [
      { speciesId: "venusaur", speciesName: "Venusaur", rating: 97.1 },
      { speciesId: "lanturn", speciesName: "Lanturn", rating: 95.6 },
      { speciesId: "swampert", speciesName: "Swampert", rating: 94.8 },
    ];

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payloadA), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payloadB), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const first = await getMetaRankDataset("great");
    const cached = await getMetaRankDataset("great");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.entries[0]?.speciesName).toBe("Lanturn");
    expect(first.entries[0]?.rank).toBe(1);
    expect(first.entries[1]?.speciesName).toBe("Swampert");
    expect(cached.entries[0]?.speciesName).toBe("Lanturn");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("rankings-1500.json");

    const refreshed = await getMetaRankDataset("great", { forceRefresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshed.entries[0]?.speciesName).toBe("Venusaur");
  });
});
