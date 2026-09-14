# SYRAVEN — Purification Evidence (Phase 2)

Every deletion or consolidation in Phase 2 has a record here **before** it
is made. No record, no change. Baseline: commit `3314baa` (Phase 1 PASS
tree, committed 2026-09-14 as `9837f30`, `a4e052d`, `3314baa`).

## Method

Reconnaissance (2026-09-14) by five read-only passes over `app/`, `lib/`,
`services/`, `types/`, `tests/`, `supabase/`, config and docs (never
`node_modules` / `.next`):

1. **Imports** — every `import` / `export … from` / `import()` /
   `next/dynamic` / `require(` parsed (multi-line included), value vs
   type-only; transitive reachability from entrypoints (`app/**/page.tsx`,
   `layout.tsx`, `route.ts`, `middleware.ts`, `next.config.ts`). No barrel
   (`index.*`) files exist; the only re-export is `lib/supabase.ts:28`.
2. **Next.js discovery** — no route groups, parallel/intercepting routes,
   `loading`/`error`/`not-found`/`template` files, server actions or
   generated routes; `middleware.ts` gates `/api/*` only.
3. **Runtime strings** — file paths, route paths, module names, registry
   keys, tool / agent ids searched across code, tests, docs.
4. **Configuration** — `package.json` scripts, CI, husky, `next.config.ts`,
   `tsconfig.json`, ESLint, PostCSS, Playwright.
5. **Database** — migrations, SQL functions, triggers, policies, RPC names.
6. **Tests** — imports vs source-as-text reads (`readFileSync`), fixtures.
7. **Git history** — `git log` per suspect; `git log --diff-filter=D`
   found **no** file ever deleted and restored.
8. **Documentation** — README, `*.md`, ADRs, state docs, specs.

A file is **DEAD** only when no reachable file imports it on any layer.
**DEAD-CHAIN**: imported only by dead files.

---

## Records

Format: ID · FILE · CLASSIFICATION · WHY SUSPECTED · STATIC · DYNAMIC ·
ROUTE/ENTRY · RUNTIME · TESTS · CONFIG · ENV · MIGRATIONS · SCRIPTS · GIT ·
SECURITY · DATA · USER · DEPENDENCY · CANONICAL OWNER · DECISION ·
VERIFICATION · RESULT.

### P2-A — dead library modules

Shared evidence for every file in this group unless a row says otherwise:
DYNAMIC none (`import(`/`require(` searched); ROUTE/ENTRY none (not a Next
file convention); RUNTIME unreachable; CONFIG none; ENV none read by any
reachable code through them; MIGRATIONS none; SCRIPTS none; GIT introduced
`ad408d7`/`ccea043` (2026-08-27/30), never deleted/restored; DATA none;
USER none (never loaded).

