# AGENTS.md

Two independent apps in one repo:
- **Frontend** (repo root): React 19 + TypeScript + Vite + Tailwind v4 climate dashboard. Package manager is **pnpm** (no package-lock.json).
- **Backend** (`backend/`): separate Go module `earth-backend` (dependencies live in the gitignored local `backend/vendor/`). All backend commands must run from `backend/`.

## Commands

Frontend (from repo root):
```
pnpm dev          # vite dev server with API proxies (see below)
pnpm build        # tsc -b && vite build  (typecheck + bundle)
pnpm lint         # oxlint (.oxlintrc.json)
pnpm test         # vitest run
pnpm vitest run src/data/contributors/merge.test.ts   # single test file
```

Backend (from `backend/`):
```
go vet ./...
go test ./...
go build -o /tmp/eb .
PORT=8090 CACHE_DIR=.cache go run .    # serves :8090/api/v1/*
```
`backend/vendor/` is gitignored — after changing go.mod run `go mod tidy && go mod vendor` locally (first build needs network).

There is no CI; verify with lint/typecheck/test on both sides before finishing.

## Dev-server proxies (don't bypass)

The frontend never calls third-party APIs directly in dev. `vite.config.ts` proxies:
- `/api/*` → backend at `BACKEND_URL` (default `http://localhost:8076`)
- `/proxy/giss|nsidc|inpe|firms|openaq` → NASA GISS, NSIDC, INPE, FIRMS, OpenAQ

New data sources must go through a proxy path here (or through the backend). Without the backend running, `/api` contributors just fail gracefully.

## Frontend data pipeline

Data flows through contributors, not components:
- `src/data/repository.ts` holds the fixed `CONTRIBUTORS` array. Each `Contributor` (in `src/data/contributors/`) fetches from a source module (`src/data/sources/`), returns a partial `Contribution`, merged by `applyContribution`.
- The snapshot starts as a deep-cloned copy of `src/data/fixtures.ts` (baseline/fallback — it is load-bearing, not dead code) and is progressively overwritten as each contributor resolves.
- To add a data provider: write a source in `src/data/sources/`, wrap it in a contributor, append to `CONTRIBUTORS`. Do not wire fetching into React components.
- Domain shapes live in `src/domain/climate.ts`; `src/data/translators/` converts raw provider payloads to domain types. Keep provider quirks out of the domain.
- Client-side caching/dedup: `cached(key, ttlMs, fn)` in `src/data/cache.ts`; failures are retried next call, never cached.
- Optional keys (contributors degrade without them): `VITE_FIRMS_MAP_KEY`, `VITE_OPENAQ_API_KEY` (see `.env.example`).

## Backend architecture rules

Strict dependency injection — this is the codebase convention, enforced everywhere:
- Every layer exposes a `DependenciesConfig` struct and `NewDependencies(cfg)`; `main.go` is the only composition point and contains no logic.
- Layers consume dependencies through small local interfaces (`Upstream`, `DiskCache`, `ClimateService`, `HTTPDoer`), never package-level functions or globals.
- Logging is injected `*zap.Logger` (nil → `zap.NewNop()`); structured fields, no Printf-style.
- Layer map: `external/` (raw upstream HTTP: Open-Meteo, OWID CSV) ← `biz/` (domain indicators: ice-mass parsing, regional rows) ← `api/` (HTTP handlers, `Router()`) with `cache/` (TTL + stale-on-error + disk persistence) shared by biz/api.
- Upstream calls in `external` are paced/capped (default 350ms interval, concurrency 2) because Open-Meteo rate-limits bursts — don't add unthrottled fetch loops.
- Endpoints: `/api/v1/health`, `/api/v1/ice-mass`, `/api/v1/regions`; frontend consumer is `src/data/sources/backendApi.ts`.
