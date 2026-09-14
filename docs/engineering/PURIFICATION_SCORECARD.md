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
| Duplicate architecture | AI transport 5 routes + 1 dead client; keyword search 2 endpoints + 1 dead engine; agent concepts 4; plan vocabularies 3; error-response shapes ~28 route-local helpers | | | | P2-F |
| Fake implementations | 9 FAKE-PRODUCTION findings (fake-behaviour pass) | | | | P2-E |
| Mock persistence | 2 FAKE-PERSISTENCE (`/chat/[id]` localStorage; settings localStorage, disclosed) · 1 DURABILITY-GAP (dead `lib/security/audit.ts`) | | | | P2-A02, P2-E |
| Duplicate types | plan ids 4 copies outside `lib/plans.ts`; `AgentStatus` 4 vocabularies; `services/action-types.ts` 410 lines behind one type-only import | | | | P2-B, P2-F |
| Legacy routes | 11 routes with no UI consumer + 1 retired (`/api/tasks/execute`) · 3 orphan pages | | | | P2-G |
| Unused dependencies | 3 candidates (`openai`, `@eslint/eslintrc`, `clsx`) | 3 declared (23 installed packages) | — | 0 known; `server-only` is used but undeclared (noted, not changed) | P2-D |
| Fake UI | 10 findings (app inventory pass) | | | | P2-E |
| Obsolete docs | to be counted in P2-H | | | | P2-H |
| Security-risk dead code | 5 (`validation.ts`, `audit.ts`, `billing/permissions.ts`, `data/client.ts`, `observability/logger.ts`) | | | | P2-A |