| ID | File (lines) | Class | Static importers | Tests | Security review | Canonical owner | Decision |
|---|---|---|---|---|---|---|---|
| P2-A01 | `lib/security/validation.ts` (1480) | DEAD | none | none | Name is security-sensitive; **removes no live control** — route validation lives in each handler and `lib/search/types.ts` (`validateSearchRequest`); nothing calls this module | per-route validation | DELETE |
| P2-A02 | `lib/security/audit.ts` (945) | DEAD · DURABILITY-GAP | none | none | In-memory audit store (`events: AuditEvent[]`, cap 10000, `:272/:900`) — a trap if ever wired: non-durable, per-instance. Removes no live control; the real audit write is `audit_logs` via `/api/auth/register` | `audit_logs` (target: audit writer, North Star §10) | DELETE |
| P2-A03 | `lib/ai/prompts.ts` (881) | DEAD | none | none | Holds a `text.length / 4` token estimator — live metering uses provider counts | route prompts / `lib/ai/provider.ts` | DELETE |
| P2-A04 | `lib/ai/groq.ts` (591) | DEAD | none | none | Second AI transport; keeps provider bodies in `GroqError.details`; model from `GROQ_MODEL` env with no registry check — removing it removes a policy bypass, not a control | `lib/ai/provider.ts` + registry | DELETE |
| P2-A05 | `lib/ai/context.ts` (574) | DEAD-CHAIN | `lib/ai/groq.ts` only | none | none | — | DELETE |
| P2-A06 | `lib/agents/types.ts` (232) | DEAD-CHAIN | type-only from `lib/ai/context.ts` | comment only (`agent-orchestration.test.ts`) | none; a 4th `AgentStatus` vocabulary | `lib/orchestration/registry.ts` | DELETE |
| P2-A07 | `lib/knowledge/search.ts` (673) | DEAD | none | none | Pluggable engine with no DB access; header names a path that does not exist | `lib/search/query.ts`, `lib/search/semantic.ts` | DELETE |
| P2-A08 | `lib/knowledge/types.ts` (548) | DEAD-CHAIN | `lib/knowledge/search.ts` only | none | none | `lib/search/types.ts` | DELETE |
| P2-A09 | `lib/billing/permissions.ts` (514) | DEAD | none | none | Billing-named; **no entitlement decision passes through it** — the enforced path is `lib/usage/entitlements.ts` + `lib/api/usageGuard.ts` (invariant I-12 tests) | `lib/usage/entitlements.ts`, `lib/plans.ts` | DELETE |
| P2-A10 | `lib/billing/config.ts` (476) | DEAD-CHAIN | `lib/billing/permissions.ts` only | message string only (`model-routing.test.ts`) | A second plan vocabulary (`BillingPlanId`) | `lib/plans.ts` | DELETE |
| P2-A11 | `lib/constants.ts` (486) | DEAD | none | none | `SECURITY.rateLimit`/`authRateLimit` config nobody enforces (real limits: `RATE_LIMITS` in `lib/usage/meter.ts`); `ROUTES` lists routes that do not exist (`/api/health`, `/api/ai`) | `lib/usage/meter.ts`, `lib/plans.ts` | DELETE |
| P2-A12 | `lib/data/client.ts` (125) | DEAD (test reads text) | none | `data-access.test.ts:338-360` checks its text (`server-only`, justification comment) | Elevated-access wrapper nothing uses; the enforced boundary is the service-role allowlist in the same suite (unchanged) | `session.supabase` / `lib/supabaseAdmin.ts` allowlist | DELETE with its text-check block (tests a deleted file; no live guard weakened) |
| P2-A13 | `lib/observability/logger.ts` (408) | DEAD (test-guarded) | none | `observability-redaction.test.ts:592-620` pins its redaction | Designated canonical logger (North Star §10: "one logger, redaction built in"); deleting drops the only redaction implementation | itself | **KEEP** — adoption is later-phase observability work; recorded, not hidden |
| P2-A14 | `lib/autopilot/queue.ts` (325) | BLOCKED (not dead) | none | `autopilot-queue.test.ts`, `architecture-invariants.test.ts` (I-8, I-14) | Service-role queue; the one durable-execution substrate (ADR-001 §3) | itself | **KEEP** — I-14 BLOCKED on a scheduler |

**VERIFICATION (P2-A + P2-B together):** `tsc --noEmit` exit 0;
`npm run test:lowmem` 1814 tests: 1807 pass, 0 fail, 7 todo (3 fewer than
baseline 1817 — exactly the deleted `lib/data/client.ts` text checks);
ESLint exit 0 on `tests/security/data-access.test.ts`. No remaining test
reads a deleted file. **RESULT:** 12 `lib/` files (7,525 lines) and 12
`types/` files (9,474 lines) deleted; `logger.ts` and `queue.ts` kept.

Note: North Star §2 records that several of these were once kept "by
founder decision". Phase 2's explicit founder instruction — no dead
application code, every deletion evidenced — supersedes that for the
files marked DELETE.

### P2-B — dead type files

`types/{agent,api,billing,chat,file,knowledge,notification,project,task,usage,user,workspace}.ts`
(808+1240+714+904+986+922+492+615+508+468+660+1157 = **9,474** lines).
STATIC no importer anywhere (value or type); DYNAMIC none; TESTS none;
DOCS none; GIT added `ad408d7`, last touched `b3a04a8` (2026-08-30); none
imports anything. SECURITY none (type declarations only; `types/billing.ts`
holds a third plan vocabulary). CANONICAL `types/database.ts` (generated,
kept) and the per-module types in `lib/`. **KEEP** `types/database.ts`,
`types/billing-webhook-events.ts` (both imported). DECISION **DELETE**
the twelve.

### P2-C — dead components

No importer (static, relative, `@/app/…`, `import()`, `next/dynamic`) in
`app/`, `lib/`, `services/`; no dead component imports another.

