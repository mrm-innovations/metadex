import { expect, test } from "@playwright/test";

function parseNumber(raw: string | null): number {
  if (!raw) {
    return 0;
  }
  return Number.parseInt(raw.replace(/,/g, "").trim(), 10);
}

test("home and detail pages load with live dataset", async ({ page, request }) => {
  const apiResponse = await request.get("/api/pokedex");
  expect(apiResponse.ok()).toBeTruthy();

  const apiJson = (await apiResponse.json()) as {
    data: Array<{ nat: string; name: string }>;
  };
  expect(Array.isArray(apiJson.data)).toBeTruthy();
  expect(apiJson.data.length).toBeGreaterThan(0);

  const firstPokemon = apiJson.data[0];

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MetaDex" })).toBeVisible();
  await expect(page.getByText("Results:")).toBeVisible();
  await expect(page.getByText("Could not load MetaDex data")).toHaveCount(0);

  const searchInput = page.getByPlaceholder("Search Pokemon by name...");
  await searchInput.fill(firstPokemon.name.slice(0, 3));
  await expect(page.getByText("Results:")).toBeVisible();

  await page.goto(`/pokemon/${encodeURIComponent(firstPokemon.nat)}`);
  await expect(page.getByRole("link", { name: "Back to Pokedex" })).toBeVisible();
  await expect(page.getByText(firstPokemon.name).first()).toBeVisible();
  await expect(page.getByText("PoGO HP")).toBeVisible();
});

test("pvp api endpoint returns league-capped rankings", async ({ request }) => {
  const okResponse = await request.get("/api/pvp?nat=6&league=great&topN=5");
  expect(okResponse.ok()).toBeTruthy();
  const okJson = (await okResponse.json()) as {
    data: Array<{ cp: number }>;
    meta: { count: number; league: { key: string; cap: number | null } };
  };

  expect(okJson.meta.league.key).toBe("great");
  expect(okJson.meta.league.cap).toBe(1500);
  expect(okJson.meta.count).toBeGreaterThan(0);
  expect(okJson.meta.count).toBeLessThanOrEqual(5);
  for (const row of okJson.data) {
    expect(row.cp).toBeLessThanOrEqual(1500);
  }

  const badResponse = await request.get("/api/pvp?nat=6&league=bad");
  expect(badResponse.status()).toBe(400);
});

test("evolution api endpoint returns normalized chain and handles bad input", async ({ request }) => {
  const okResponse = await request.get("/api/evolution?nat=6");
  expect(okResponse.ok()).toBeTruthy();

  const okJson = (await okResponse.json()) as {
    data: {
      nat: number | null;
      displayName: string;
      children: Array<{ displayName: string; nat: number | null }>;
    };
    meta: {
      speciesNat: number;
      chainId: number;
    };
  };

  expect(okJson.meta.speciesNat).toBe(6);
  expect(okJson.meta.chainId).toBeGreaterThan(0);
  expect(okJson.data.displayName).toBe("Charmander");
  expect(okJson.data.nat).toBe(4);
  expect(okJson.data.children[0]?.displayName).toBe("Charmeleon");
  expect(okJson.data.children[0]?.nat).toBe(5);

  const badResponse = await request.get("/api/evolution");
  expect(badResponse.status()).toBe(400);
});

test("classification api endpoint resolves batched nat values", async ({ request }) => {
  const okResponse = await request.get("/api/classification?nats=1,150,151");
  expect(okResponse.ok()).toBeTruthy();

  const okJson = (await okResponse.json()) as {
    data: Record<string, "Legendary" | "Mythical" | null>;
  };

  expect(okJson.data["1"]).toBeNull();
  expect(okJson.data["150"]).toBe("Legendary");
  expect(okJson.data["151"]).toBe("Mythical");

  const badResponse = await request.get("/api/classification");
  expect(badResponse.status()).toBe(400);
});

test("pvp table updates across league selections", async ({ page }) => {
  await page.goto("/pokemon/6");
  await expect(page.getByTestId("pvp-section")).toBeVisible();
  await expect(page.getByTestId("pvp-table")).toBeVisible();

  const greatCp = parseNumber(await page.getByTestId("pvp-r1-cp").textContent());
  expect(greatCp).toBeLessThanOrEqual(1500);

  await page.getByTestId("pvp-league-select").click();
  await page.getByRole("option", { name: "Ultra League (2500)" }).click();
  await expect(page.getByTestId("pvp-table")).toBeVisible();
  const ultraCp = parseNumber(await page.getByTestId("pvp-r1-cp").textContent());
  expect(ultraCp).toBeLessThanOrEqual(2500);
  expect(ultraCp).toBeGreaterThan(greatCp);

  await page.getByTestId("pvp-league-select").click();
  await page.getByRole("option", { name: "Master League (No Cap)" }).click();
  await expect(page.getByTestId("pvp-table")).toBeVisible();
  const masterCp = parseNumber(await page.getByTestId("pvp-r1-cp").textContent());
  const masterLevel = parseNumber(await page.getByTestId("pvp-r1-level").textContent());
  expect(masterCp).toBeGreaterThan(2500);
  expect(masterCp).toBeGreaterThan(ultraCp);
  expect(masterLevel).toBe(50);
});

test("evolution section shows expected chain nodes and links", async ({ page }) => {
  await page.goto("/pokemon/6");

  const evolution = page.getByTestId("evolution-section");
  await expect(evolution).toBeVisible();
  await expect(evolution.getByRole("link", { name: /Charmander/i }).first()).toBeVisible();
  await expect(evolution.getByRole("link", { name: /Charmeleon/i }).first()).toBeVisible();
  await expect(evolution.getByRole("link", { name: /Charizard/i }).first()).toBeVisible();

  const charmanderLinks = evolution.getByRole("link", { name: /Charmander/i });
  await expect(charmanderLinks.first()).toBeVisible();
  await expect(charmanderLinks.first()).toHaveAttribute("href", "/pokemon/4");
});
