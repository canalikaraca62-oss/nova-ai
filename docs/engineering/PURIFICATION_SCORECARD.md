# SYRAVEN — Purification Scorecard (Phase 2)

Every number is a measurement, with the command or pass that produced it.
Baseline: commit `3314baa`.

## Baseline measurements (`git ls-files`, `.ts`/`.tsx`, line counts)

| Area | Files | Lines |
|---|---|---|
| `lib/` | 54 | 20,013 |
| `types/` | 14 | 10,187 |
| `services/` | 2 | 834 |
| `app/components/` | 31 | 15,160 |
| `app/api/` | 35 | 18,475 |
| `app/` (all) | 138 | 64,017 |
| `tests/` | 71 | 25,203 |

Pages 47 · API routes 35 · dependencies 11 · devDependencies 15 ·
`console.*` calls in `app/ lib/ services/ middleware.ts`: 202.

## Scorecard

"Before" = found by the reconnaissance passes (PURIFICATION_EVIDENCE.md).
The other columns are filled as batches land; blank means not yet done.

| Category | Before | Removed | Consolidated | Remaining | Evidence |
|---|---|---|---|---|---|
| Dead code — `lib/` | 14 files / 8,258 lines (2 kept: logger, queue) | 12 files / 7,525 lines | — | 2 kept by decision (`observability/logger.ts` designated logger; `autopilot/queue.ts` blocked substrate) | P2-A |
| Dead code — `types/` | 12 files / 9,474 lines | 12 files / 9,474 lines | — | 0 | P2-B |
| Dead code — components | 23 files / 13,903 lines | 23 files / 13,903 lines | — | 0 | P2-C |
| Duplicate architecture | AI transport 5 routes + 1 dead client; keyword search 2 endpoints + 1 dead engine; agent concepts 4; plan vocabularies 3; error-response shapes ~28 route-local helpers | 2 route-local anon Supabase clients (portal, checkout); 1 dead interval list (checkout) | `/api/usage` onto `entitlements` + `meter` (own plan type, limit table and counting removed; 1,180-line diff); `/billing/success` onto `lib/plans`; portal onto `profiles` via `session.supabase`; retrievable-status rule 3 copies → 1 (`hierarchy.ts`, value unchanged by founder decision); `/api/chat` provider pairing and fallback onto the registry + `failoverCandidates` (P2-F08: `body.provider`, 2 env default models, `getProvider`, `getFallbackProvider` removed); voice transcribe and speak provider failures onto `normalizeHttpError` (P2-F09: provider text, `providerType` and raw status no longer reach the client; `getOpenAIErrorMessage` removed); voice transcribe and speak model, key and endpoint onto the registry — private model list, env default model, direct key reads and hardcoded URLs removed (P2-G07) | AI transport: `/api/chat` keeps its own fetch/SSE (KNOWN LIMITATION); `/api/agents` env model (G-B7); `/api/stream` and `/api/files/analyze` retired (P2-G01, P2-G05); error-response helpers | P2-F01–F09, P2-G07 |
| Fake implementations | 9 FAKE-PRODUCTION findings (fake-behaviour pass) | 2 fabricated API responses corrected (`/api/files/upload` id, `/api/canvas` GET status and empty-canvas success) | — | Re-counted by the final fake re-scan; the `/api/usage`, billing and `/api/stream` findings belong to P2-F | P2-E06, P2-E07 |
| Mock persistence | 2 FAKE-PERSISTENCE (`/chat/[id]` localStorage; settings localStorage, disclosed) · 1 DURABILITY-GAP (dead `lib/security/audit.ts`) | | | | P2-A02, P2-E |
| Duplicate types | plan ids 4 copies outside `lib/plans.ts`; `AgentStatus` 4 vocabularies; `services/action-types.ts` 410 lines behind one type-only import | `services/action-types.ts` (411 lines) | plan ids: `/api/usage` and `/billing/success` copies onto `lib/plans` (2 of 4) | plan ids 2 copies (checkout `BillingPlan` is a deliberate sellable subset; re-counted at final scan); `AgentStatus` vocabularies not yet addressed | P2-F04–F06 |
| Legacy routes | 11 routes with no UI consumer + 1 retired (`/api/tasks/execute`) · 3 orphan pages. P2-G inventory (2026-09-15): 7 no-consumer candidates + 1 consolidation (G01–G08) | `/api/stream` retired to a `withAuth` 410 (1,065 → 50 lines; G-B1); `/api/agents/execute` (404 → 39 non-blank lines) and `/api/action` (293 → 39) retired to `withAuth` 410s, `/api/action`'s public GET exception removed from `middleware.ts` (G-B2); `/api/knowledge/search` (1,008 → 44 non-blank lines) retired to a `withAuth` 410 on GET and POST (G-B3); `/api/files/upload` (482 → 35 non-blank lines) retired to a `withAuth` 410, its `ELEVATED_ALLOWLIST` entry and unused `"files:upload"` rate rule removed (G-B4); `/api/files/analyze` (939 → 38 non-blank lines) retired to a `withAuth` 410, its public status-GET exception removed from `middleware.ts` (G-B5) | shared retired-route guard covers `/api/tasks/execute`, `/api/stream`, `/api/agents/execute`, `/api/action`, `/api/knowledge/search`, `/api/files/upload`, `/api/files/analyze`; action risk pinned to `lib/orchestration` only; keyword search has one route (`/api/search`); service-role routes 4 → 3; `ECHO_ONLY` tenant exceptions 1 → 0; public status GETs 5 → 3; voice routes kept and consolidated onto the registry (G-B6, P2-G07) | G08 `/api/agents` model; 3 orphan pages; `api-auth-boundary` per-method sweep blind to unwrapped `export const METHOD = (async …)` handlers (found in G-B3, not fixed) | P2-G01–G07 |
| Unused dependencies | 3 candidates (`openai`, `@eslint/eslintrc`, `clsx`) | 3 declared (23 installed packages) | — | 0 known; `server-only` is used but undeclared (noted, not changed) | P2-D |
| Fake UI | 10 findings (app inventory pass) | 1 page deleted (`/projects/search`, 584 lines); 4 pages stripped of sample data (`/knowledge/[id]`, `/agents/[id]`, `/projects/[id]`, `/projects/new`); 3 copy surfaces corrected (`/apps`, `/marketplace/[id]`, command palette) | `/knowledge/[id]` now reads `GET /api/knowledge?id=` | Re-counted by the final fake re-scan | P2-E01–E05, P2-E08 |
| Obsolete docs | to be counted in P2-H | | | | P2-H |
| Security-risk dead code | 5 (`validation.ts`, `audit.ts`, `billing/permissions.ts`, `data/client.ts`, `observability/logger.ts`) | | | | P2-A |