| ID | File (lines) | Test coupling | Decision |
|---|---|---|---|
| P2-C01 | `layout/TopBar.tsx` (617) — duplicates the AppShell header | exempt in `dialogs-are-dialogs.test.ts:137` | DELETE; remove exemption |
| P2-C02 | `activity/ActivityFeed.tsx` (1071) — duplicates `app/activity/page.tsx` | comment in `one-product-language.test.ts:128` | DELETE; update comment |
| P2-C03 | `billing/PlanCard.tsx` (363) — `premium` plan vocabulary | read as text, `ui-integrity.test.ts:315` | DELETE; remove list entry |
| P2-C04 | `billing/UpgradeModal.tsx` (867) — `premium` plan vocabulary | exempt `dialogs-are-dialogs.test.ts:135` | DELETE; remove exemption |
| P2-C05 | `chat/ShareChatDialog.tsx` (1193) | exempt `dialogs-are-dialogs.test.ts:136` | DELETE; remove exemption |
| P2-C06 | `workspace/CreateWorkspace.tsx` (944) — duplicates the dashboard form | none | DELETE |
| P2-C07 | `Message.tsx` (293) | none | DELETE |
| P2-C08 | `ui/` Avatar 477, Badge 774, Button 505, Card 498, Dialog 749, EmptyState 486, IconButton 390, Input 570, Modal 885, PremiumBadge 423, SearchInput 399, Select 571, Skeleton 584, StatusDot 221, Tabs 607, Tooltip 416 | Dialog, Modal exempt in `dialogs-are-dialogs.test.ts:132-133` | DELETE; remove exemptions |

KEEP (reachable): `ui/AiActivity.tsx`, `ui/CapabilityUnavailable.tsx`,
`ui/useDialogBehaviour.ts`, `layout/{AppChrome,AppShell,DesktopSidebar,MobileNav}.tsx`,
`command/CommandPalette.tsx`, `context/WorkspaceContext.tsx`,
`app/graph/GraphScene.tsx` (dynamic import). DEPENDENCY: `react-dom`'s only
direct importer is `ui/Modal.tsx`, but `react-dom` stays — required peer of
`next`. USER none (never rendered).

**VERIFICATION (P2-C):** first combined run was killed by the OS for low
memory after the suite passed; recovered per `RESOURCE_POLICY.md` (no
orphan processes; tree unchanged; each step re-run alone). `tsc --noEmit`
exit 0; `npm run test:lowmem` 1801 tests: 1794 pass, 0 fail, 7 todo;
ESLint exit 0 on the three edited tests. **Test-count delta accounted:**
HEAD (`232c62a`, extracted with `git archive`) vs working tree over the
11 suites that generate tests per file: 435 → 422, 0 added, 0 failing.
The 13 removed are exactly the generated tests for deleted files — 3
dialog tests each for `UpgradeModal`, `ShareChatDialog`, `Dialog`, `Modal`
(12) and the `PlanCard` billing-surface test (1). **RESULT:** 23 files
(13,903 lines) deleted; exemptions and list entries for them removed.

### P2-D — unused dependencies

Searched for each name in `app/`, `lib/`, `services/`, `types/`,
`tests/`, `middleware.ts`, `next.config.ts`, `playwright.config.ts`,
`eslint.config.mjs`, `postcss.config.mjs`, `app/**/*.css`, `package.json`
scripts, `.github/`, `.husky/` (value, type-only, dynamic, `require`,
CSS `@import`/`@plugin`, CLI use).

| ID | Package | Import evidence | Script / config / CLI | Transitive (package-lock.json) | Risk | Decision |
|---|---|---|---|---|---|---|
| P2-D01 | `openai` ^4.80.0 (dependency) | none — the last importer, `app/api/canvas/route.ts:3`, was removed when that route moved to the provider adapter (Phase 1 step 7, commit `a4e052d`) | none; the remaining OpenAI calls use HTTP `fetch` through `lib/ai/provider.ts` / route transports | required only by the root manifest | none: no code path loads it | DELETE |
| P2-D02 | `clsx` ^2.1.1 (dependency) | none | none | required only by the root manifest | none | DELETE |
| P2-D03 | `@eslint/eslintrc` ^3.2.0 (devDependency) | none — `eslint.config.mjs` uses `eslint/config` and `eslint-config-next`; no `FlatCompat` | none | **also a dependency of `eslint` itself** (lockfile `:3791`), so it stays installed for ESLint | none for lint: ESLint keeps its own copy | DELETE (root declaration only) |

