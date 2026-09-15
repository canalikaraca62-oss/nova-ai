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

### P2-F — duplicate authorities

Each row is a second implementation of something with a canonical owner,
where the copy has drifted into wrong behaviour. Found by the
duplicate-architecture pass; each confirmed by reading both sides.

| ID | Surface | Duplicate and its drift (file:line at `3f62f71`) | Reachable | Tests that pin it | Canonical owner | Decision |
|---|---|---|---|---|---|---|
| P2-F01 | `/chat` error display | `ChatApiResponse.error?: string` (`app/chat/page.tsx:32`), thrown as `new Error(data.error)` (`:339`). `withAuth`, `usageGuard`, `aiPolicy` and `tenantGuard` all answer `error: { code, message }` (`lib/api/*.ts`), so every auth, quota and policy denial reads "[object Object]" | Yes (primary chat page) | none on this code | The `lib/api` error envelope | FIX: read `error.message` when the error is an object |
| P2-F02 | `POST /api/billing/portal` | Builds its own anon client (`:9-23`) and reads table `subscriptions` (`:100-109`). No such table exists in `types/database.ts` or any migration; the webhook writes `profiles.stripe_customer_id` (`webhook/route.ts:329-454`). Every call ends in 500 `SUBSCRIPTION_LOOKUP_FAILED`. Stripe's own error message is forwarded to the client (`:170`) | Yes (`/billing` "Manage subscription") | `middleware-gate` (path only) | `public.profiles` through `session.supabase` (owner-scoped RLS, as `/api/billing` reads it) | CONSOLIDATE: read the customer id from the caller's own profile; drop the anon client; generic client message, Stripe detail logged only |
| P2-F03 | `POST /api/billing/checkout` | Builds an anon client (`:37-51`) that is null-checked (`:150-162`) and never queried: a deployment without the anon env answers 500 although checkout needs no database read. Forwards Stripe's error message (`:317`) | Yes (`/pricing`, `/billing`) | `architecture-invariants` (only checkout reads `body.plan`; no price from the body) | — | FIX: remove the unused client; generic client message |
| P2-F04 | `/billing/success` plan vocabulary | Own `Plan` = free · premium · pro · business · enterprise and `normalizePlan` (plus→premium, vip→pro) (`page.tsx:26-66, 208-229`). `/api/billing` answers the canonical `PlanId`, so a `starter` subscriber is shown "Free" on the page that confirms their purchase | Yes (Stripe success redirect) | none | `lib/plans.ts` (`PlanId`, `isPlanId`, `getPlan`) | CONSOLIDATE onto `lib/plans` |
| P2-F05 | `services/action-types.ts` | 410 lines, 30+ exports; one importer, type-only (`app/api/action/route.ts:3-5`, `ActionRequest`), which reads only `type` and `requiresConfirmation`. Its header names `services/action-parser.ts` and `action-executors.ts` as users; neither exists. History: `5e6439e` (add action parser), `a56cecb`, `ccea043` | Type only — no runtime reachability | `data-access` scans `services/` imports (passes either way) | The route's own request contract | CONSOLIDATE the one type into the route; DELETE the file. Doc references (`ARCHITECTURE_AUDIT.md:77,177`, `IMPLEMENTATION_PLAN.md:170`) are corrected in P2-H |
| P2-F06 | `GET /api/usage` | Own plan type (premium, no starter), own `PLAN_LIMITS` (requests 1,000 · messages 500 · agents 3 …, found nowhere else) and own `normalizePlan` (plus, vip, team, corporate, unlimited) (`route.ts:68-309`). It sums metadata keys `requests · messages · agents · projects · storage_bytes` (`:823-899`); the meter writes `model · promptTokens · completionTokens · totalTokens · endpoint` (`lib/usage/meter.ts:379-390`), so every figure is 0. Trial and subscription status are ignored | No UI consumer (`/api/billing` explains why it did not reuse it); external clients cannot be ruled out | `data-access` (uses `session.supabase`; contains a `user_id` filter) | `lib/usage/entitlements.ts` (`resolveEntitlement`, `limitFor`) and `lib/usage/meter.ts` (`USAGE_METRICS`, `countUsage`, `windowReset`) | CONSOLIDATE: report each enforced metric from the meter under the resolved entitlement. The ownership filter now lives in `countUsage`, so the `data-access` ownership list pins `lib/usage/meter.ts` in place of the route |
| P2-F07 | Retrievable knowledge status | Three copies say `["active"]`: `lib/memory/hierarchy.ts:106` (`RETRIEVABLE_STATUSES`), `lib/memory/retrieval.ts:192`, `app/api/knowledge/search/route.ts:719-722`; `MEMORY_ARCHITECTURE.md:138` documents it. The knowledge route writes `ready` by default and production rows are `ready` (`lib/search/query.ts:178-199`, defect D1), so chat and orchestration context never receive any knowledge | Yes (`/api/chat:875`, `lib/orchestration/tools.ts:104`) | `memory-isolation` (`:333`, `:503`), `search-isolation` (mirror, `:440`, `:813`) | `lib/search/query.ts` `searchableStatuses` for discovery | **FOUNDER DECISION (2026-09-14): consolidate, keep behaviour.** Aligning the value would make user knowledge enter AI prompts in production for the first time — a change in what the model sees, not a mechanical consolidation. The query in `retrieval.ts` and `/api/knowledge/search` now filter with `hierarchy.ts` `RETRIEVABLE_STATUSES`; the value stays `["active"]`. That no current record is retrievable is recorded as a KNOWN LIMITATION in `hierarchy.ts` |

#### What changed (P2-F01 … F07, uncommitted at `3f62f71`)

| ID | Change | Files |
|---|---|---|
| P2-F01 | `ChatApiResponse.error` typed `string \| { code?, message? }`; an object error is read by its `message` | `app/chat/page.tsx` |
| P2-F02 | Portal reads `stripe_customer_id` from `profiles` through `session.supabase` (`.eq("id", session.userId)`); route-local anon client and the `subscriptions` read removed; Stripe's message kept in the server log, client gets a generic 502 | `app/api/billing/portal/route.ts` (rewritten) |
| P2-F03 | Unused anon client and its 500 branch removed; Stripe's message no longer forwarded (generic 502); dead `VALID_INTERVALS` list removed (validation is `normalizeInterval`) | `app/api/billing/checkout/route.ts` |
| P2-F04 | Private `Plan` type, `PLAN_LABELS` and `normalizePlan` replaced by `PlanId`, `isPlanId`, `DEFAULT_PLAN`, `getPlan().name`; feature list from `getIncludedFeatures(plan)` instead of four generic lines | `app/billing/success/page.tsx` |
| P2-F05 | `ActionRequest` declared in the route (`type`, optional `input`); `services/action-types.ts` deleted (`git rm`, 411 lines) | `app/api/action/route.ts`, `services/action-types.ts` |
| P2-F06 | Route rebuilt on `resolveEntitlement` + `limitFor` + `USAGE_METRICS` / `countUsage` / `windowReset`; a count that cannot be read is a 500, never a 0; `period` other than the current month answers 400 `PERIOD_NOT_AVAILABLE`. `data-access` ownership list pins `lib/usage/meter.ts` in place of the route | `app/api/usage/route.ts` (rewritten), `tests/security/data-access.test.ts` |
| P2-F07 | Retrieval query and knowledge search filter with `.in("status", [...RETRIEVABLE_STATUSES])` from `lib/memory/hierarchy.ts`; value unchanged (`["active"]`); KNOWN LIMITATION recorded in `hierarchy.ts`. Two `memory-isolation` pins replaced by stronger ones (the canonical constant, no literal status filter) | `lib/memory/hierarchy.ts`, `lib/memory/retrieval.ts`, `app/api/knowledge/search/route.ts`, `tests/security/memory-isolation.test.ts` |
| Guard | New suite pinning F01–F06: 15 tests, 6 suites, 169 lines | `tests/security/purification-authorities.test.ts` |
| Lint | Duplicate `next/server` imports merged in three touched files — present at HEAD in all three | portal, checkout, knowledge search routes |

