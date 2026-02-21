# MetaDex

Pokemon GO Pokedex built with Next.js App Router, TypeScript, Tailwind, and shadcn/ui.
No database is used in v1. Google Sheets is the source of truth.

## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui

## Data Source

- Google Sheet: `https://docs.google.com/spreadsheets/d/1QDk6pGO6hbh3GrdeJp_0bx-xVMiG0zYAfpWZUV7ZaME/edit?gid=746396920#gid=746396920`
- CSV export URL pattern (preferred): `/export?format=csv&gid={GID}`
- Fallback URL pattern: `/gviz/tq?tqx=out:csv&gid={GID}`

## Caching

- In-memory server cache with 15-minute TTL in `lib/sheets.ts`
- Next.js fetch caching with `revalidate: 900` as serverless-safe fallback
- PvP IV ranking cache per `pokemon + league` in `lib/pvp.ts`

## PvP IV Ranking Rules

- IV search space: `0..15` for Atk/Def/HP (`16^3 = 4096` combinations)
- Levels: `1.0` to `50.0` (half-level increments)
- League handling:
  - Great: `1500`
  - Ultra: `2500`
  - Master: no cap (`Infinity`)
- CP formula:
  - `CP = floor(((Atk+atkIV) * sqrt(Def+defIV) * sqrt(HP+hpIV) * CPM^2) / 10)`
- Effective stats at chosen level:
  - `finalAtk = (Atk + atkIV) * CPM`
  - `finalDef = (Def + defIV) * CPM`
  - `finalHP = floor((HP + hpIV) * CPM)`
- Ranking metric: `statProduct = finalAtk * finalDef * finalHP`
- Tie-breaker order (deterministic):
  - higher `statProduct`
  - higher `CP`
  - higher `finalHP`
  - lower `atkIV`
  - higher `defIV`
  - higher `hpIV`
  - higher `level`

## Routes

- `/` - Pokedex browser (search, type filters, sort, pagination)
- `/pokemon/[nat]` - Pokemon detail page
- `/api/pokedex` - Normalized JSON API response
- `/api/pvp` - PvP IV rankings (`nat`, optional `league`, optional `topN`)
- `/api/evolution` - Evolution chain from PokeAPI (`nat`)
- `/api/classification` - Batched Legendary/Mythical classification (`nats`)

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Optional Environment Variable

Copy `.env.example` to `.env.local` and override if needed:

```bash
POKEDEX_SHEET_URL=https://docs.google.com/spreadsheets/d/.../edit?gid=...
```

For deterministic test runs (CI/local), you can also provide:

```bash
POKEDEX_CSV_BASE64=...
POKEAPI_EVOLUTION_OVERRIDES_BASE64=...
POKEAPI_SPECIES_OVERRIDES_BASE64=...
```

## Validation

```bash
npm run lint
npm run build
```

## Tests

```bash
npm run test:unit
```

```bash
npm run test:e2e
```

Example PvP API call:

```bash
/api/pvp?nat=6&league=great&topN=10
```

Example evolution API call:

```bash
/api/evolution?nat=6
```

Example classification API call:

```bash
/api/classification?nats=1,150,151
```

## CI

GitHub Actions workflow is defined at `.github/workflows/ci.yml` and runs:
- lint
- unit tests
- production build
- Playwright smoke e2e