KEEP with evidence: `react-dom` (required peer of `next`), `@types/react-dom`
(companion types for that peer), `postcss` (PostCSS config for Tailwind
v4), `husky` (`prepare` script; hooks path `.husky/_`, no hooks today),
`rimraf` (`clean` script), `supabase` (CLI used by hand per `DATABASE.md`),
`@playwright/test`, `typescript`, `eslint`, `eslint-config-next`,
`tailwindcss`, `@tailwindcss/postcss`, `@types/*`, `stripe`, `zod`,
`three`, `lucide-react`, `@supabase/*`, `next`, `react`.

Undeclared import noted, not changed: `server-only` is imported by 36
`lib/` files and is not in `package.json`; Next resolves it at build time
(the Phase 1 production build passed). Declaring it is a separate change.

**VERIFICATION (P2-D):** `npm uninstall --no-audit --no-fund openai clsx
@eslint/eslintrc` exit 0, "removed 23 packages". The 23 are the three
plus what only `openai` required — `node-fetch`, `form-data`,
`formdata-node`, `agentkeepalive`, `abort-controller`, `web-streams-polyfill`,
`@types/node-fetch` and their dependencies, and a **nested**
`openai/node_modules/@types/node` + `undici-types` (full lockfile paths
checked). Root `@types/node` 22.20.1 and `undici-types` 6.21.0 remain
installed and declared. No application import of any removed package
(searched `app lib services types tests`, root configs).
`node_modules/@eslint/eslintrc` still present through `eslint`. npm
printed an `allow-scripts` notice for `unrs-resolver` (pre-existing
install scripts; unrelated). `tsc --noEmit` exit 0 (after waiting for
memory); `npm run test:lowmem` 1801: 1794 pass, 0 fail, 7 todo
(unchanged from P2-C); ESLint exit 0 on `eslint.config.mjs` and
`app/api/canvas/route.ts`. Production build: at the final gate.
**RESULT:** three packages removed from `package.json`; lockfile −263
lines.

### P2-E — fabricated UI and fabricated responses

Found by the fake-behaviour and app-inventory passes; each confirmed by
reading the file. Reachability is the inbound-link evidence from the app
inventory. Tests that name each page were read before editing; a test
assertion is changed only where the fabrication it tolerated is removed,
and then to a stronger assertion.

