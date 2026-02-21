import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const PORT = 3010;
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;
const FIXTURE_CSV = readFileSync(path.join(__dirname, "tests/fixtures/pokedex.csv"), "utf8");
const FIXTURE_BASE64 = Buffer.from(FIXTURE_CSV, "utf8").toString("base64");
const EVOLUTION_FIXTURE_JSON = readFileSync(
  path.join(__dirname, "tests/fixtures/evolution-overrides.json"),
  "utf8",
);
const EVOLUTION_FIXTURE_BASE64 = Buffer.from(EVOLUTION_FIXTURE_JSON, "utf8").toString("base64");
const SPECIES_FIXTURE_JSON = readFileSync(path.join(__dirname, "tests/fixtures/species-overrides.json"), "utf8");
const SPECIES_FIXTURE_BASE64 = Buffer.from(SPECIES_FIXTURE_JSON, "utf8").toString("base64");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --webpack --hostname ${HOST} --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      POKEDEX_CSV_BASE64: FIXTURE_BASE64,
      POKEAPI_EVOLUTION_OVERRIDES_BASE64: EVOLUTION_FIXTURE_BASE64,
      POKEAPI_SPECIES_OVERRIDES_BASE64: SPECIES_FIXTURE_BASE64,
    },
  },
});