**Diff:** 14 tracked files, 325 insertions, 1,621 deletions (`git diff --stat HEAD`),
plus the new 169-line test file. Largest: `app/api/usage/route.ts` (1,180-line
diff), `services/action-types.ts` (−411).

#### Verification — seven steps on the final working tree

Every step ran alone, behind a 300 MB free-RAM gate checked in the same
command immediately before launch (`RESOURCE_POLICY.md`). Logs are in the
session scratchpad.

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 1 | Guard suite | `node --test --experimental-strip-types tests/security/purification-authorities.test.ts` | **PASS** — 15 tests, 6 suites: 15 pass, 0 fail, 0 skipped, 0 todo | 426 → 419 MB |
| 2 | Data access | `node --test … tests/security/data-access.test.ts` | **PASS** — 24 tests, 5 suites: 24 pass, 0 fail | 409 → 359 MB |
| 3 | Memory isolation | `node --test … tests/security/memory-isolation.test.ts` | **PASS** — 55 tests, 10 suites: 55 pass, 0 fail | 314 → 378 MB |
| 4 | Mutation testing | 11 mutations, below | **PASS** — 11 of 11 caught; 11 of 11 files restored to their original hash | 328 … 634 MB per mutation |
| 5 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`NODE_OPTIONS=--max-old-space-size=1536`) | **PASS** — exit 0, 0 `error TS` lines | 405 → 775 MB |
| 6 | Full suite | `npm run test:lowmem` (`node --test --test-concurrency=2 "tests/**/*.test.ts"`) | **PASS** — exit 0; 1,815 tests, 343 suites: 1,808 pass, 0 fail, 0 cancelled, 0 skipped, 7 todo (47.6 s) | 333 → 351 MB |
| 7 | Lint (12 files) | `npx eslint` on the 12 P2-F files (`--max-old-space-size=768`) | exit 1 — **1 error**, 0 warnings: `app/api/knowledge/search/route.ts:2:1 'next/server' import is duplicated (no-duplicate-imports)`. Present at HEAD (lines 1–2 identical); P2-F's hunks in that file are at lines 21 and 719–726 | 357 → 813 MB |
| 7a | Lint fix | Founder-authorized one-line change: `import { type NextRequest, NextResponse } from "next/server";` | Only change in the file beyond P2-F07 | — |
| 7b | Re-lint | `npx eslint app/api/knowledge/search/route.ts` | **PASS** — exit 0, 0 errors, 0 warnings | 301 → 766 MB |
| 7c | Regression check | `node --test … tests/security/memory-isolation.test.ts` | **PASS** — 55 / 55 | 641 → 619 MB |
| 8 | Final-state typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`), after 7a | **PASS** — exit 0, 0 `error TS` lines (three earlier attempts refused at the gate: 254, 254, 267 MB) | 470 → 668 MB |
| 9 | Final-state full suite | `npm run test:lowmem`, after 7a | **PASS** — exit 0; 1,815 tests, 343 suites: 1,808 pass, 0 fail, 0 cancelled, 0 skipped, 7 todo (53.7 s) (one earlier attempt refused at the gate: 278 MB) | 311 → 554 MB |

The other 11 files in step 7 were clean, including the portal and checkout
routes where an earlier lint run had found 3 errors (two duplicate
`next/server` imports and the unused `VALID_INTERVALS`), fixed before step 1.

**Test-count delta accounted:** 1,815 vs 1,800 in the last full run
before the guard file existed = exactly its 15 tests; 343 vs 337 suites =
its 6 suites. No test removed. The `data-access` ownership list changed one
entry for another (count unchanged); the two `memory-isolation` pins were
rewritten in place (count unchanged). The 7 todos are the documented
limitations (I-14, I-15 and five deferred boundaries), unchanged.

**Final state:** steps 5 and 6 first ran before the one-line import merge
(7a). Both were re-run on the final tree after it (rows 8 and 9): tsc exit
0, and the full suite 1,815 / 1,808 / 0 fail / 7 todo — identical to the
pre-merge run, so the merge changed no outcome.

#### Mutation testing (step 4)

Each mutation re-created one P2-F defect in the working tree, ran the
guard that owns it, and restored the original bytes (`WriteAllBytes` of
the pre-mutation read) in a `finally` block. The 9 affected files were
backed up to the scratchpad first. Hashes are SHA-256 (first 12 hex).

| # | Defect re-created | File | Guard | Result | Hash before = after |
|---|---|---|---|---|---|
| M1 | Portal reads `subscriptions` | `app/api/billing/portal/route.ts` | `purification-authorities` | **Caught** — 13 pass / 2 fail: "it reads profiles through the caller's RLS client", "it does not read a subscriptions table" | `728BB4A62F01` ✔ |
| M2 | Portal forwards `portalData?.error?.message` | `app/api/billing/portal/route.ts` | `purification-authorities` | **Caught** — 14 / 1: "portal does not forward Stripe's error message" | `728BB4A62F01` ✔ |
| M3 | Checkout imports `createClient` | `app/api/billing/checkout/route.ts` | `purification-authorities` | **Caught** — 14 / 1: "checkout creates no Supabase client" | `2963CFA569D4` ✔ |
| M4 | Success page drops `isPlanId` for a `"premium"` literal | `app/billing/success/page.tsx` | `purification-authorities` | **Caught** — 13 / 2: "plan names and features come from lib/plans", "no private plan vocabulary survives" | `55F579081198` ✔ |
| M5 | `/api/usage` reads `PLAN_LIMITS[…]` instead of `limitFor` | `app/api/usage/route.ts` | `purification-authorities` | **Caught** — 13 / 2: "plan and limits come from the entitlement module", "no private plan table or plan normaliser survives" | `0F00EFBE1040` ✔ |
| M6 | `/api/usage` fail-closed branch disabled (`if (false)`) | `app/api/usage/route.ts` | `purification-authorities` | **Caught** — 14 / 1: "an unreadable count is a failure, never a zero" | `0F00EFBE1040` ✔ |
| M7 | `countUsage` loses `.eq("user_id", userId)` (rate limiter's filter kept) | `lib/usage/meter.ts` | `purification-authorities`; `data-access` | **Caught** by `purification-authorities` — 14 / 1: "the meter's count is scoped to the caller". **Not caught** by `data-access` — 24 / 0 | `BA6ED277EDD8` ✔ |
| M8 | Retrieval back to `.eq("status", "active")` | `lib/memory/retrieval.ts` | `memory-isolation` | **Caught** — 54 / 1: "the query filters status at the database level" | `4C6C517C73AB` ✔ |
| M9 | Knowledge search drops the import, filters `["active"]` | `app/api/knowledge/search/route.ts` | `memory-isolation` | **Caught** — 54 / 1: "the search route filters status at the query level" | `310EA362C84F` ✔ |
| M10 | Chat throws `String(data.error)` | `app/chat/page.tsx` | `purification-authorities` | **Caught** — 14 / 1: "an object error is read by its message" | `99CC31E6B69A` ✔ |
| M11 | Action route imports `services/action-types` | `app/api/action/route.ts` | `purification-authorities` | **Caught** — 14 / 1: "services/action-types.ts is gone and not imported" | `E95E3248ED6B` ✔ |

**M7 finding:** the generic `data-access` ownership pin (the file contains
a quoted `user_id`) does not catch the loss of `countUsage`'s filter,
because `meter.ts` holds a second one (the rate limiter, `:536`). The
specific `countUsage` pin in `purification-authorities` is what detects it,
and is why that pin was added.

**Hash note:** `app/api/knowledge/search/route.ts` restored to
`310EA362C84F` after M9; its current hash is `1E5E0D3189A5` because of the
later founder-authorized import merge (7a). The other eight files still hash
to their step-4 values. `git status --short` was identical before and
after every mutation run.

**Memory during step 4:** runs 1 and 2 stopped at the gate before M1
(290 MB, 293 MB); run 3 completed M1 (328 MB) and stopped before M2
(298 MB); run 4 completed M2–M11 (417, 567, 524, 540, 559, 518, 634, 591,
563, 540 MB; 521 MB at the end). No mutation started below 300 MB.

#### Memory gates and interruptions

- Three background verification jobs were killed by the OS for low memory
  before this record: the first after tsc exit 0 and a full suite of
  1,800 / 1,793 / 0 / 7 (on an earlier P2-F state), during lint; the second
  on its first lint group with 404 MB free (type-aware ESLint loads the
  whole program regardless of file count); the third while waiting for
  memory. After each: no orphan process of this session, tree unchanged.
- Gate refusals (no process started): step 1 ×3 (217–276 MB), step 5 ×1
  (284 MB), step 6 ×1 (276 MB), step 7 ×1 (281 MB), step 4 as above.
- The founder issued a hard stop, a read-only state report followed, and
  verification then resumed one founder-authorized step at a time.

#### Known limitations

- **P2-F07:** no knowledge record is retrievable into AI context — records
  are written `ready`, the rule allows `active`. Kept by founder decision
  (2026-09-14); recorded in `lib/memory/hierarchy.ts`.
- `MEMORY_ARCHITECTURE.md:138` still documents `status = 'active'` as the
  retrievable state; `ARCHITECTURE_AUDIT.md:77,177` and
  `IMPLEMENTATION_PLAN.md:170` still name `services/action-types.ts`.
  Documentation purification (P2-H) is not started.
- `/api/usage` changed its response shape (per-metric `metrics` keyed by
  meter key; no `period` history). It has no UI consumer; external clients
  cannot be ruled out.
- `/billing/success` shows the first six features `lib/plans.ts` lists for
  the plan; it does not claim they were "activated" beyond that.
- No production build was run for P2-F.
- `PHASE_STATE.md` still reads "Phase 2 — NOT STARTED", and the founder has
  stated Phase 1 was PARTIAL while the state docs record PASS. Neither was
  changed; the founder decides.
- Not started: P2-F08 (`/api/chat` provider pairing), P2-F09 (voice
  transcribe error text), P2-G01 (`/api/stream` retirement), P2-H.

#### What was not done — evidence

| Action | Status | Evidence |
|---|---|---|
| Build | **Not run** for P2-F | No `next build` / `npm run build` issued in this batch |
| Commit | **None** for P2-F | HEAD `3f62f71` (last Phase 2 commit, P2-E); P2-F is 14 modified/deleted tracked files + 1 untracked file in `git status --short` |
| Push / PR | **None** | `origin/main` = `fd73f2b`; 64 local commits not on `origin/main`, 0 behind; no remote-tracking ref contains `232c62a` (local refs, no fetch). No `git push` / `gh pr` issued |
| Deploy | **None** | No deploy command; nothing pushed, so the Vercel Git integration received nothing |
| Migration | **None** | `git diff --name-only HEAD -- supabase/migrations` empty; no `supabase` CLI or SQL command run |
| Secrets / OAuth | **Unchanged** | `git diff --name-only HEAD -- ".env*"` empty; no `.env*` file read for credentials or written; no OAuth authorization |

**RESULT (P2-F01…F07):** verified — all seven steps PASS on the final tree
(lint after the founder-authorized one-line fix). **Not committed**;
awaiting founder instruction.

### P2-F08 — `/api/chat` provider pairing (founder-approved 2026-09-14)

| ID | Surface | Duplicate and its drift (file:line at `d144ca7`) | Reachable | Tests that pin it | Canonical owner | Decision |
|---|---|---|---|---|---|---|
| P2-F08 | `POST /api/chat` provider pairing and fallback | `resolveAiPolicy` returns a registry `ModelDefinition` (id **and** provider), but `getProvider(body.provider, policy.policy.model.id)` (`route.ts:354-426`, `:945-949`) keeps only the id and picks the vendor from the client's `body.provider`, else from whichever key exists (OpenAI first). A Groq model id can be sent to OpenAI; with only a Groq key the default `gpt-4o-mini` is sent to Groq. `getFallbackProvider(provider)` (`:508-548`) is called without a model, so it sends `DEFAULT_GROQ_MODEL` / `DEFAULT_OPENAI_MODEL` (`:78-84`: env `GROQ_MODEL` / `OPENAI_MODEL`, else a hardcoded id) — a model neither the registry nor the plan check approved — carries the primary's token ceiling to it, fires on **any** non-OK status (a 400 buys a second paid refusal), and meters the unapproved id (`:1105`, `:1137`). Base URLs and keys are hardcoded / read from `process.env` beside the registry's `PROVIDER_ENDPOINTS` / `providerApiKey`; `GET` (`:1207-1216`) reads the keys directly too | Yes — `app/chat/page.tsx:305`, `app/chat/[id]/page.tsx:474` (both send only `message`/`messages`: default model, non-stream) | `defect-remediation` D3 (401/403→503 `PROVIDER_NOT_CONFIGURED`, 429→503 `PROVIDER_RATE_LIMITED`, 502 `PROVIDER_REQUEST_FAILED`, no key text within 900 chars before `PROVIDER_NOT_CONFIGURED`), `ai-provider` (model resolved server-side; policy denial returned; guard before policy; no raw client model), `observability-redaction` (provider body bounded), `usage-enforcement`, `memory-isolation` (context order; guard before policy), `api-auth-boundary`, `middleware-gate`, `architecture-invariants` §3 | `lib/ai/registry.ts` (`ProviderId`, `PROVIDER_ENDPOINTS`, `providerApiKey`) and `lib/ai/failover.ts` (`failoverCandidates` — plan re-validated, other-provider alternatives only; `isFailoverWorthy`) with `lib/ai/provider.ts` `normalizeHttpError` | CONSOLIDATE the pairing onto the registry and failover rules; delete `body.provider`, the env default models, `getProvider`, `getFallbackProvider`, `AIProvider` |

**`normalizeHttpError` re-checked before coding (`lib/ai/provider.ts:152-187`):**
401/403 → `AUTHENTICATION`; 429 → `RATE_LIMITED`; 400/422 →
`INVALID_REQUEST`; **everything else, 404 included → `PROVIDER_ERROR`**.
`isFailoverWorthy` accepts `AUTHENTICATION`, `RATE_LIMITED`,
`PROVIDER_ERROR`, `TIMEOUT`, `NOT_CONFIGURED`. So a 404 (a vendor that does
not know the model) fails over; a 400/422 is answered as is.

**Correction to the inspection:** a timeout or network failure *throws*
out of `fetch` into the route's catch (504/500) and never failed over.
Failover here is status-based as approved, so that is unchanged and
recorded as a limitation.

**Guard coverage found during the design:** `architecture-invariants` §3
("every route that reaches a paid model is metered before the call")
detects paid routes by `api.openai.com | api.groq.com | chatCompletion…(`.
With registry-derived base URLs the chat route would match none and drop
out of that check silently. Its detector gains `PROVIDER_ENDPOINTS\[`
(a strengthening), and mutation M-f proves chat is still covered.

**Plan (as approved):**
1. Candidates = `failoverCandidates(policy.policy.model, "chat",
   guard.entitlement.effectivePlan)`, keeping only providers with
   `providerApiKey(provider) !== null`; each config's base URL from
   `PROVIDER_ENDPOINTS`, model = the candidate's registry id, max tokens =
   min(policy ceiling, candidate `maxOutputTokens`). None configured → the
   existing 503.
2. Try candidates in order; move on only while
   `isFailoverWorthy(normalizeHttpError(response.status))`.
3. Delete `body.provider`, `DEFAULT_OPENAI_MODEL`, `DEFAULT_GROQ_MODEL`,
   `getProvider`, `getFallbackProvider`, `AIProvider`; `GET` reports keys
   through `providerApiKey`.
4. Unchanged: auth, usage guard, tenant guards, context assembly, policy
   order, D3 codes and messages, bounded provider-body log, SSE framing,
   response shape. The route keeps its own `fetch`/SSE transport (not
   moved onto `chatCompletion` / `chatCompletionStream` in this step).
5. Out of scope: `/api/files/analyze` and `/api/agents` (same env-model
   pattern) — candidates for a later record.

**Guards and mutations planned:** a P2-F08 block in
`purification-authorities` (no `body.provider`; no `OPENAI_MODEL` /
`GROQ_MODEL`; no hardcoded vendor URL; plan-aware `failoverCandidates`;
fallback gated on `isFailoverWorthy(normalizeHttpError(…))`; config from
`PROVIDER_ENDPOINTS` / `providerApiKey`). Mutations M-a `body.provider`,
M-b env default model, M-c unconditional fallback, M-d hardcoded vendor
URL, M-e plan-unaware candidates, M-f usage guard removed (coverage).

#### What changed (uncommitted at `d144ca7`)

- `app/api/chat/route.ts` — imports `PROVIDER_ENDPOINTS`, `providerApiKey`,
  `ModelDefinition`, `ProviderId` (registry), `failoverCandidates`,
  `isFailoverWorthy` (failover), `normalizeHttpError` (provider).
  `ProviderConfig` is now `{ provider: ProviderId, apiKey, baseUrl, model,
  maxTokens }`, built only by `toProviderConfigs(candidates, maxTokens)`:
  keyless providers skipped, base URL from `PROVIDER_ENDPOINTS`, model = the
  candidate's registry id, max tokens = `Math.min(maxTokens,
  candidate.maxOutputTokens)`. The handler calls
  `failoverCandidates(policy.policy.model, "chat",
  guard.entitlement.effectivePlan)`; the first configured candidate answers
  first, and the loop moves on only while
  `isFailoverWorthy(normalizeHttpError(response.status))`, logging the
  hand-over (provider, model, status — no body) and cancelling the
  abandoned response body. Deleted: `body.provider`, `AIProvider`,
  `DEFAULT_OPENAI_MODEL`, `DEFAULT_GROQ_MODEL`, `getProvider`,
  `getFallbackProvider`. `GET` reports keys through `providerApiKey`.
  Unchanged: auth, usage guard, tenant guards, context assembly, policy
  order, D3 codes and messages, bounded provider-body log, SSE framing,
  response shape. 301-line diff; 1,063 → 1,018 non-blank lines.
- `tests/security/purification-authorities.test.ts` — P2-F08 block, 6 tests.
- `tests/security/architecture-invariants.test.ts` — §3 paid-call detector
  gains `PROVIDER_ENDPOINTS\[` (strengthening; see M-f).
- Totals (`git diff --stat HEAD`): code and tests 3 files, +187 / −180;
  with docs 5 files, +242 / −181.

#### Verification (each step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 0 | Leftover sweep | search the route for the removed names, env model names, `body.provider`, `process.env`, vendor URLs | **PASS** — no match | — |
| 1 | Guard suite | `node --test --experimental-strip-types tests/security/purification-authorities.test.ts` | **PASS** — 21 tests, 7 suites: 21 pass, 0 fail (15 earlier + 6 P2-F08). First launch refused at the gate (286 MB) | 300 → 330 MB |
| 2 | Mutations | 6 mutations, below | **PASS** — 6 of 6 caught; chat route restored to `AFAE18C8651A` after each | 313 … 388 MB per mutation |
| 3 | Regression suites | `node --test --test-concurrency=1 …` `ai-provider`, `defect-remediation`, `observability-redaction`, `usage-enforcement`, `memory-isolation`, `api-auth-boundary`, `middleware-gate`, `architecture-invariants` | **PASS** — exit 0; 478 tests, 65 suites: 471 pass, 0 fail, 7 todo | 329 → 310 MB |
| 4 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`) | **PASS** — exit 0, 0 `error TS` lines | 374 → 703 MB |
| 5 | Full suite | `npm run test:lowmem` | **PASS** — exit 0; 1,821 tests, 344 suites: 1,814 pass, 0 fail, 0 skipped, 7 todo (59.3 s) | 345 → 615 MB |
| 6 | Lint | `npx eslint app/api/chat/route.ts tests/security/purification-authorities.test.ts tests/security/architecture-invariants.test.ts` (`--max-old-space-size=768`) | **PASS** — exit 0, 0 errors, 0 warnings | 521 → 357 MB |

**Test-count delta accounted:** 1,821 vs 1,815 (previous final state) = the
6 new P2-F08 tests; 344 vs 343 suites = the one new `describe`. No test
removed. The 7 todos are the documented limitations, unchanged. In steps
3 and 5 the log prints "failing tests:" followed by those todo entries
(`assert.ok(false)` placeholders); 0 tests failed.

#### Mutation testing

Each mutation re-created one defect in `app/api/chat/route.ts`, ran the
guard that owns it, and restored the original bytes in a `finally` block;
the file was backed up to the scratchpad first. SHA-256, first 12 hex.

| # | Defect re-created | Guard | Result | Hash before = after |
|---|---|---|---|---|
| M-a | Route reads `body.provider` again (`if (!provider \|\| body.provider === "groq")`) | `purification-authorities` | **Caught** — 20 / 1: "the client cannot choose the provider" | `AFAE18C8651A` ✔ |
| M-b | Env default model (`model: process.env.GROQ_MODEL ?? candidate.id`) | `purification-authorities` | **Caught** — 20 / 1: "no model comes from the environment" | `AFAE18C8651A` ✔ |
| M-c | Unconditional fallback (`if (response.ok) {` without `isFailoverWorthy`) | `purification-authorities` | **Caught** — 20 / 1: "a failed call moves on only when failover is worth it" | `AFAE18C8651A` ✔ |
| M-d | Hardcoded vendor URL instead of `PROVIDER_ENDPOINTS[…].baseUrl` | `purification-authorities` | **Caught** — 20 / 1: "endpoints and keys come from the registry" | `AFAE18C8651A` ✔ |
| M-e | Plan-unaware candidates (`"enterprise"` instead of `guard.entitlement.effectivePlan`; 1 occurrence) | `purification-authorities` | **Caught** — 20 / 1: "candidates are the plan-aware failover candidates" | `AFAE18C8651A` ✔ |
| M-f | Usage guard removed (`await noUsageCheck(`) — coverage of the paid-call detector | `architecture-invariants`; `usage-enforcement` | **Caught** by both — `architecture-invariants` 44 / 1: "every route that reaches a paid model is metered before the call" (possible only because the detector now matches `PROVIDER_ENDPOINTS[`); `usage-enforcement` 52 / 2: "app/api/chat/route.ts enforces usage before doing work" | `AFAE18C8651A` ✔ |

`git status --short` identical before and after every mutation run.
**Memory:** the run was interrupted three times at the gate before a
mutation started (M-a first attempt 283 MB, M-b first attempt 291 MB, M-c
first attempt 285 MB); each resumed at the next unrun mutation, none
repeated. Two memory-only watchers were used between runs; one was killed
by the OS for low memory (it ran nothing). No mutation started below
300 MB.

#### Known limitations

- `/api/chat` keeps its own `fetch` / SSE transport; moving it onto
  `chatCompletion` / `chatCompletionStream` is a separate step.
- A thrown timeout or network error does not fail over (unchanged; it was
  never retried) — only HTTP statuses are classified.
- A 404 now fails over (it is `PROVIDER_ERROR`); before, any non-OK status
  did. A 400 / 422 no longer buys a second call.
- If the deployment sets `OPENAI_MODEL` / `GROQ_MODEL`, chat no longer
  reads them; the fallback is the registry's next approved candidate.
  Production environment variable names were not inspected.
- `/api/files/analyze` and `/api/agents` still read env model names (out
  of scope; not yet recorded).
- No live provider call or browser check: behaviour against a real
  provider is proven only by source guards, types and the suites above.
- No production build was run.

#### Not done

No commit, push, deploy, build, migration, or secret / OAuth change.
`syraven-audit.zip` (untracked, not created by this work) was not opened,
moved, deleted or staged.

**RESULT (P2-F08):** implemented and verified — all steps PASS. **Not
committed**; awaiting founder instruction.

### P2-F09 — voice provider errors (founder-approved 2026-09-15, both voice routes)

| ID | Surface | Leak (file:line at `0ee964c`) | Reachable | Tests that pin it | Canonical owner | Decision |
|---|---|---|---|---|---|---|
| P2-F09a | `POST /api/voice/transcribe` | On a non-OK OpenAI response `getOpenAIErrorMessage(payload)` (`:235-251`) returns OpenAI's own `error.message`, and `createErrorResponse(message, safeStatus, …)` (`:604-631`) sends it as the client's `error`. `safeStatus` maps only 5xx → 502, so every provider 4xx passes through: a 401/403 on **our** key reaches the client as their own 401/403, our provider 429 as their rate limit. Provider text can carry project / organisation ids, quota and billing detail, key status and request echoes. The server log carries the same message uncapped | Route; no UI caller (`/api/voice/*` referenced only inside the speak route) | `api-auth-boundary`, `usage-enforcement`, `middleware-gate` — **none pins the error text or status** | `lib/ai/provider.ts` `normalizeHttpError(status)` — client-safe message and mapped status (401/403/429 → 503, 400/422 → 400, else 502) — and the 300-character log bound used at every other provider call site | FIX: client gets only `normalizeHttpError(response.status)`'s message and status; provider message logged capped at 300; `getOpenAIErrorMessage` deleted |
| P2-F09b | `POST /api/voice/speak` | Same leak in the sibling route (`:547-591`): the client response carries `error.message: providerMessage`, `providerType` and the raw provider `status`, under the provider's own HTTP status; the log carries the message uncapped | Route; no UI caller | `ai-provider` (model-accepting), `api-auth-boundary`, `usage-enforcement`, `middleware-gate` — none pins the error text or status | Same | FIX: same mapping; `TTS_REQUEST_FAILED` code, `provider` and `latencyMs` kept; `providerType` and the raw `status` no longer sent; provider message logged capped at 300 |

**Unchanged:** auth, usage guard and denial return, `guard.record`, every
validation message, the timeout / network / unexpected-error responses,
both success responses, and the model / key / URL logic.

**Out-of-scope findings (recorded, not fixed — a later step):**
`/api/voice/transcribe` keeps its own model allowlist (`ALLOWED_MODELS`,
`:45-49`, including `gpt-4o-transcribe`, which is not in the registry) with
no `selectModel` or plan check, reads `process.env.OPENAI_API_KEY` directly
(`:355`) and posts to a hardcoded URL (`:13-14`); `/api/voice/speak` takes
its default model from env `OPENAI_TTS_MODEL` (`:30-32`) and posts to a
hardcoded URL (`:27-28`). Same class as P2-F08 and the `/api/files/analyze`,
`/api/agents` env models.

**Guards and mutations planned:** a P2-F09 block in
`purification-authorities` for both routes (client response built only from
`normalizeHttpError`; no provider message, `providerType` or raw status in
it; provider message logged only capped at 300; `getOpenAIErrorMessage` /
`safeStatus` gone). Mutations M-a transcribe message leak, M-b transcribe
status passthrough, M-c uncapped logging, M-d missing `normalizeHttpError`
mapping, M-e speak message leak, M-f speak status passthrough.

#### What changed (uncommitted at `0ee964c`)

- `app/api/voice/transcribe/route.ts` — imports `normalizeHttpError`;
  `getOpenAIErrorMessage` deleted. On a non-OK provider response the
  provider message is kept only for the log (`payload.error.message.trim()
  .slice(0, 300)`), and the client gets `createErrorResponse(
  failure.clientMessage, failure.status, …)` from
  `normalizeHttpError(response.status)`; `safeStatus` (4xx passthrough) is
  gone.
- `app/api/voice/speak/route.ts` — imports `normalizeHttpError`. The log
  keeps status, message (`.slice(0, 300)`) and type; the client response is
  `{ error: { code: "TTS_REQUEST_FAILED", message: failure.clientMessage },
  provider: "openai", latencyMs }` under `failure.status` — no
  `providerMessage`, `providerType` or raw provider `status`.
- `tests/security/purification-authorities.test.ts` — P2-F09 block: 6 tests
  in 2 suites (3 per route).
- Totals (`git diff --stat HEAD`): code and tests 3 files, +90 / −48; with
  docs 5 files, +121 / −49.

#### Verification (each step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 0 | Leftover sweep | search both voice routes for `getOpenAIErrorMessage`, `safeStatus`, `providerMessage`, `providerType`, `failure.` | **PASS** — provider message and type appear only in the log calls; both client responses are built only from `failure.*` | — |
| 1 | Guard suite | `node --test --experimental-strip-types tests/security/purification-authorities.test.ts` | **PASS** — 27 tests, 9 suites: 27 pass, 0 fail (21 earlier + 6 P2-F09) | 395 → 322 MB |
| 2 | Mutations | 6 mutations, below | **PASS** — 6 of 6 caught; both routes restored to their original hash after each | 338 … 499 MB per mutation |
| 3 | Regression suites | `node --test --test-concurrency=1 …` `purification-authorities`, `usage-enforcement`, `api-auth-boundary`, `middleware-gate`, `ai-provider`, `observability-redaction` | **PASS** — exit 0; 374 tests, 44 suites: 374 pass, 0 fail, 0 todo | 571 → 556 MB |
| 4 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`) | **PASS** — exit 0, 0 `error TS` lines | 486 → 743 MB |
| 5 | Full suite | `npm run test:lowmem` | **PASS** — exit 0; 1,827 tests, 346 suites: 1,820 pass, 0 fail, 0 skipped, 7 todo (46.1 s) | 556 → 617 MB |
| 6 | Lint | `npx eslint app/api/voice/transcribe/route.ts app/api/voice/speak/route.ts tests/security/purification-authorities.test.ts` (`--max-old-space-size=768`) | **PASS** — exit 0, 0 errors, 0 warnings | 607 → 502 MB |

**Test-count delta accounted:** 1,827 vs 1,821 (after P2-F08) = the 6 new
P2-F09 tests; 346 vs 344 suites = the 2 new `describe` blocks. No test
removed; the 7 todos are the documented limitations, unchanged ("failing
tests:" in the step 5 log lists only those).

#### Mutation testing

Each mutation re-created one defect, ran `purification-authorities`, and
restored the original bytes in a `finally` block; both routes were backed
up to the scratchpad first. SHA-256, first 12 hex.

| # | Defect re-created | File | Result | Hash before = after |
|---|---|---|---|---|
| M-a | Provider message returned (`providerMessage ?? failure.clientMessage`) | transcribe | **Caught** — 25 / 2: "the client gets only the canonical message and status", "no response is built from the provider's message or status" | `21FE6CDF78C1` ✔ |
| M-b | Provider status passed through (`response.status` for `failure.status`) | transcribe | **Caught** — 26 / 1: "the client gets only the canonical message and status" | `21FE6CDF78C1` ✔ |
| M-c | Provider message logged uncapped (`.trim()` without `.slice(0, 300)`) | transcribe | **Caught** — 26 / 1: "the provider message is logged only capped" | `21FE6CDF78C1` ✔ |
| M-d | `normalizeHttpError` mapping replaced by a literal message with `response.status` | transcribe | **Caught** — 26 / 1: "the client gets only the canonical message and status" | `21FE6CDF78C1` ✔ |
| M-e | Provider message returned (`providerMessage \|\| failure.clientMessage`) | speak | **Caught** — 25 / 2: "the client gets only the canonical message and status", "no provider message, type or status is in the response" | `BF40A18170C0` ✔ |
| M-f | Provider status passed through (`response.status` for `failure.status`) | speak | **Caught** — 25 / 2: same two tests | `BF40A18170C0` ✔ |

`git status --short` identical before and after; `syraven-audit.zip` hash
unchanged. **Memory:** the first mutation run stopped at the gate before
M-a (286 MB, no mutation applied); a memory-only watcher (ran nothing)
reported 354 MB free, and the single retry ran all six.

#### Known limitations

- Out-of-scope findings stand, unfixed: the transcribe model allowlist
  (`gpt-4o-transcribe` not in the registry, no plan check), the direct
  `OPENAI_API_KEY` read, the hardcoded URLs in both voice routes, and the
  speak route's env default model.
- Neither voice route has a UI caller; the change is proven by source
  guards, types and the suites above, not by a live provider call (a real
  OpenAI error cannot be produced without secrets or production).
- The status mapping is now `normalizeHttpError`'s: our 401/403/429 become
  503, 400/422 become 400, others 502. A client that relied on seeing the
  provider's 4xx now sees the mapped status.
- No production build was run.

#### Not done

No commit, push, deploy, build, migration, or secret / OAuth change.
`syraven-audit.zip` not opened, moved, deleted or staged.

**RESULT (P2-F09):** implemented and verified — all steps PASS. **Not
committed**; awaiting founder instruction.

### P2-G — legacy routes

**Inventory (read-only, 2026-09-15, at `70e660e`).** All 35 `app/api/**/route.ts`
files were matched against every `/api/…` string in `app/`, `lib/`,
`middleware.ts` and `e2e/` outside `app/api` (comments separated from live
fetches), and against the tests that pin them.

| Candidate | Callers | Finding | Status |
|---|---|---|---|
| G01 `/api/stream` | none | Second streaming chat transport | **G-B1 — approved, below** |
| G02 `/api/agents/execute` | none (lib mentions are comments) | Second chat-completion path; caller `systemPrompt` becomes the system message unfenced | G-B2, not started |
| G03 `/api/action` | none (e2e deliberately avoids it) | Classifies only, never runs; still meters `agentRun` | G-B2, not started |
| G04 `/api/knowledge/search` | none | Second keyword search; `["active"]` filter returns nothing for `ready` rows | G-B3, not started |
| G05 `/api/files/analyze` | none | The pre-P2-F08 provider logic (env models, own pickers, hardcoded URLs, direct keys) | G-B5, founder decision |
| G06 `/api/files/upload` | none | Unmetered 50 MB service-role storage writes | G-B4, founder decision |
| G07 `/api/voice/*` | none | Own model list, direct key, hardcoded URLs, env TTS model (P2-F09 out-of-scope) | G-B6, founder decision |
| G08 `/api/agents` POST | agents pages | Stores an env default model with no registry validation | G-B7, not started |

Retained with evidence: `/api/tasks/execute` (already 410), `/api/usage`
(P2-F06, e2e), `/api/auth/logout` (D4), `/api/billing/webhook` (Stripe),
`/api/canvas` (canvas page), and every route with a live UI caller. UI
mentions of `/api/marketplace`, `/api/privacy`, `/api/profile`,
`/api/settings` are explanatory comments, not fetches.

#### P2-G01 — retire `/api/stream` (founder-approved 2026-09-15, G-B1)

| ID | Route | Evidence (file:line at `70e660e`) | Consumers | Tests that pin it | Canonical replacement | Decision |
|---|---|---|---|---|---|---|
| P2-G01 | `POST /api/stream` | 1,065 lines. A second streaming chat transport beside `/api/chat`: reads `GROQ_API_KEY` directly (`:551`), posts to a hardcoded Groq URL (`:696`), defaults to env `SYRAVEN_AI_MODEL` (`:83-85`) with its own model allowlist (`:423`), and places the client's `memoryContext` verbatim in the SYSTEM prompt under "RELEVANT MEMORY CONTEXT" (`:315-369`, `:629-650`) — bypassing `lib/memory` retrieval and the untrusted-content fence `/api/chat` applies. Groq-only, its own stream format. History `7554f31` … `7dae7e9` (last change 2026-09-07) | **None** — no reference in `app/`, `lib/`, `e2e/`, `public/`; only `middleware-gate` names the path | `ai-provider` (model-accepting list; policy-after-guard list), `usage-enforcement` (`METERED_ROUTES`), `observability-redaction` ("stream truncates the provider error body"; route sweep), `api-auth-boundary` (`AI_SPENDING_ROUTES`: exists + `POST = withAuth(`), `middleware-gate` (gated list) | `/api/chat` with `stream: true` — registry model, fenced context, metered | RETIRE: a `withAuth` 410 naming `/api/chat`, reading, writing and spending nothing — the `/api/tasks/execute` precedent. External clients cannot be ruled out, so the path answers rather than 404s |

**Pins reworked — only those that require the stream implementation:**
- `ai-provider` `MODEL_ACCEPTING` (requires `resolveAiPolicy` /
  `selectModel`) and the policy-after-guard list (requires `enforceUsage` and
  `resolveAiPolicy`): `/api/stream` removed from both.
- `usage-enforcement` `METERED_ROUTES` (requires `enforceUsage` and
  `guard.record`): removed.
- `observability-redaction` "stream truncates the provider error body"
  (requires a provider log call): replaced by "the retired stream route logs
  no provider body" (it makes no provider call).

**Unchanged:** `api-auth-boundary` (`POST = withAuth(` — the retired route
still satisfies it), `middleware-gate` (the path stays gated), the
`observability-redaction` route sweep (a file with no provider body passes
it), and every provider/metering sweep (`architecture-invariants` §3,
`usage-enforcement` and `ai-provider` "every route calling a provider is
metered" — a route with no provider call is not in their scope).

**Shared retired-route guard** (new, `purification-authorities`, covering
`/api/stream` and the existing retired `/api/tasks/execute`): each retired
route exports `POST = withAuth(`, answers `status: 410`, and contains no
`fetch(`, `.from(` / `.rpc(`, `enforceUsage(` / `guard.record(`,
`process.env`, `supabaseAdmin`, provider adapter call or vendor URL; and no
file in `app/`, `lib/` or `tests/e2e/` outside the route itself references
its path.

**Mutations planned:** M1 re-add a provider `fetch` to the retired route;
M2 change 410 to 200; M3 remove `withAuth`; M4 add a caller of
`/api/stream` in `app/chat/page.tsx`.

#### What changed (uncommitted at `70e660e`)

- `app/api/stream/route.ts` — the legacy implementation is removed
  completely (1,065 lines → 50). The route now exports only
  `POST = withAuth(async () => …)`, answering 410
  `{ success: false, error: { code: "ROUTE_RETIRED", message: "This
  endpoint is retired. Stream chat through /api/chat with stream: true." } }`
  with `Cache-Control: private, no-store`. No provider call, database access,
  usage enforcement, env read or logging.
- `tests/security/purification-authorities.test.ts` — shared retired-route
  guard (`RETIRED_ROUTES`: `/api/tasks/execute`, `/api/stream`): per route,
  "requires a session and answers 410", "reads, writes and spends nothing",
  "nothing in the product calls" (scans `app/`, `lib/`, `tests/e2e/`,
  comments stripped). 6 tests, 1 suite.
- `tests/security/ai-provider.test.ts` — `/api/stream` removed from
  `MODEL_ACCEPTING` and from the policy-after-guard list, each with a note.
- `tests/security/usage-enforcement.test.ts` — removed from
  `METERED_ROUTES`, with a note.
- `tests/security/observability-redaction.test.ts` — "stream truncates the
  provider error body" replaced by "the retired stream route logs no
  provider body".
- Unchanged: `api-auth-boundary` (still pins `POST = withAuth(`),
  `middleware-gate` (path still gated).
- Totals (`git diff --stat HEAD`): code and tests 5 files, +149 / −1,065;
  with this file 6 files, +212 / −1,066.

#### Verification (each step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 1 | Affected guard suites | `node --test --test-concurrency=1 …` `purification-authorities`, `ai-provider`, `usage-enforcement`, `observability-redaction`, `api-auth-boundary`, `middleware-gate` | **PASS** — exit 0; 376 tests, 45 suites: 376 pass, 0 fail | 304 → 356 MB |
| 2 | Mutations | 4 mutations, below | **PASS** — 4 of 4 caught; files restored to their original hash | 333 … 399 MB per mutation |
| 3 | Regression suites | `node --test --test-concurrency=1 …` `architecture-invariants`, `api-reference-integrity`, `data-access`, `defect-remediation`, `memory-isolation` | **PASS** — exit 0; 171 tests, 37 suites: 164 pass, 0 fail, 7 todo | 483 → 471 MB |
| 4 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`) | **PASS** — exit 0, 0 `error TS` lines | 512 → 745 MB |
| 5 | Full suite | `npm run test:lowmem` | **PASS** — exit 0; 1,829 tests, 347 suites: 1,822 pass, 0 fail, 0 skipped, 7 todo (58.3 s) | 485 → 427 MB |
| 6 | Lint | `npx eslint app/api/stream/route.ts` and the four changed test files (`--max-old-space-size=768`) | **PASS** — exit 0, 0 errors, 0 warnings | 423 → 677 MB |

**Test-count delta accounted:** 1,829 vs 1,827 (after P2-F09) = +6 retired-
route tests (3 × 2 routes), −2 (`ai-provider` `MODEL_ACCEPTING` generates 2
tests per route), −2 (`usage-enforcement` `METERED_ROUTES` generates 2 per
route), 0 (`observability-redaction` test replaced one-for-one). Suites
347 vs 346 = the new retired-route `describe`. The 7 todos are the
documented limitations; "failing tests:" in the step 3 and 5 logs lists
only those.

#### Mutation testing

Each mutation re-created one defect, ran the guard that owns it, and
restored the original bytes in a `finally` block; both files were backed up
to the scratchpad first. SHA-256, first 12 hex.

| # | Defect re-created | File | Result | Hash before = after |
|---|---|---|---|---|
| M1 | Provider `fetch` re-added to the retired route | `app/api/stream/route.ts` | **Caught** — `purification-authorities` 32 / 1: "/api/stream reads, writes and spends nothing" | `2DFCE8D728AB` ✔ |
| M2 | `status: 410` changed to `200` | `app/api/stream/route.ts` | **Caught** — 32 / 1: "/api/stream requires a session and answers 410" | `2DFCE8D728AB` ✔ |
| M3 | `withAuth` removed (`POST = (async () => …)`) | `app/api/stream/route.ts` | **Caught** — `purification-authorities` 32 / 1: "requires a session and answers 410"; `api-auth-boundary` 135 / 1: "app/api/stream/route.ts exists and wraps POST in withAuth" | `2DFCE8D728AB` ✔ |
| M4 | A product caller added (`fetch("/api/stream", …)` in the chat page) | `app/chat/page.tsx` | **Caught** — 32 / 1: "nothing in the product calls /api/stream" | `99CC31E6B69A` ✔ |

`git status --short` identical before and after every mutation run;
`syraven-audit.zip` size and timestamp unchanged. **Memory:** the first
mutation run completed M1 (360 MB) and stopped at the gate before M2
(293 MB, no mutation applied); a memory-only watcher (ran nothing) reported
411 MB, and the single resume ran M2–M4 without repeating M1.

#### Known limitations

- An external client of `/api/stream`, if one exists, now receives 410; the
  replacement (`/api/chat` with `stream: true`) uses a different SSE event
  format (`meta` / `token` / `done` events rather than the old JSON chunks).
- No live request was made against the retired route; the 410 is proven by
  the source guard, types and suites, not by an HTTP call.
- No production build was run.

#### Not done

No commit, push, deploy, build, migration, or secret / OAuth change.
G-B2 … G-B7 and P2-H not started. `syraven-audit.zip` not opened, moved,
deleted or staged.

**RESULT (P2-G01 / G-B1):** implemented and verified — all steps PASS.
**Not committed**; awaiting founder instruction.

#### P2-G02 / P2-G03 — retire `/api/agents/execute` and `/api/action` (founder-approved 2026-09-15, G-B2)

| ID | Route | Evidence (file:line at `d10f0df`) | Consumers | Tests that pin it | Canonical replacement | Decision |
|---|---|---|---|---|---|---|
| P2-G02 | `POST /api/agents/execute` (484 lines) | A single chat completion with an agent-flavoured system message (header `:8-32`). Correct on the provider side (`resolveAiPolicy`, `chatCompletion` / `chatCompletionStream`, `enforceUsage`), but it accepts a client `systemPrompt` and places it in the SYSTEM message (`:53`, `:247-262`) with no context budget or untrusted-content fence — the protection `/api/chat` applies. Runs no tools; acting agent work is `/api/agents/run` (its own header says so) | **None** — mentions in `lib/ai/provider.ts:14,50`, `lib/orchestration/registry.ts:14`, `lib/usage/entitlements.ts:293` are comments | `ai-provider` (`MODEL_ACCEPTING`; policy-after-guard list), `usage-enforcement` (`METERED_ROUTES`), `api-auth-boundary` (`AI_SPENDING_ROUTES`: exists + `POST = withAuth(`), `middleware-gate` (protected list), `architecture-invariants` (comment only) | `/api/agents/run` (agents) and `/api/chat` (conversation) | RETIRE: `withAuth` 410 naming both |
| P2-G03 | `POST /api/action` (340 lines) + public `GET` | Classifies an action and never runs it: `"none"` → "nothing to do", a high-risk type → `pending_confirmation`, a registered low-risk type → 409 `not_executed`, anything else → "unsupported" (`:163-307`). It still calls `enforceUsage(…, "agentRun")` first (`:177-185`), so each call counts against the caller's agent-run quota for no work. Its risk logic is a second copy of the registry rule: the authority is `lib/orchestration/registry.ts` (`getTool` `:279`, `requiresHumanApproval` `:69`), applied by `planValidation.ts:295` and the orchestrator (`:428`, `:540`, `:604`). `GET` answers 405 and is listed as a public status probe in `middleware.ts` `PUBLIC_STATUS_GET_ROUTES` | **None** — `lib/orchestration/registry.ts:19` mention is a comment; `tests/e2e/seeded-journey.spec.ts:288` deliberately does not call it | `agent-orchestration` ("/api/action classifies risk server-side" `:860-899`; "the action route still enforces auth and usage" `:930-935`), `architecture-invariants` (`:327-332`, no execute / no "Done."), `middleware-gate` (`PUBLIC_STATUS_GET_ROUTES` mirror, must equal `middleware.ts`), `purification-authorities` (P2-F05: no `services/action-types` import) | `/api/agents/run` — plan validated against the registry, approvals claimed, tools executed | RETIRE: `withAuth` 410; drop the public GET |

**Pins reworked — only those that require the old implementations:**
- `ai-provider` `MODEL_ACCEPTING` and the policy-after-guard list:
  `/api/agents/execute` removed (it resolves no model and calls no provider).
- `usage-enforcement` `METERED_ROUTES`: `/api/agents/execute` removed (spends
  nothing).
- `agent-orchestration` "/api/action classifies risk server-side": replaced
  by "risk is classified in lib/orchestration, not in a route" — pins
  `requiresHumanApproval(risk)` in `planValidation.ts`,
  `requiresHumanApproval(step.risk)` in the orchestrator, and that the
  retired route carries no `getTool` / `requiresHumanApproval` copy.
- `agent-orchestration` "the action route still enforces auth and usage":
  becomes "the retired action route still requires a session" (no work, so
  no usage).
- `middleware.ts` `PUBLIC_STATUS_GET_ROUTES` and its mirror in
  `middleware-gate`: `/api/action` removed — a public exception for a GET
  the route no longer has (narrows the public surface); `/api/action` added
  to the protected list (anonymous GET/POST/PATCH/DELETE rejected).

**Unchanged:** `api-auth-boundary` (still pins `POST = withAuth(`),
`architecture-invariants` `:327-332` (the retired route still executes and
writes nothing), `purification-authorities` P2-F05 (still no
`services/action-types` import), the paid-call and metering sweeps.

**Retired-route guard:** `RETIRED_ROUTES` gains `/api/agents/execute` and
`/api/action` (session, 410, no work, no product caller).

**Mutations planned:** for each route — re-add work (provider call /
`enforceUsage`), 410 → 200, remove `withAuth`, add a product caller (in
`app/agents/[id]/page.tsx`); plus re-adding `/api/action` to
`middleware.ts` `PUBLIC_STATUS_GET_ROUTES` (the mirror must fail).

#### What changed (uncommitted at `d10f0df`)

- `app/api/agents/execute/route.ts` — implementation removed (404 → 39
  non-blank lines); now only `POST = withAuth(async () => …)` answering 410
  `ROUTE_RETIRED` "This endpoint is retired. Run agents through
  /api/agents/run; chat through /api/chat." The `OPTIONS` export is gone.
- `app/api/action/route.ts` — implementation removed (293 → 39 non-blank
  lines); now only `POST = withAuth(async () => …)` answering 410
  `ROUTE_RETIRED` "… Actions run through an agent at /api/agents/run, where
  each step is classified, approved and executed." The public `GET` is gone.
- `middleware.ts` — `/api/action` removed from `PUBLIC_STATUS_GET_ROUTES`
  (note in its place, no quoted path so the mirror parser ignores it).
- `tests/security/middleware-gate.test.ts` — mirror list matches;
  `/api/action` added to the protected-routes list.
- `tests/security/agent-orchestration.test.ts` — "/api/action classifies risk
  server-side" (4 tests) replaced by "Risk is classified in
  lib/orchestration, not in a route" (3 tests: `planValidation.ts`
  `requiresHumanApproval(risk)`, orchestrator `requiresHumanApproval(step.risk)`,
  no rule copy in the retired route); "the action route still enforces auth
  and usage" became "the retired action route still requires a session".
- `tests/security/ai-provider.test.ts`, `usage-enforcement.test.ts` —
  `/api/agents/execute` removed from `MODEL_ACCEPTING`, the policy-after-
  guard list and `METERED_ROUTES`, each with a note.
- `tests/security/purification-authorities.test.ts` — `RETIRED_ROUTES` gains
  both routes.
- Totals (`git diff --stat HEAD`): code, middleware and tests 8 files,
  +98 / −820; with this file 9 files, +139 / −821.

#### Verification (each step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 1 | Affected guard suites | `node --test --test-concurrency=1 …` `purification-authorities`, `ai-provider`, `usage-enforcement`, `agent-orchestration`, `middleware-gate`, `api-auth-boundary`, `architecture-invariants` | **PASS** — exit 0; 451 tests, 62 suites: 444 pass, 0 fail, 7 todo | 348 → 379 MB |
| 2 | Mutations | 9 mutations, below | **PASS** — 9 of 9 caught; every file restored to its original hash | 300 … 448 MB per mutation |
| 3 | Regression suites | `node --test --test-concurrency=1 …` `data-access`, `defect-remediation`, `memory-isolation`, `observability-redaction`, `api-reference-integrity` | **PASS** — exit 0; 157 tests, 31 suites: 157 pass, 0 fail | 526 → 513 MB |
| 4 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`) | **PASS** — exit 0, 0 `error TS` lines | 610 → 898 MB |
| 5 | Full suite | `npm run test:lowmem` | **PASS** — exit 0; 1,834 tests, 347 suites: 1,827 pass, 0 fail, 0 skipped, 7 todo (64.6 s) | 631 → 775 MB |
| 6 | Lint | `npx eslint` on the two routes, `middleware.ts` and the five changed test files (`--max-old-space-size=768`) | **PASS** — exit 0, 0 errors, 0 warnings | 650 → 866 MB |

**Test-count delta accounted:** 1,834 vs 1,829 (after G-B1) = +6 retired-
route tests (3 × 2 routes), −2 (`ai-provider` `MODEL_ACCEPTING`, 2 per
route), −2 (`usage-enforcement` `METERED_ROUTES`, 2 per route), −1
(`agent-orchestration` describe 4 → 3 tests), +4 (`middleware-gate`
protected list, 4 methods for `/api/action`). Suites unchanged (347): the
replaced `describe` is one-for-one. The 7 todos are the documented
limitations; "failing tests:" in steps 1 and 5 lists only those.

#### Mutation testing

Each mutation re-created one defect, ran the guard that owns it, and
restored the original bytes in a `finally` block; the four files were
backed up to the scratchpad first. SHA-256, first 12 hex.

| # | Defect re-created | File | Result | Hash before = after |
|---|---|---|---|---|
| M1 | Provider call re-added (`await chatCompletion(…)`) | `app/api/agents/execute/route.ts` | **Caught** — `purification-authorities` 38 / 1: "/api/agents/execute reads, writes and spends nothing" | `0065D1D8770E` ✔ |
| M2 | 410 → 200 | same | **Caught** — 38 / 1: "/api/agents/execute requires a session and answers 410" | `0065D1D8770E` ✔ |
| M3 | `withAuth` removed | same | **Caught** — `purification-authorities` 38 / 1; `api-auth-boundary` 135 / 1: "app/api/agents/execute/route.ts exists and wraps POST in withAuth" | `0065D1D8770E` ✔ |
| M4 | Product caller added (`fetch("/api/agents/execute", …)`) | `app/agents/[id]/page.tsx` | **Caught** — 38 / 1: "nothing in the product calls /api/agents/execute" | `C6CA8EF1DE43` ✔ |
| M5 | Usage enforcement re-added (`await enforceUsage(…, "agentRun")`) | `app/api/action/route.ts` | **Caught** — 38 / 1: "/api/action reads, writes and spends nothing" | `219BBF36CEE1` ✔ |
| M6 | 410 → 200 | same | **Caught** — 38 / 1: "/api/action requires a session and answers 410" | `219BBF36CEE1` ✔ |
| M7 | `withAuth` removed | same | **Caught** — `purification-authorities` 38 / 1; `agent-orchestration` 54 / 1: "the retired action route still requires a session" | `219BBF36CEE1` ✔ |
| M8 | Product caller added (`fetch("/api/action", …)`) | `app/agents/[id]/page.tsx` | **Caught** — 38 / 1: "nothing in the product calls /api/action" | `C6CA8EF1DE43` ✔ |
| M9 | `/api/action` re-added to `PUBLIC_STATUS_GET_ROUTES` | `middleware.ts` | **Caught** — `middleware-gate` 78 / 1: "the public status GET list matches" | `35F4E375A938` ✔ |

`git status --short` identical before and after; `syraven-audit.zip` size
and timestamp unchanged. **Memory:** all nine ran in one pass; M9 started
at exactly 300 MB (gate: ≥ 300). Free memory then fell to 273 MB, below the
gate, so steps 3–6 waited for a memory-only watcher (ran nothing; reported
355 MB) before step 3 launched.

#### Known limitations

- An external client of either route, if one exists, now receives 410;
  `/api/agents/run` has a different request contract (a registered agent
  and a goal, not an action object or a free system prompt).
- `architecture-invariants` "/api/action classifies; it neither runs work
  nor claims it ran" still passes (the retired route runs and writes
  nothing); its title now describes history.
- Comments in `lib/ai/provider.ts`, `lib/orchestration/registry.ts` and
  `lib/usage/entitlements.ts` still describe the old routes — P2-H.
- No live request against the retired routes; no production build.

#### Not done

No commit, push, deploy, build, migration, or secret / OAuth change.
G-B3 … G-B7 and P2-H not started. `syraven-audit.zip` not opened, moved,
deleted or staged.

**RESULT (P2-G02 / P2-G03 / G-B2):** implemented and verified — all steps
PASS. **Not committed**; awaiting founder instruction.

### Later groups

Recorded as each batch is prepared: remaining P2-G batches (G-B3 … G-B7),
documentation (P2-H).
