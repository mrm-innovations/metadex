import { afterEach, describe, expect, it, vi } from "vitest";

import { clearPokeApiCache, getEvolutionChainForNat, getPokemonClassificationForNat } from "@/lib/pokeapi";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  clearPokeApiCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getEvolutionChainForNat", () => {
  it("returns override data without calling fetch", async () => {
    process.env.POKEAPI_EVOLUTION_OVERRIDES_JSON = JSON.stringify({
      "6": {
        chainId: 2,
        root: {
          nat: 4,
          name: "charmander",
          displayName: "Charmander",
          spriteUrl:
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png",
          children: [],
        },
      },
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const chain = await getEvolutionChainForNat("6");
    expect(chain.speciesNat).toBe(6);
    expect(chain.chainId).toBe(2);
    expect(chain.root.displayName).toBe("Charmander");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes fetched chain and caches repeated calls", async () => {
    const speciesResponse = {
      id: 133,
      name: "eevee",
      is_legendary: false,
      is_mythical: false,
      evolution_chain: {
        url: "https://pokeapi.co/api/v2/evolution-chain/67/",
      },
    };
    const chainResponse = {
      id: 67,
      chain: {
        species: {
          name: "eevee",
          url: "https://pokeapi.co/api/v2/pokemon-species/133/",
        },
        evolves_to: [
          {
            species: {
              name: "vaporeon",
              url: "https://pokeapi.co/api/v2/pokemon-species/134/",
            },
            evolves_to: [],
          },
          {
            species: {
              name: "mr-mime",
              url: "https://pokeapi.co/api/v2/pokemon-species/122/",
            },
            evolves_to: [],
          },
        ],
      },
    };

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/pokemon-species/133")) {
        return new Response(JSON.stringify(speciesResponse), { status: 200 });
      }
      if (url.includes("/evolution-chain/67")) {
        return new Response(JSON.stringify(chainResponse), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await getEvolutionChainForNat("133");
    const second = await getEvolutionChainForNat("133");

    expect(first).toEqual(second);
    expect(first.root.displayName).toBe("Eevee");
    expect(first.root.children[1].displayName).toBe("Mr Mime");
    expect(first.root.children[1].nat).toBe(122);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on invalid nat", async () => {
    await expect(getEvolutionChainForNat("not-a-number")).rejects.toThrow(
      "Invalid nat value",
    );
  });
});

describe("getPokemonClassificationForNat", () => {
  it("uses species overrides without fetch", async () => {
    process.env.POKEAPI_SPECIES_OVERRIDES_JSON = JSON.stringify({
      "150": { isLegendary: true, isMythical: false, name: "mewtwo" },
      "151": { isLegendary: false, isMythical: true, name: "mew" },
      "1": { isLegendary: false, isMythical: false, name: "bulbasaur" },
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPokemonClassificationForNat("150")).resolves.toBe("Legendary");
    await expect(getPokemonClassificationForNat("151")).resolves.toBe("Mythical");
    await expect(getPokemonClassificationForNat("1")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads classification from fetched species", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          id: 150,
          name: "mewtwo",
          is_legendary: true,
          is_mythical: false,
          evolution_chain: {
            url: "https://pokeapi.co/api/v2/evolution-chain/75/",
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPokemonClassificationForNat("150")).resolves.toBe("Legendary");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