| ID | Surface | Fabrication (file:line at `1c9ea80`) | Reachable | Tests that pin it | Canonical source | Decision |
|---|---|---|---|---|---|---|
| P2-E01 | `/knowledge/[id]` | Renders only 4 hardcoded records (`page.tsx:40-105`) plus an "Intelligence: Active" card; every real link (`/knowledge`, `/search`, activity) lands on "Knowledge not found" | Yes (3 inbound surfaces, real UUIDs) | `one-main-landmark` (no second `<main>` in the early return) | `public.knowledge` via `GET /api/knowledge` | CONSOLIDATE: page loads the real record; `GET /api/knowledge` gains an additive `id` filter under the existing `user_id` scope, UUID-validated |
| P2-E02 | `/agents/[id]` | `getFallbackAgent` (`:200-247`) gives every user-created agent `verified: true`, `status: "ready"`, invented capabilities, tasks, connections and permissions; running it is then refused (`:338-348`) | Yes (`/agents` links real row ids) | `one-product-language` | Registry agents for execution; catalogue rows cannot run | FIX: an unknown id renders as a catalogue agent that cannot run — no badge, no invented lists (empty sections hidden) |
| P2-E03 | `/projects/[id]` | Sample `projects` map (`:40-86`) and `fallbackProject` (`:88-102`) shown on 401 / miss (`:274-279`); invented activity feed always rendered (`:104-133`, `:553`); "Momentum Strong / Risk Low / AI confidence 94%" (`:507-523`); progress 0 %, members 1, tasks 0/0 shown as data for real projects; "AI project assistant" promising analysis that does not exist | Yes | `projects-ui-persistence` (fetch by id, `loadError`, status labels, `loaded ??`); `defect-remediation` D6 (no dead sub-links; `href="/tasks"`) | `public.projects` via `GET /api/projects?id=` | FIX: real fields only; honest not-found / signed-out states; fabricated sections removed. `loaded ??` assertion replaced by "no sample record exists" (stronger) |
| P2-E04 | `/projects/search` | 8 invented projects with members, progress, "12 minutes ago" (`:36-133`) | **Orphan** — no reference in `app/`, `lib/`, `tests/`, `public/`, `sitemap.ts` | none | `/search` (`GET /api/search`) | DELETE |
| P2-E05 | `/projects/new` | Invented workspace list (`:28-34`) and "Initial team size" input; neither is sent in the POST body (`:80-85`); summary shows the invented workspace; "Your project workspace is created." | Yes | `projects-ui-persistence` (POST to `/api/projects`, no ownership fields, `submitError`/`role="alert"`, `"draft"`) | `POST /api/projects` | FIX: remove the two inputs and the summary row; correct the copy |
| P2-E06 | `POST /api/files/upload` | `id: crypto.randomUUID()` (`:499`) — an id no row carries; the route writes only to storage | No UI caller (external clients cannot be ruled out) | `middleware-gate`, `data-access` | The storage object path | FIX: `id` is the storage path — the only identifier that exists. Response shape unchanged |
| P2-E07 | `/api/canvas` | GET answers `status: "operational"` unconditionally (`:449-470`, public); POST answers `success: true` with an empty "Untitled Canvas" when the model's reply does not parse (`normalizeCanvas`) | Route yes, no UI caller | `usage-enforcement`, `api-auth-boundary`, `middleware-gate`, invariants I-3/I-15 | `lib/ai/registry.ts` `providerApiKey` | FIX: GET reports configuration from the registry; an unparseable reply is a 502, still metered |
| P2-E08 | Copy: `/apps`, `/marketplace/[id]`, command palette | `/apps`: Developer Lab "Ready" (→ `/studio`, the same hub as the Studio card; no code-analysis capability exists) and Voice Intelligence "Beta" (→ `/chat`, text only); Business Intelligence "operational intelligence across your organization" (→ `/billing`, which shows plan and payments); `{apps.length}+` (the list is complete). `/marketplace/[id]:573` "Install and start using it instantly." beside a disabled install button. Command palette "Dashboard" → `/apps` (`/dashboard` exists) and "Voice chat" → `/chat` | Yes (sidebar, palette on every page) | `architecture-invariants` (studio hub), `fabricated-results` (`/marketplace/[id]`), `no-dead-controls` | The destination pages themselves | FIX: the two cards become "Coming soon" (rendered as `role="note"`, not a link); copy says what the page does; exact count; palette points at `/dashboard`; voice entry removed |

**VERIFICATION (P2-E01…E08).**

- `tsc --noEmit`: first run exit 2, one error only —
  `.next/types/validator.ts` (generated, gitignored) still referenced
  the deleted `app/projects/search/page.js`. `next typegen` regenerated
  the route types (exit 0, stale reference gone); tsc then exit 0.
- `npm run test:lowmem`: tests 1800 · pass 1793 · fail 0 · todo 7
  (previous batch 1801 / 1794). Delta −1, accounted: `one-main-landmark`
  generates one test per `page.tsx` under an AppChrome section;
  `app/projects/layout.tsx` mounts AppChrome and its pages went 4 → 3.
  `projects-ui-persistence` holds 14 tests at HEAD and after (one
  assertion replaced, not removed).
- ESLint on every touched file: one error, `no-duplicate-imports` in
  `app/projects/new/page.tsx` — present at HEAD, fixed since the file was
  touched; re-lint exit 0. One warning remains in
  `app/agents/create/page.tsx` (`jsx-a11y/alt-text`), a file this batch
  does not touch.
- Mutation: re-adding `const fallbackProject = null;` to
  `app/projects/[id]/page.tsx` fails `projects-ui-persistence` (14 / 13
  pass / 1 fail, "CRITICAL: a sample project can stand in for the real
  one again."); restored file hash identical; clean run 14 / 14.
- Adversarial: the knowledge `id` filter is added after, never instead
  of, `user_id` — another account's UUID returns an empty list, which the
  page renders as not found. A non-UUID id is refused with 404 before
  the query. A stored `source_url` is linked only when http(s), so a
  `javascript:` URL in a record cannot become a script link.

**RESULT.** 12 files changed, 495 insertions, 1,575 deletions
(`app/projects/search/page.tsx`, 584 lines, deleted).

### Later groups

Recorded as each batch is prepared: duplicate authorities (P2-F), routes
(P2-G), documentation (P2-H).
