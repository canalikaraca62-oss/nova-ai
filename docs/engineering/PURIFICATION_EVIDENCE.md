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

#### P2-G04 — retire `/api/knowledge/search` (founder-approved 2026-09-15, G-B3)

| ID | Route | Evidence (file:line at `a8f3adb`) | Consumers | Tests that pin it | Canonical replacement | Decision |
|---|---|---|---|---|---|---|
| P2-G04 | `GET` / `POST /api/knowledge/search` (1,180 lines; `PUT` / `PATCH` / `DELETE` answer 405) | A second keyword search over `public.knowledge`, beside the canonical `/api/search` (`lib/search/query.ts`), which the `/search` page uses and which carries its own knowledge allowlist (`searchableStatuses` `["draft", "ready", "active"]`). Since P2-F07 this route filters on `RETRIEVABLE_STATUSES` = `["active"]` (`route.ts:719-730`), and production rows are written `ready`, so for real data it returns an empty list — a working-looking endpoint that finds nothing. It was never AI context itself: chat and orchestration read knowledge through `lib/memory/retrieval.ts` | **None** — the only mention outside `app/api`, `lib/memory/hierarchy.ts:107`, is a comment | `data-access` (`MIGRATED`: uses `session.supabase`, no `supabaseAdmin`), `authorization-boundary` (`TENANT_FILTERING_ROUTES`: tenant guard before the query), `defect-remediation` D2 (no phantom columns; every selected column exists; caller's client; tenant guards), `memory-isolation` ("the search route filters status at the query level" — the P2-F07 pin), `middleware-gate` (protected list) | `/api/search` (`lib/search/query.ts`) | RETIRE: `withAuth` 410 on `GET` and `POST` naming `/api/search` |

**Pins reworked — only those that require the search implementation:**
- `data-access` `MIGRATED` and `authorization-boundary`
  `TENANT_FILTERING_ROUTES`: the route removed (it runs no query and filters
  nothing), each with a note.
- `defect-remediation` D2 (4 tests on the query's columns and guards):
  replaced by one test — the retired route queries nothing, so the phantom-
  column 500 cannot return.
- `memory-isolation` "the search route filters status at the query level":
  becomes "the retired knowledge search route queries nothing" — the status
  rule's only live reader is `lib/memory/retrieval.ts`, whose own pins
  (`.in("status", [...RETRIEVABLE_STATUSES])`, no literal status filter)
  are unchanged.
- `lib/memory/hierarchy.ts` comment "THE ONE COPY" names this route as a
  reader of the constant — corrected to say it is retired (comment only; the
  pinned value `["active"]` is untouched).

**Unchanged:** `middleware-gate` (still protected), the retrieval and
hierarchy invariants, `/api/search` and its `search-isolation` suite.

**Retired-route guard:** `RETIRED_ROUTES` gains `/api/knowledge/search`.

**Mutations planned:** M1 re-add a database read (`.from("knowledge")`)
— must fail the retired-route guard and the reworked `memory-isolation`
test; M2 410 → 200; M3 remove `withAuth`; M4 point the `/search` page at
`/api/knowledge/search`.

#### What changed (uncommitted at `a8f3adb`)

- `app/api/knowledge/search/route.ts` — implementation removed (1,180 lines,
  1,008 non-blank → 55 lines, 44 non-blank). `GET` and `POST` are each
  `withAuth(async () => retired())`, answering 410 `ROUTE_RETIRED` "This
  endpoint is retired. Search knowledge through /api/search." The 405
  `PUT` / `PATCH` / `DELETE` exports are gone.
- `lib/memory/hierarchy.ts` — comment only: "THE ONE COPY" now says
  retrieval is the constant's only query reader (the route is retired).
  `RETRIEVABLE_STATUSES = ["active"]` unchanged.
- `tests/security/data-access.test.ts`, `authorization-boundary.test.ts` —
  the route removed from `MIGRATED` and `TENANT_FILTERING_ROUTES`, each with
  a note.
- `tests/security/defect-remediation.test.ts` — D2 (4 tests on the query's
  columns, client and guards) replaced by "D2: /api/knowledge/search can no
  longer 500 on phantom columns" (1 test: no `.select(` / `.from(` / `.rpc(`,
  phantom column names or `supabaseAdmin`; answers 410).
- `tests/security/memory-isolation.test.ts` — "the search route filters
  status at the query level" became "the retired knowledge search route
  queries nothing" (no `.from(` / `.rpc(`; answers 410).
- `tests/security/purification-authorities.test.ts` — `RETIRED_ROUTES` gains
  `/api/knowledge/search`.
- Totals (`git diff --stat HEAD`): code, lib and tests 7 files,
  +72 / −1,221; with this file 8 files, +107 / −1,222.

#### Verification (each step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 1 | Affected guard suites | `node --test --test-concurrency=1 …` `purification-authorities`, `data-access`, `authorization-boundary`, `defect-remediation`, `memory-isolation`, `middleware-gate`, `search-isolation` | **PASS** — exit 0; 288 tests, 49 suites: 288 pass, 0 fail | 348 → 461 MB |
| 2 | Mutations | 4 mutations, below | **PASS** — 4 of 4 caught; both files restored to their original hash | 445 … 497 MB per mutation |
| 3 | Regression suites | `node --test --test-concurrency=1 …` `api-auth-boundary`, `architecture-invariants`, `api-reference-integrity`, `usage-enforcement`, `ai-provider`, `observability-redaction` | **PASS** — exit 0; 329 tests, 48 suites: 322 pass, 0 fail, 7 todo | 444 → 434 MB |
| 4 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`) | **PASS** — exit 0, 0 `error TS` lines | 352 → 795 MB |
| 5 | Full suite | `npm run test:lowmem` | **PASS** — exit 0; 1,827 tests, 347 suites: 1,820 pass, 0 fail, 0 skipped, 7 todo (44.1 s) | 681 → 530 MB |
| 6 | Lint | `npx eslint` on the route, `lib/memory/hierarchy.ts` and the five changed test files (`--max-old-space-size=768`) | **PASS** — exit 0, 0 errors, 0 warnings | 588 → 858 MB |

**Test-count delta accounted:** 1,827 vs 1,834 (after G-B2) = +3 (retired-
route guard, 3 per route), −2 (`data-access` `MIGRATED`, 2 per route), −2
(`authorization-boundary` `TENANT_FILTERING_ROUTES`, 2 per route), −3
(`defect-remediation` D2, 4 → 1), −3 (`api-auth-boundary` generates one
"<METHOD> is authenticated" test per exported mutating method: the old
route exported `POST` + plain `PUT` / `PATCH` / `DELETE`, the retired one
only `POST`), 0 (`memory-isolation` test replaced one-for-one). Suites
unchanged (347). The 7 todos are the documented limitations.

#### Mutation testing

Each mutation re-created one defect, ran the guards that own it, and
restored the original bytes in a `finally` block; both files were backed up
to the scratchpad first. SHA-256, first 12 hex.

| # | Defect re-created | File | Result | Hash before = after |
|---|---|---|---|---|
| M1 | Database read re-added (`await session.supabase.from("knowledge").select("id")`) | `app/api/knowledge/search/route.ts` | **Caught** by three guards — `purification-authorities` 41 / 1: "/api/knowledge/search reads, writes and spends nothing"; `memory-isolation` 54 / 1: "the retired knowledge search route queries nothing"; `defect-remediation` 20 / 1: "the retired route queries nothing" | `84D98F3C25B3` ✔ |
| M2 | 410 → 200 | same | **Caught** by three — `purification-authorities` 41 / 1: "requires a session and answers 410"; `memory-isolation` 54 / 1; `defect-remediation` 20 / 1 | `84D98F3C25B3` ✔ |
| M3 | `withAuth` removed from `POST` (`export const POST = (async () => …)`) | same | **Caught** by `purification-authorities` 41 / 1: "requires a session and answers 410". **Not caught** by `api-auth-boundary` (133 / 0) — see finding below | `84D98F3C25B3` ✔ |
| M4 | The `/search` page pointed at `/api/knowledge/search` | `app/search/page.tsx` | **Caught** — 41 / 1: "nothing in the product calls /api/knowledge/search" | `5BDA196C0467` ✔ |

`git status --short` identical before and after; `syraven-audit.zip` size
and timestamp unchanged. All four ran in one pass; no memory-gate block in
this batch.

**Finding (M3) — `api-auth-boundary` per-method sweep has a blind shape.**
It generates "<route> <METHOD> is authenticated" only for handlers written
as `export const METHOD = withAuth(` or `export (async) function
METHOD(` (`api-auth-boundary.test.ts:168-177`). A handler written as
`export const POST = (async () => …)` matches neither and is skipped
(`continue`), so an unwrapped arrow-function handler anywhere under
`app/api` produces no test and no failure. For this route the gap is
covered twice — the retired-route guard caught M3, and `middleware.ts`
rejects anonymous `/api/*` requests — but the sweep itself should fail on
an exported handler it cannot classify. **Not fixed here** (outside G-B3's
approved scope); recorded for a separate, founder-approved guard fix.

#### Known limitations

- An external client of `/api/knowledge/search`, if one exists, now receives
  410; `/api/search` takes `q` / `entities` query parameters rather than this
  route's body and scope options.
- The `api-auth-boundary` blind shape above stands until fixed.
- No live request against the retired route; no production build.

#### Not done

No commit, push, deploy, build, migration, or secret / OAuth change.
G-B4 … G-B7 and P2-H not started. `syraven-audit.zip` not opened, moved,
deleted or staged.

**RESULT (P2-G04 / G-B3):** implemented and verified — all steps PASS,
with one guard-coverage finding recorded. **Not committed**; awaiting
founder instruction.

#### P2-G06 — retire `/api/files/upload` (founder decision 2026-09-15: "Retire to 410", G-B4)

| ID | Route | Evidence (file:line at `ff92238`) | Consumers | Tests that pin it | Canonical replacement | Decision |
|---|---|---|---|---|---|---|
| P2-G06 | `POST /api/files/upload` (562 lines; `GET` answers 405) | Writes up to 50 MB per request (`MAX_FILE_SIZE`, `:23`) to the `files` storage bucket through `supabaseAdmin` (`:13`, `:437-448`), with a signed URL (`:478-485`). No usage metering and no rate limit: `enforceUsage` / `checkRateLimit` are never called, although `lib/usage/meter.ts` declares both a `fileUpload` metric and a `"files:upload"` rate rule (`:439`) for exactly this. Any signed-in account can fill storage at the operator's cost. Last changed `3f62f71` (P2-E06, the id fix) | **None** — no reference to `/api/files/upload` or to storage uploads anywhere in `app/` or `lib/` outside `app/api` | `data-access` (`ELEVATED_ALLOWLIST` entry, and "every allowlisted route still actually uses it"), `middleware-gate` (protected list) | None needed today; an upload surface, when one exists, is built metered and rate limited | RETIRE: `withAuth` 410; no storage write, no service-role client |

**Changes that follow from the retirement:**
- `data-access` `ELEVATED_ALLOWLIST`: the `app/api/files/upload/route.ts`
  entry removed — the retired route no longer uses `supabaseAdmin`, and the
  suite's own "every allowlisted route still actually uses it" test requires
  stale permissions to be removed. One fewer service-role route (4 → 3).
- `lib/usage/meter.ts` `RATE_LIMITS`: the `"files:upload"` rule removed — it
  existed only for this route, which never called it; no code or test
  references it (searched `app/`, `lib/`, `tests/`).
- **Kept:** `USAGE_METRICS.fileUpload` — plans define `fileUploadsPerDay`
  and `/api/usage` reports it; it is not dead.

**Unchanged:** `middleware-gate` (path stays protected), every other
allowlist entry and test.

**Retired-route guard:** `RETIRED_ROUTES` gains `/api/files/upload`.

**Mutations planned:** M1 re-add the service-role storage write — must fail
the retired-route guard and `data-access` "no route outside the allowlist
uses supabaseAdmin"; M2 410 → 200; M3 remove `withAuth`; M4 add a product
caller of `/api/files/upload`; M5 re-add the upload entry to
`ELEVATED_ALLOWLIST` — "every allowlisted route still actually uses it" must
fail.

#### What changed (uncommitted at `ff92238`)

- `app/api/files/upload/route.ts` — implementation removed (562 lines, 482
  non-blank → 44 lines, 35 non-blank). Only `POST = withAuth(async () => …)`
  remains, answering 410 `ROUTE_RETIRED` "This endpoint is retired. File
  upload is not available." No `supabaseAdmin`, no storage call; the 405
  `GET` export is gone.
- `tests/security/data-access.test.ts` — `ELEVATED_ALLOWLIST` entry for the
  route removed, with a note (4 → 3 service-role routes).
- `lib/usage/meter.ts` — the unused `"files:upload"` rule removed from
  `RATE_LIMITS`, with a note. `USAGE_METRICS.fileUpload` kept.
- `tests/security/purification-authorities.test.ts` — `RETIRED_ROUTES` gains
  `/api/files/upload`.
- Leftover sweep: `files:upload`, `supabaseAdmin.storage`, `STORAGE_BUCKET`
  appear nowhere in `app/`, `lib/`, `tests/`, `middleware.ts` except the
  explanatory comment in `meter.ts`.
- Totals (`git diff --stat HEAD`): code, lib and tests 4 files,
  +38 / −549; with this file 5 files, +70 / −550.

#### Verification (each step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 1 | Affected guard suites | `node --test --test-concurrency=1 …` `purification-authorities`, `data-access`, `middleware-gate`, `api-auth-boundary`, `usage-enforcement`, `ingest-cost-control`, `brain-semantic-bridge` | **PASS** — exit 0; 397 tests, 46 suites: 397 pass, 0 fail. First launch refused at the gate (283 MB) | 474 → 395 MB |
| 2 | Mutations | 5 mutations, below | **PASS** — 5 of 5 caught; every file restored to its original hash | 333 … 457 MB per mutation |
| 3 | Regression suites | `node --test --test-concurrency=1 …` `architecture-invariants`, `api-reference-integrity`, `ai-provider`, `observability-redaction`, `authorization-boundary`, `search-isolation` | **PASS** — exit 0; 214 tests, 48 suites: 207 pass, 0 fail, 7 todo | 327 → 381 MB |
| 4 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`) | **PASS** — exit 0, 0 `error TS` lines | 548 → 818 MB |
| 5 | Full suite | `npm run test:lowmem` | **PASS** — exit 0; 1,830 tests, 347 suites: 1,823 pass, 0 fail, 0 skipped, 7 todo (74.1 s) | 584 → 525 MB |
| 6 | Lint | `npx eslint app/api/files/upload/route.ts lib/usage/meter.ts tests/security/data-access.test.ts tests/security/purification-authorities.test.ts` (`--max-old-space-size=768`) | **PASS** — exit 0, 0 errors, 0 warnings | 607 → 1,026 MB |

**Test-count delta accounted:** 1,830 vs 1,827 (after G-B3) = +3 retired-
route tests for `/api/files/upload`. The `data-access` allowlist tests
iterate the list inside single tests, so removing an entry changes no count;
`api-auth-boundary` still generates one `POST` test for the route (the old
`GET` was not a mutating method). Suites unchanged (347). The 7 todos are
the documented limitations.

#### Mutation testing

Each mutation re-created one defect, ran the guards that own it, and
restored the original bytes in a `finally` block; the three files were
backed up to the scratchpad first. SHA-256, first 12 hex.

| # | Defect re-created | File | Result | Hash before = after |
|---|---|---|---|---|
| M1 | Service-role storage write re-added (`await supabaseAdmin.storage.from("files").upload(…)`) | `app/api/files/upload/route.ts` | **Caught** by two guards — `purification-authorities` 44 / 1: "/api/files/upload reads, writes and spends nothing"; `data-access` 21 / 1: "no route outside the allowlist uses supabaseAdmin" | `F98C4F3B85AA` ✔ |
| M2 | 410 → 200 | same | **Caught** — 44 / 1: "/api/files/upload requires a session and answers 410" | `F98C4F3B85AA` ✔ |
| M3 | `withAuth` removed | same | **Caught** — 44 / 1: "requires a session and answers 410" | `F98C4F3B85AA` ✔ |
| M4 | Product caller added (the `/search` page pointed at `/api/files/upload`) | `app/search/page.tsx` | **Caught** — 44 / 1: "nothing in the product calls /api/files/upload" | `5BDA196C0467` ✔ |
| M5 | Upload entry re-added to `ELEVATED_ALLOWLIST` | `tests/security/data-access.test.ts` | **Caught** — `data-access` 20 / 2: "every allowlisted route still actually uses it", "each elevated route documents the reason at the call site" | `74982C0FB564` ✔ |

`git status --short` identical before and after; `syraven-audit.zip` size
and timestamp unchanged. **Memory:** the first step 1 launch was refused at
the gate (283 MB, nothing started); a memory-only watcher (ran nothing)
reported 459 MB, and every later step and mutation ran at ≥ 300 MB.

#### Known limitations

- An external client of `/api/files/upload`, if one exists, now receives
  410; there is no replacement upload route.
- M3 is caught by the retired-route guard only; the `api-auth-boundary`
  blind shape recorded in G-B3 still stands.
- The `files` storage bucket and any objects already in it are untouched
  (no storage or database change was made).
- No live request against the retired route; no production build.

#### Not done

No commit, push, deploy, build, migration, storage, or secret / OAuth
change. G-B5 … G-B7 and P2-H not started. `syraven-audit.zip` not opened,
moved, deleted or staged.

**RESULT (P2-G06 / G-B4):** implemented and verified — all steps PASS.
**Not committed**; awaiting founder instruction.

#### P2-G05 — retire `/api/files/analyze` (founder decision 2026-09-15: "Retire to 410", G-B5)

| ID | Route | Evidence (file:line at `1656629`) | Consumers | Tests that pin it | Canonical replacement | Decision |
|---|---|---|---|---|---|---|
| P2-G05 | `POST /api/files/analyze` (1,115 lines) + public `GET` status | The provider logic P2-F08 removed from `/api/chat`, still live here: `body.provider` (`:48-51`), env default models `OPENAI_MODEL` / `GROQ_MODEL` (`:101-107`), its own `getProvider` / `getFallbackProvider` with direct `process.env.*_API_KEY` reads and hardcoded vendor URLs (`:238-352`), a fallback on any failed status (`:874-896`), and a `GET` that reads the keys directly (`:1085`). It also echoes a client `workspaceId` / `projectId` it never proves (`architecture-invariants` `ECHO_ONLY`, the suite's only exception). Its `GET` is exempt from the session gate in `middleware.ts` `PUBLIC_STATUS_GET_ROUTES`. Last changed `7dae7e9` (2026-09-07) | **None** — no reference outside `app/api` except `middleware.ts` (the public-GET list) | `ai-provider` (`MODEL_ACCEPTING`; policy-after-guard list), `usage-enforcement` (`METERED_ROUTES`), `api-auth-boundary` (`AI_SPENDING_ROUTES`: exists + `POST = withAuth(`), `architecture-invariants` (`ECHO_ONLY`; "every route taking a tenant id proves access to it" requires the unguarded set to equal `ECHO_ONLY`), `observability-redaction` ("files/analyze no longer logs analysis content verbatim" `:506`; "files/analyze truncates the provider error body" `:532`; provider-body sweep `:552`), `middleware-gate` (`PUBLIC_STATUS_GET_ROUTES` mirror) | None needed today; file analysis, when a surface needs it, is built on `/api/chat`'s registry path | RETIRE: `withAuth` 410; drop the public GET |

**Pins reworked — only those that require the old implementation:**
- `ai-provider` `MODEL_ACCEPTING` and the policy-after-guard list;
  `usage-enforcement` `METERED_ROUTES`: the route removed, each with a note.
- `architecture-invariants` `ECHO_ONLY`: the entry removed — the retired
  route reads no tenant id, and the suite requires the unguarded set to
  equal `ECHO_ONLY` exactly. `ECHO_ONLY` becomes empty: every route that
  takes a tenant id now proves access, with no exceptions. The companion
  "an unguarded echo cannot reach data" then iterates nothing (kept, so a
  future exception is still checked).
- `observability-redaction` `:506` and `:532`: replaced one-for-one by "the
  retired files/analyze route logs no document content" and "… logs no
  provider body" (no `console.*`, no `errorText`, no provider call).
- `middleware.ts` `PUBLIC_STATUS_GET_ROUTES` and its `middleware-gate`
  mirror: `/api/files/analyze` removed (a public exception for a GET that no
  longer exists); the path added to the protected list.

**Unchanged:** `api-auth-boundary` (still pins `POST = withAuth(`),
`observability-redaction` `:210` (tests `sanitizeFields`, not the route) and
the provider-body sweep list (a file with no provider body passes), the
paid-call and metering sweeps.

**Retired-route guard:** `RETIRED_ROUTES` gains `/api/files/analyze`.

**Mutations planned:** M1 re-add a provider call (`fetch` to a vendor URL);
M2 410 → 200; M3 remove `withAuth`; M4 add a product caller; M5 re-add
`/api/files/analyze` to `middleware.ts` `PUBLIC_STATUS_GET_ROUTES` (the
mirror must fail); M6 re-add an unproven `body.workspaceId` read to the
route — "every route taking a tenant id proves access to it" must fail now
that `ECHO_ONLY` is empty.

#### What changed (uncommitted at `1656629`)

- `app/api/files/analyze/route.ts` — implementation removed (1,115 lines, 939
  non-blank → 47 lines, 38 non-blank). Only `POST = withAuth(async () => …)`
  remains, answering 410 `ROUTE_RETIRED` "This endpoint is retired. File
  analysis is not available." No provider call, env read, logging or tenant
  id; the public `GET` is gone.
- `middleware.ts` — `/api/files/analyze` removed from
  `PUBLIC_STATUS_GET_ROUTES` (note in its place, no quoted path). The list
  is now `/api/chat`, `/api/canvas`, `/api/voice/speak`.
- `tests/security/middleware-gate.test.ts` — mirror list matches;
  `/api/files/analyze` added to the protected-routes list.
- `tests/security/architecture-invariants.test.ts` — `ECHO_ONLY` is empty
  (note in its place).
- `tests/security/ai-provider.test.ts`, `usage-enforcement.test.ts` — the
  route removed from `MODEL_ACCEPTING`, the policy-after-guard list and
  `METERED_ROUTES`, each with a note.
- `tests/security/observability-redaction.test.ts` — the two log-site pins
  replaced one-for-one by "the retired files/analyze route logs no document
  content" and "… logs no provider body".
- `tests/security/purification-authorities.test.ts` — `RETIRED_ROUTES` gains
  `/api/files/analyze`.
- Leftover sweep: `/api/files/analyze` appears in `app/`, `lib/` and
  `middleware.ts` only in the retired route's own header;
  `OPENAI_MODEL` / `GROQ_MODEL` remain only in the `lib/ai/registry.ts:19`
  comment (P2-H) and `app/api/agents/route.ts:700` (G-B7).
- Totals (`git diff --stat HEAD`): code, middleware and tests 8 files,
  +67 / −1,129; with this file 9 files, +106 / −1,130.

#### Verification (each step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 1 | Affected guard suites | `node --test --test-concurrency=1 …` `purification-authorities`, `ai-provider`, `usage-enforcement`, `api-auth-boundary`, `architecture-invariants`, `observability-redaction`, `middleware-gate` | **PASS** — exit 0; 440 tests, 60 suites: 433 pass, 0 fail, 7 todo. First launch refused at the gate (295 MB) | 461 → 487 MB |
| 2 | Mutations | 6 mutations, below | **PASS** — 6 of 6 caught; every file restored to its original hash | 486 … 585 MB per mutation |
| 3 | Regression suites | `node --test --test-concurrency=1 …` `data-access`, `api-reference-integrity`, `authorization-boundary`, `defect-remediation`, `memory-isolation`, `search-isolation` | **PASS** — exit 0; 183 tests, 37 suites: 183 pass, 0 fail | 441 → 403 MB |
| 4 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`) | **PASS** — exit 0, 0 `error TS` lines | 418 → 601 MB |
| 5 | Full suite | `npm run test:lowmem` | **PASS** — exit 0; 1,833 tests, 347 suites: 1,826 pass, 0 fail, 0 skipped, 7 todo (29.6 s) | 453 → 397 MB |
| 6 | Lint | `npx eslint` on the route, `middleware.ts` and the six changed test files (`--max-old-space-size=768`) | **PASS** — exit 0, 0 errors, 0 warnings | 335 → 890 MB |

**Test-count delta accounted:** 1,833 vs 1,830 (after G-B4) = +3 (retired-
route guard, 3 per route), −2 (`ai-provider` `MODEL_ACCEPTING`, 2 per
route), −2 (`usage-enforcement` `METERED_ROUTES`, 2 per route), +4
(`middleware-gate` protected list, 4 methods), 0 (`observability-redaction`
two tests replaced one-for-one; `ECHO_ONLY` tests iterate inside single
tests; `api-auth-boundary` still generates one `POST` test). Suites
unchanged (347). The 7 todos are the documented limitations; "failing
tests:" in steps 1 and 5 lists only those.

#### Mutation testing

Each mutation re-created one defect, ran the guards that own it, and
restored the original bytes in a `finally` block; the three files were
backed up to the scratchpad first. SHA-256, first 12 hex.

| # | Defect re-created | File | Result | Hash before = after |
|---|---|---|---|---|
| M1 | Provider call re-added (`await fetch("https://api.openai.com/…")`) | `app/api/files/analyze/route.ts` | **Caught** by two guards — `purification-authorities` 47 / 1: "/api/files/analyze reads, writes and spends nothing"; `observability-redaction` 37 / 1: "the retired files/analyze route logs no provider body" | `0C6A5EDA6764` ✔ |
| M2 | 410 → 200 | same | **Caught** — 47 / 1: "/api/files/analyze requires a session and answers 410" | `0C6A5EDA6764` ✔ |
| M3 | `withAuth` removed | same | **Caught** by two — `purification-authorities` 47 / 1; `api-auth-boundary` 132 / 1: "app/api/files/analyze/route.ts exists and wraps POST in withAuth" | `0C6A5EDA6764` ✔ |
| M4 | Product caller added (the `/search` page pointed at `/api/files/analyze`) | `app/search/page.tsx` | **Caught** — 47 / 1: "nothing in the product calls /api/files/analyze" | `5BDA196C0467` ✔ |
| M5 | `/api/files/analyze` re-added to `PUBLIC_STATUS_GET_ROUTES` (1 target occurrence) | `middleware.ts` | **Caught** — `middleware-gate` 82 / 1: "the public status GET list matches" | `71E606F5AA1E` ✔ |
| M6 | Unproven `body.workspaceId` read re-added | `app/api/files/analyze/route.ts` | **Caught** — `architecture-invariants` 44 / 1: "every route taking a tenant id proves access to it" (now enforcing zero exceptions) | `0C6A5EDA6764` ✔ |

`git status --short` identical before and after; `syraven-audit.zip` size
and timestamp unchanged. **Memory:** the first step 1 launch was refused at
the gate (295 MB, nothing started); a memory-only watcher (ran nothing)
reported 529 MB, and every later step and mutation ran at ≥ 300 MB.

#### Known limitations

- An external client of `/api/files/analyze`, if one exists, now receives
  410; there is no replacement file-analysis route.
- `architecture-invariants` "an unguarded echo cannot reach data" iterates
  an empty `ECHO_ONLY` and so checks nothing until an exception is added;
  kept deliberately.
- The `api-auth-boundary` blind shape recorded in G-B3 still stands (here
  M3 was also caught by `AI_SPENDING_ROUTES`, which pins `POST =
  withAuth(` directly).
- No live request against the retired route; no production build.

#### Not done

No commit, push, deploy, build, migration, or secret / OAuth change.
G-B6, G-B7 and P2-H not started. `syraven-audit.zip` not opened, moved,
deleted or staged.

**RESULT (P2-G05 / G-B5):** implemented and verified — all steps PASS.
**Not committed**; awaiting founder instruction.

#### P2-G07 — consolidate the voice routes onto the registry (founder decision 2026-09-15: "Consolidate onto the registry", G-B6)

| ID | Route | Duplicate and its drift (file:line at `6d67a48`) | Consumers | Tests that pin it | Canonical owner | Decision |
|---|---|---|---|---|---|---|
| P2-G07a | `POST /api/voice/transcribe` | Chooses its model from its own `ALLOWED_MODELS` (`:46-50`) — including `gpt-4o-transcribe`, which is **not in the registry** — with no plan check, and silently substitutes `gpt-4o-mini-transcribe` for anything it does not recognise (`getRequestedModel`, `:160-175`). Reads `process.env.OPENAI_API_KEY` directly (`:338-339`) and posts to a hardcoded URL (`OPENAI_TRANSCRIPT_URL`, `:14-15`) | None in the product (the `/apps` voice card says "Coming soon") | `usage-enforcement` (metered), `api-auth-boundary` (AI-spending), `middleware-gate` (protected), `purification-authorities` P2-F09 (error mapping) | `lib/ai/registry.ts` — `selectModel(…, "transcription", plan)` (`whisper-1`, `gpt-4o-mini-transcribe`), `providerApiKey`, `PROVIDER_ENDPOINTS` | CONSOLIDATE |
| P2-G07b | `POST` / `GET /api/voice/speak` | Already validates the model with `selectModel(…, "speech", effectivePlan)` (`:423-441`), but its default is env `OPENAI_TTS_MODEL` (`:31-33`, also reported by the public `GET`, `:247-248`); reads `process.env.OPENAI_API_KEY` directly in `GET` (`:238`) and `POST` (`:298-299`); posts to a hardcoded URL (`OPENAI_TTS_URL`, `:28-29`) | None in the product; `GET` is a public status probe (`middleware.ts`) | `ai-provider` (`MODEL_ACCEPTING`: model resolved + denial returned), `usage-enforcement`, `api-auth-boundary`, `middleware-gate` (public status GET), `purification-authorities` P2-F09 | Same — `selectModel(…, "speech", plan)` (`gpt-4o-mini-tts`) | CONSOLIDATE |

**Plan (as approved):**
1. Transcribe: delete `ALLOWED_MODELS`, `getRequestedModel` and
   `OPENAI_TRANSCRIPT_URL`. The model is `selectModel(requested,
   "transcription", guard.entitlement.effectivePlan)`; an unknown or
   plan-excluded model answers 400 instead of being silently replaced. The
   key is `providerApiKey(model.provider)` (503 "Voice transcription is not
   configured." when absent); the URL is
   `PROVIDER_ENDPOINTS[model.provider].baseUrl + "/audio/transcriptions"`.
2. Speak: delete the env default and `OPENAI_TTS_URL`. The default is the
   registry's (`selectModel(null, "speech", …)`); key and URL from the
   registry in `POST`; the public `GET` reports configuration and the
   default model from the registry (no `process.env`).
3. Unchanged: auth, usage enforcement and order, `guard.record`, file / text
   validation, the P2-F09 error mapping, timeouts, success response shapes,
   the public status `GET` exemption for speak.

**Behaviour changes, recorded:** transcribe's default model becomes the
registry default, `whisper-1` (was `gpt-4o-mini-transcribe`); a request
naming `gpt-4o-transcribe` or any unregistered model now answers 400 (it
was silently served by the default); a deployment that set
`OPENAI_TTS_MODEL` no longer changes speak's default. Neither route has a
product caller.

**Guards planned:** a P2-G07 block in `purification-authorities` for both
routes — no `process.env`, no hardcoded vendor URL, key from
`providerApiKey(<model>.provider)`, URL from `PROVIDER_ENDPOINTS[…]`,
plan-aware `selectModel` for the right capability; transcribe keeps no
private model list and no `gpt-4o-transcribe`. `ai-provider`
`MODEL_ACCEPTING` gains transcribe (it now resolves a model and must return
the denial).

**Mutations planned:** transcribe — hardcoded URL; direct key read; plan
check dropped (`"enterprise"`); unregistered model re-added; denial not
returned. Speak — env default model; hardcoded URL; direct key read in
`GET`.

#### What changed (uncommitted at `6d67a48`)

- `app/api/voice/transcribe/route.ts` — `ALLOWED_MODELS`, `getRequestedModel`,
  `OPENAI_TRANSCRIPT_URL` and the early `process.env.OPENAI_API_KEY` read
  deleted. The model is `selectModel(requestedModel, "transcription",
  guard.entitlement.effectivePlan)` (refusal → 400 "The requested
  transcription model is not available."); the key is
  `providerApiKey(transcriptionModel.model.provider)` (absent → 503 "Voice
  transcription is not configured."); `requestTranscription` takes the
  registry URL
  `PROVIDER_ENDPOINTS[transcriptionModel.model.provider].baseUrl +
  "/audio/transcriptions"`.
- `app/api/voice/speak/route.ts` — `OPENAI_TTS_URL`, the env
  `OPENAI_TTS_MODEL` default and the early key read deleted. `POST` keeps
  `selectModel(requestedModel, "speech", guard.entitlement.effectivePlan)`,
  then reads the key with `providerApiKey(speechModel.model.provider)`
  (absent → the same 503 as before) and posts to
  `PROVIDER_ENDPOINTS[…].baseUrl + "/audio/speech"`. The public `GET` reports
  `configured`, `provider` and `model` from `selectModel(null, "speech",
  "free")` and `providerApiKey`.
- `tests/security/ai-provider.test.ts` — `MODEL_ACCEPTING` gains
  `app/api/voice/transcribe/route.ts`.
- `tests/security/purification-authorities.test.ts` — P2-G07 block: 6 tests
  (per route: no `process.env`; endpoint and key from the registry; plus
  plan-aware `selectModel` for each capability, and no private model list /
  `gpt-4o-transcribe` in transcribe).
- Leftover sweep of `app/api/voice`: `process.env`, vendor URLs,
  `OPENAI_TTS_URL`, `OPENAI_TRANSCRIPT_URL`, `DEFAULT_MODEL`,
  `ALLOWED_MODELS`, `getRequestedModel`, `gpt-4o-transcribe` — none left;
  `OPENAI_TTS_MODEL` appears only in speak's explanatory comment.
- Totals (`git diff --stat HEAD`): code and tests 4 files, +162 / −81; with
  this file 5 files, +208 / −82.

#### Verification (each step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 1 | Affected guard suites | `node --test --test-concurrency=1 …` `purification-authorities`, `ai-provider`, `usage-enforcement`, `api-auth-boundary`, `architecture-invariants`, `middleware-gate`, `observability-redaction` | **PASS** — exit 0; 448 tests, 61 suites: 441 pass, 0 fail, 7 todo (the P2-F09 error-mapping blocks for both routes still pass) | 352 → 376 MB |
| 2 | Mutations | 8 mutations, below | **PASS** — 8 of 8 caught; both routes restored to their original hash | 501 … 548 MB per mutation |
| 3 | Regression suites | `node --test --test-concurrency=1 …` `data-access`, `api-reference-integrity`, `defect-remediation`, `model-routing`, `authorization-boundary`, `fabricated-results` | **PASS** — exit 0; 160 tests, 39 suites: 160 pass, 0 fail | 471 → 486 MB |
| 4 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`) | **PASS** — exit 0, 0 `error TS` lines | 450 → 819 MB |
| 5 | Full suite | `npm run test:lowmem` | **PASS** — exit 0; 1,841 tests, 348 suites: 1,834 pass, 0 fail, 0 skipped, 7 todo (64.7 s) | 716 → 665 MB |
| 6 | Lint | `npx eslint app/api/voice/transcribe/route.ts app/api/voice/speak/route.ts tests/security/ai-provider.test.ts tests/security/purification-authorities.test.ts` (`--max-old-space-size=768`) | **PASS** — exit 0, 0 errors, 0 warnings | 658 → 815 MB |

**Test-count delta accounted:** 1,841 vs 1,833 (after G-B5) = +6 (P2-G07
block) +2 (`ai-provider` `MODEL_ACCEPTING` generates 2 tests per route;
transcribe added). Suites 348 vs 347 = the new P2-G07 `describe`. The 7
todos are the documented limitations; "failing tests:" in steps 1 and 5
lists only those.

#### Mutation testing

Each mutation re-created one defect, ran the guard that owns it, and
restored the original bytes in a `finally` block; both routes were backed
up to the scratchpad first. SHA-256, first 12 hex.

| # | Defect re-created | Route | Result | Hash before = after |
|---|---|---|---|---|
| M1 | Hardcoded vendor URL (`https://api.openai.com/v1` in place of `PROVIDER_ENDPOINTS[…].baseUrl`) | transcribe | **Caught** — `purification-authorities` 53 / 1: "transcribe takes its endpoint and key from the registry" | `D16F1385F11E` ✔ |
| M2 | Key read from the environment (`process.env.OPENAI_API_KEY ?? null`) | transcribe | **Caught** — 52 / 2: "transcribe reads no environment variable directly", "… takes its endpoint and key from the registry" | `D16F1385F11E` ✔ |
| M3 | Plan check dropped (`"enterprise"` for `guard.entitlement.effectivePlan`; 1 occurrence) | transcribe | **Caught** — 53 / 1: "transcribe resolves its model through the registry, plan-aware" | `D16F1385F11E` ✔ |
| M4 | Unregistered model re-added (`["gpt-4o-transcribe"]`) | transcribe | **Caught** — 53 / 1: same test | `D16F1385F11E` ✔ |
| M5 | Model refusal not returned (`if (false)` for `if (!transcriptionModel.ok)`) | transcribe | **Caught** — `ai-provider` 38 / 1: "app/api/voice/transcribe/route.ts returns the policy denial" | `D16F1385F11E` ✔ |
| M6 | Env default model re-added (`requestedModel ?? process.env.OPENAI_TTS_MODEL`) | speak | **Caught** — 52 / 2: "speak reads no environment variable directly", "speak resolves its model through the registry, plan-aware" | `3BDCA310C2E7` ✔ |
| M7 | Hardcoded vendor URL | speak | **Caught** — 53 / 1: "speak takes its endpoint and key from the registry" | `3BDCA310C2E7` ✔ |
| M8 | `GET` reads the key from the environment (`Boolean(process.env.OPENAI_API_KEY)`) | speak | **Caught** — 53 / 1: "speak reads no environment variable directly" | `3BDCA310C2E7` ✔ |

`git status --short` identical before and after; `syraven-audit.zip` size
and timestamp unchanged. All eight ran in one pass; no memory-gate block in
this batch.

#### Known limitations

- Behaviour changes, as recorded in the plan: transcribe's default model is
  now the registry default `whisper-1` (was `gpt-4o-mini-transcribe`);
  `gpt-4o-transcribe` and any unregistered model answer 400; a plan-excluded
  model answers 400 (not the 403 `resolveAiPolicy` uses). A deployment that
  set `OPENAI_TTS_MODEL` no longer changes speak's default.
- Transcribe still meters with `guard.record({})` (no model id), as before.
- Both routes keep their own `fetch` rather than a shared provider adapter
  for audio; the endpoint and key now come from the registry.
- Neither route has a product caller; no live provider call was made and no
  production build was run.

#### Not done

No commit, push, deploy, build, migration, or secret / OAuth change.
G-B7 and P2-H not started. `syraven-audit.zip` not opened, moved, deleted
or staged.

**RESULT (P2-G07 / G-B6):** implemented and verified — all steps PASS.
**Not committed**; awaiting founder instruction.

#### P2-G08 — `/api/agents` stores a model only the registry approved (founder decision 2026-09-15: "Preference kept, model only if registry id", G-B7)

| ID | Route | Drift (file:line at `dbac1d5`) | Consumers | Tests that pin it | Canonical owner | Decision |
|---|---|---|---|---|---|---|
| P2-G08 | `POST /api/agents` (agent catalogue create) | `model = body.model \|\| process.env.AI_DEFAULT_MODEL \|\| process.env.GROQ_MODEL \|\| "llama-3.3-70b-versatile"` (`route.ts:694-701`) is stored in `agents.model` with no registry or plan check: a client string, an env-named model or a hardcoded id. The only caller, `/agents/create` (`page.tsx:416-435`), sends a **preference label** — `"auto" \| "fast" \| "smart" \| "deep"` (`:47-51`, select `:1671-1704`) — so today every UI-created agent stores `"auto"` etc. as its "model", and `/agents` displays it (`app/agents/page.tsx:412-414`). Catalogue agents never run through a model (execution uses `lib/orchestration/registry.ts` agents); `agents.model` is nullable | `/agents/create` (POST), `/agents` (list shows `agent.model`) | None on model storage — `middleware-gate` (protected), `fabricated-results` (response shape `{ success, agents }`) | `lib/ai/registry.ts` `selectModel(…, "chat", plan)`; plan from `lib/usage/entitlements.ts` `resolveEntitlement` on the caller's RLS client | CONSOLIDATE — see below |

**Decision (founder, 2026-09-15).** A registry chat model id is validated
with `selectModel(requestedModel, "chat", effectivePlan)` — `effectivePlan`
from `resolveEntitlement(session.supabase, session.userId)` — and stored in
`model`; a refusal answers 400, an unreadable entitlement 503. A UI
preference label (`auto`, `fast`, `smart`, `deep`) is stored as
`configuration.modelPreference` with `model` null. Anything else answers 400.
No env fallback and no hardcoded default: an agent with no model stays null.

**Behaviour changes, recorded:** agents created from the UI now have
`model` null and the label in `configuration.modelPreference` (was the
label in `model`), so `/agents` shows no model for them; a request naming an
unregistered or plan-excluded model is refused (was stored verbatim); a
deployment's `AI_DEFAULT_MODEL` / `GROQ_MODEL` no longer reach the table.
Existing rows are untouched (no data migration).

**Guards planned:** a P2-G08 block in `purification-authorities` — the
route reads no `process.env`; hardcodes no model id; stores `model` only
from `selectModel(…, "chat", …effectivePlan)` with the plan from
`resolveEntitlement(session.supabase, session.userId)`; returns the
refusal; keeps the preference labels in `configuration.modelPreference`.

**Mutations planned:** M1 env fallback re-added; M2 hardcoded default
model re-added; M3 plan check dropped (`"enterprise"`); M4 the raw client
value stored instead of the selection; M5 the refusal not returned.

#### What changed (uncommitted at `dbac1d5`)

- `app/api/agents/route.ts` — the `body.model || process.env.AI_DEFAULT_MODEL
  || process.env.GROQ_MODEL || "llama-3.3-70b-versatile"` fallback is gone.
  `requestedModel` (from `body.model`): a preference label (`auto`, `fast`,
  `smart`, `deep`) sets `modelPreference` and leaves `model` null; any other
  value is checked with `selectModel(requestedModel, "chat",
  entitlement.entitlement.effectivePlan)`, the plan from
  `resolveEntitlement(session.supabase, session.userId)` — unreadable
  entitlement → 503 `ENTITLEMENT_UNAVAILABLE`, refusal → 400
  `UNKNOWN_MODEL`, acceptance → `model = selection.model.id`. No value →
  both null. `configuration` gains `modelPreference`. The duplicate
  `next/server` import (present at HEAD) is merged, since the file was
  touched.
- `tests/security/purification-authorities.test.ts` — P2-G08 block: 4 tests
  (no `process.env` and no hardcoded model id; plan-aware `selectModel`
  after `resolveEntitlement` with the refusal returned; only
  `selection.model.id` stored; preference kept in
  `configuration.modelPreference`).
- Leftover sweep of the route: `process.env`, `llama-`, `gpt-`,
  `AI_DEFAULT_MODEL`, `GROQ_MODEL` — none left.
- Totals (`git diff --stat HEAD`): code and tests 2 files, +113 / −7; with
  this file 3 files, +148 / −9.

#### Verification (each step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 1 | Affected guard suites | `node --test --test-concurrency=1 …` `purification-authorities`, `fabricated-results`, `middleware-gate`, `api-auth-boundary`, `architecture-invariants`, `usage-enforcement`, `ai-provider` | **PASS** — exit 0; 471 tests, 67 suites: 464 pass, 0 fail, 7 todo. First launch refused at the gate (246 MB) | 467 → 346 MB |
| 2 | Mutations | 5 mutations, below | **PASS** — 5 of 5 caught; the route restored to its original hash | 362 … 478 MB per mutation |
| 3 | Regression suites | `node --test --test-concurrency=1 …` `data-access`, `api-reference-integrity`, `defect-remediation`, `model-routing`, `agent-orchestration`, `authorization-boundary` | **PASS** — exit 0; 158 tests, 36 suites: 158 pass, 0 fail | 326 → 421 MB |
| 4 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`) | **PASS** — exit 0, 0 `error TS` lines. First launch refused at the gate (294 MB) | 321 → 840 MB |
| 5 | Full suite | `npm run test:lowmem` | **PASS** — exit 0; 1,845 tests, 349 suites: 1,838 pass, 0 fail, 0 skipped, 7 todo (68.5 s) | 587 → 530 MB |
| 6 | Lint | `npx eslint app/api/agents/route.ts tests/security/purification-authorities.test.ts` (`--max-old-space-size=768`) | **PASS** — exit 0, 0 errors, 0 warnings | 502 → 977 MB |

**Test-count delta accounted:** 1,845 vs 1,841 (after G-B6) = +4 (P2-G08
block). Suites 349 vs 348 = the new P2-G08 `describe`. The 7 todos are the
documented limitations; "failing tests:" in steps 1 and 5 lists only those.

#### Mutation testing

Each mutation re-created one defect in `app/api/agents/route.ts`, ran
`purification-authorities`, and restored the original bytes in a `finally`
block; the route was backed up to the scratchpad first. SHA-256, first 12
hex.

| # | Defect re-created | Result | Hash before = after |
|---|---|---|---|
| M1 | Env fallback re-added (`let model = process.env.GROQ_MODEL ?? null`) | **Caught** — 57 / 1: "no model comes from the environment or a hardcoded default" | `C5731EDD4C53` ✔ |
| M2 | Hardcoded default re-added (`let model = "llama-3.3-70b-versatile"`) | **Caught** — 57 / 1: same test | `C5731EDD4C53` ✔ |
| M3 | Plan check dropped (`"enterprise"` for `entitlement.entitlement.effectivePlan`; 1 occurrence) | **Caught** — 57 / 1: "a named model is validated against the registry and the caller's plan" | `C5731EDD4C53` ✔ |
| M4 | Raw client value stored (`model = requestedModel`) | **Caught** — 57 / 1: "only the registry's choice is stored as the model" | `C5731EDD4C53` ✔ |
| M5 | Refusal not returned (`if (false)` for `if (!selection.ok)`) | **Caught** — 57 / 1: "a named model is validated against the registry and the caller's plan" | `C5731EDD4C53` ✔ |

`git status --short` identical before and after; `syraven-audit.zip` size
and timestamp unchanged. **Memory:** step 1 and step 4 were each refused
once at the gate (246 MB, 294 MB; nothing started); a memory-only watcher
(ran nothing) reported headroom each time (340 MB, 396 MB) before the step
ran at ≥ 300 MB. All five mutations ran in one pass.

#### Known limitations

- Behaviour changes, as recorded in the plan: UI-created agents now have
  `model` null with the label in `configuration.modelPreference`, so
  `/agents` shows no model for them; an unregistered or plan-excluded model
  is refused; env `AI_DEFAULT_MODEL` / `GROQ_MODEL` no longer reach the
  table. Existing rows are untouched.
- The `/agents` list does not display `configuration.modelPreference` (UI
  unchanged in this batch).
- A named model costs one extra `profiles` read (`resolveEntitlement`);
  preference labels and an absent model do not.
- No live request against the route; no production build.

#### Not done

No commit, push, deploy, build, migration, data change, or secret / OAuth
change. P2-H not started. `syraven-audit.zip` not opened, moved, deleted or
staged.

**RESULT (P2-G08 / G-B7):** implemented and verified — all steps PASS.
**Not committed**; awaiting founder instruction.

### P2-P — preflight follow-up before P2-H (founder-approved 2026-09-15)

The read-only preflight at `e0ac56f` found three pages with no inbound
link from `app/` or `lib/` (`/billing/success` and `/billing/cancel` are
**not** orphans: Stripe's `success_url` / `cancel_url`,
`app/api/billing/checkout/route.ts:235,239`), a latent shape gap in the
`api-auth-boundary` sweep, and final-gate prerequisites. The founder
approved seven items; each is recorded here before it is made.

| ID | Target (file:line at `e0ac56f`) | Finding | Inbound refs | Tests that pin it | Decision |
|---|---|---|---|---|---|
| P2-P01 | `app/chat/[id]/page.tsx` (1,038 lines) | FAKE-PERSISTENCE: a conversation "saved" only in the browser — `STORAGE_PREFIX = "syraven-chat:"` (`:47-48`), `localStorage.getItem` (`:150`), `setItem` (`:217`), `removeItem` (`:618`). Nothing navigates to it; no `/chat/${…}` link exists anywhere. The server stores no conversation for it | 0 (`app/`, `lib/`, `tests/e2e`, sitemap) | None | **RETIRE** (founder): delete the page. `/chat/<id>` answers Next's 404. `/chat` (`app/chat/page.tsx`, no web storage) and `app/chat/layout.tsx` are unchanged |
| P2-P02 | `app/teams/[id]/page.tsx` (490 lines, kept) · `app/teams/page.tsx` | An honest page (reads `GET /api/teams?id=` on the caller's session; team RLS owner-scoped; fabrication removed earlier) that nothing links to — the `/teams` list selects a team in place and never offers its page | 0 | `fabricated-results` (`:306-386`), `dialogs-are-dialogs` (`:70`, `:233`) | **KEEP AND LINK** (founder): `/teams` gains a link to `/teams/${encodeURIComponent(id)}` in the selected team's header. List rows stay buttons (a link inside a button is invalid markup) |
| P2-P03 | `app/privacy/activity/page.tsx` (527 lines) | A security log with no backend: opens empty (`useState<PrivacyActivity[]>([])`, `:119-120`), "Clear activity" clears local state only (`:166-168`), export disabled (`:513-521`). The page itself records that no route exposes `audit_logs` and there is no `/api/privacy` (`:57-60`). `/privacy` does not link to it; sitemap lists only `/privacy` | 0 | `fabricated-results` (`:231-254`, 2 tests), `fields-are-labelled` (`:198-201`, 1 generated test) | **RETIRE** (founder): delete the page. The two pins are converted, not dropped: `fabricated-results` asserts the page stays retired until a real audit-log route exists; `fields-are-labelled` loses the entry for the deleted file (its other search fields stay pinned) |
| P2-P04 | `tests/security/api-auth-boundary.test.ts:160-238` | The per-method sweep only generates a test for `export const M = withAuth(` and `export (async) function M(`; any other export of a mutating method (`export const POST = (async …)`, `export const POST = handler`, `export { h as POST }`, `export let/var`, `export * from`) hits `if (!wrapped && !plain) continue` and is **skipped silently**. 0 current violations (74 handlers in 35 routes: 53 `const … = withAuth(`, 21 function declarations). Found by G-B3 mutation M3 | — | The sweep itself | **HARDEN** (founder): classify every export of `POST`/`PUT`/`PATCH`/`DELETE` as `absent` / `wrapped` / `plain` / `unclassified`; an `unclassified` export **fails** ("cannot verify") instead of being skipped. The classifier gets its own shape tests. `GET` stays out of scope (covered by `middleware.ts`; not part of the gap) |
| P2-P05 | `syraven-audit.zip` (untracked, 2,444,143 bytes, mtime `2026-09-14T17:41:03.66Z`) | Unexplained untracked artifact at the repository root | — | — | **INTENTIONALLY EXCLUDED** (founder): not opened, modified, moved, deleted, staged or git-ignored. Excluded by name from the final gate's repository-integrity and secret-scan checks and from the scratch build copy; metadata (size, mtime) is the only thing read |
| P2-P06 | `tests/security/engineering-control-plane.test.ts:247` · `PHASE_STATE.md:13,78` · `CLAUDE.md` "Current state" · `PROJECT_STATE.md:59-60` | All four say Phase 2 has **not started**; it was started, stopped and resumed by the founder (2026-09-14) and has 16 local commits. The guard pins the false statement | — | `engineering-control-plane` | **CORRECT TOGETHER** (founder): the guard pins Phase 2 as `IN PROGRESS` (not PASS before its final gate and founder acceptance) and Phase 3 as `NOT STARTED`; the docs state the real status. Only the Phase 2 status lines change |
| P2-P07 | Production build of the Phase 2 tree | Last build: the Phase 1 tree (`R3WTT03LAIpTqm5j4I0tf`, 2026-09-14). `next build` loads `.env.local` (production secrets) in the canonical checkout | — | — | **ATTEMPT** (founder) in a secret-free scratch copy, as in Phase 1, behind the memory gate (`RESOURCE_POLICY.md`: ≥ 300 MB free to start; heap 1,600 MB). If the memory is not there, **BLOCKED** with the readings — never forced |

**Guards planned.**
- `purification-authorities`, P2-P block: `app/chat/[id]/page.tsx` absent and
  nothing links to `/chat/<id>`; no `app/chat` source uses `localStorage` /
  `sessionStorage`; `/teams` links to `/teams/${encodeURIComponent(…id)}`
  and `app/teams/[id]/page.tsx` exists; `app/privacy/activity/page.tsx`
  absent and nothing links to `/privacy/activity`.
- `fabricated-results`: the security-log block asserts the page stays
  retired (a re-added page must first have a real audit-log route).
- `api-auth-boundary`: `classifyHandler` + shape tests; the sweep fails on
  `unclassified`.
- `engineering-control-plane`: `| Phase 2 | IN PROGRESS |`, not PASS;
  `| Phase 3 | NOT STARTED |`.

**Mutations planned.**
- P01: page restored; a `localStorage` write re-added to `/chat`; a
  `/chat/${id}` link re-added.
- P02: link removed.
- P03: page restored; a `/privacy/activity` link re-added.
- P04: on a real non-public route (`app/api/teams/route.ts`):
  - M1 `withAuth(` dropped from `export const POST = withAuth(` (unauthenticated arrow — the gap; also run against the **unfixed** sweep to show it was skipped);
  - M2 re-exported through a list (`export { h as DELETE }`);
  - M3 `export let PATCH`;
  - M4 `export * from`;
  - M5 the classifier's `unclassified` branch returning `absent` (the old skip).
- P06: guard pin reverted to `NOT STARTED` while the doc says `IN PROGRESS`; doc
  says `PASS`; Phase 3 row set to `IN PROGRESS`.

**Behaviour changes, recorded:** `/chat/<id>` and `/privacy/activity`
answer 404 (no product link reaches either; conversations a browser kept
under `syraven-chat:` stay in that browser, unread). `/teams` shows one
extra link. No API route, database access, migration, dependency or
secret changes.

#### What changed (uncommitted at `e0ac56f`)

- **P2-P01** — `app/chat/[id]/page.tsx` deleted (1,038 lines; the empty
  `[id]` directory removed). `app/chat/page.tsx` and `layout.tsx` untouched.
- **P2-P02** — `app/teams/page.tsx`: the selected team's header wraps
  "Delete team" with a new `<Link href={`/teams/${encodeURIComponent(selectedTeam.id)}`}>`
  "Open team page". `app/teams/[id]/page.tsx` untouched.
- **P2-P03** — `app/privacy/activity/page.tsx` deleted (527 lines; the
  empty directory removed). `fabricated-results`: the two tests on the page
  source ("the log is not seeded", "it opens empty") become one retirement
  pin ("/privacy/activity stays retired until a real audit-log route
  exists"). `fields-are-labelled`: the entry for the deleted page removed;
  `/marketplace` and `/studio` stay pinned.
- **P2-P04** — `api-auth-boundary`: `classifyHandler(code, method)` returns
  `absent` / `wrapped` / `plain` / `unclassified`. The sweep skips only
  `absent`; `unclassified` fails with "exports M in a shape this sweep
  cannot verify". A new describe pins 14 shapes. The wrapped and plain
  verification logic after it is unchanged.
- **P2-P05** — nothing touched; see the verification notes.
- **P2-P06** — `engineering-control-plane:247`: `| Phase 2 | NOT STARTED |`
  replaced by `| Phase 2 — Repository and Architecture Purification | IN PROGRESS |`,
  a negative pin (no `PASS` / `COMPLETE` / `DONE` status cell for Phase
  2), and `| Phase 3 | NOT STARTED |`. `PHASE_STATE.md` (last-updated line,
  next allowed action, Phase history: Phase 2 and Phase 3 rows),
  `CLAUDE.md` "Current state" (one bullet), `PROJECT_STATE.md` "Active
  phase" (one paragraph).
- `purification-authorities`: a P2-P block of 4 tests. It covers:
  - `/chat/[id]` is absent, and no `app/chat` source uses web storage;
  - no `"/chat/<id>"` link exists;
  - `/teams` links to `/teams/[id]`, which exists;
  - `/privacy/activity` is absent and unlinked.
- `.next/types` regenerated with `npx next typegen` (exit 0). There are 0
  references left to either deleted page. `.next` is git-ignored.

#### Verification (each heavy step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before → after |
|---|---|---|---|---|
| 1 | Affected guard suites | `node --test --test-concurrency=1` `purification-authorities`, `fabricated-results`, `fields-are-labelled`, `api-auth-boundary`, `engineering-control-plane`, `dialogs-are-dialogs`, `connector-surface-is-honest`, `middleware-gate`, `one-main-landmark`, `ui-integrity`, `no-dead-controls`, `api-reference-integrity` | **PASS**: exit 0; 474 tests, 59 suites, 474 pass, 0 fail. The first launch was refused at the gate (285 MB, nothing started) | 548 → 556 MB |
| 2 | Mutations | 15, below | **PASS**: 14 of 14 caught, and the unfixed-sweep baseline confirmed the gap; every file restored by hash | 313 … 506 MB per mutation |
| 3 | Invariants and control plane | `npm run test:invariants` | **PASS**: exit 0; 68 tests, 61 pass, 0 fail, 7 todo | 333 → 396 MB |
| 4 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (`--max-old-space-size=1536`), after `next typegen` | **PASS**: exit 0, 0 `error TS` lines (108 s) | 382 → 981 MB |
| 5 | Full suite | `npm run test:lowmem` | **PASS**: exit 0; 1,860 tests, 351 suites, 1,853 pass, 0 fail, 0 skipped, 7 todo (37.8 s) | 970 → 667 MB |
| 6 | Lint | `npx eslint app/teams/page.tsx` plus the 5 changed test files (`--max-old-space-size=768`) | **PASS**: exit 0, 0 errors, 0 warnings | 667 → 954 MB |

**Test-count delta** (1,860 against 1,845 after G-B7, +15), from a
name-by-name diff of the two full-suite logs:

| Change | Tests |
|---|---|
| Classifier shape tests | +14 |
| P2-P block | +4 |
| `fabricated-results` retirement pin | +1 |
| Removed: `fabricated-results` "the log is not seeded" and "it opens empty" | −2 |
| Removed: `fields-are-labelled` "/privacy/activity names its search field" | −1 |
| Removed: `one-main-landmark` "app/chat/[id]/page.tsx renders no <main>" (generated per page) | −1 |
| **Net** | **+15** |

The suites went from 349 to 351, one for each of the two new describes.
The 7 todos are the documented limitations.

#### Mutation testing

Each mutation re-created one defect, ran the named suite, and restored the
original bytes in a `finally` block. The backups are in
`scratchpad/mutation-backup-pp` (SHA-256, first 12 hex). Script:
`scratchpad/mut-pp.mjs`, TAP reporter, gate ≥ 300 MB per run.

| # | Defect re-created | Suite | Result |
|---|---|---|---|
| P01a | `/chat/[id]` page restored | `purification-authorities` | **Caught**: 61 / 1 |
| P01b | `localStorage.setItem` re-added to `app/chat/page.tsx` | same | **Caught**: 61 / 1 |
| P01c | `` `/chat/${id}` `` link re-added | same | **Caught**: 61 / 1 |
| P02 | `/teams` link replaced with `href="/teams"` | same | **Caught**: 61 / 1 |
| P03a | `/privacy/activity` page restored | `purification-authorities` + `fabricated-results` | **Caught**: 116 / 2 |
| P03b | `"/privacy/activity"` link re-added to `/privacy` | `purification-authorities` | **Caught**: 61 / 1 |
| P04 baseline | M1 applied under the **unfixed** sweep (the `e0ac56f` test file) | `api-auth-boundary` | **Gap confirmed**: 133 pass / 0 fail, so the unauthenticated POST passed unseen |
| P04-M1 | `export const POST = (async …)`: `withAuth` dropped in `app/api/teams/route.ts` | `api-auth-boundary` | **Caught**: 147 / 1 ("POST is authenticated") |
| P04-M2 | DELETE exported through `export { deleteHandler as DELETE }` | same | **Caught**: 147 / 1 |
| P04-M3 | `export let PATCH = withAuth(…)` | same | **Caught**: 147 / 1 |
| P04-M4 | `export * from "./handlers"` appended | same | **Caught**: 148 / 1 (PUT: the one method the file does not already export as `withAuth`) |
| P04-M5 | The classifier's `unclassified` branch returns `absent` (the old skip) | same | **Caught**: 139 / 9 (the shape tests) |
| P06a | Guard pin reverted to `\| Phase 2 \| NOT STARTED \|` | `engineering-control-plane` | **Caught**: 15 / 1 |
| P06b | `PHASE_STATE.md` Phase 2 status set to `PASS` | same | **Caught**: 15 / 1 |
| P06c | `PHASE_STATE.md` Phase 3 row set to `IN PROGRESS` | same | **Caught**: 15 / 1 |

Restored hashes:
- `app/api/teams/route.ts` `59BCA655C5A8` (= backup)
- `app/chat/page.tsx` `99CC31E6B69A`
- `app/teams/page.tsx` `C317C0051A29`
- `app/privacy/page.tsx` `379F2F75AB2B`
- `api-auth-boundary.test.ts` `05A455EB65C5`
- `engineering-control-plane.test.ts` `9CA072AA94B3`
- `PHASE_STATE.md` `CF30CD8D8554`

Both restored pages were removed again. `git status --short` was identical
before and after, and the size and mtime of `syraven-audit.zip` were unchanged.

#### Known limitations

- `/chat/<id>` and `/privacy/activity` answer Next's generic 404, not a
  page explaining the retirement; no product link reaches either.
- A security or privacy activity log does not exist in the product; it
  needs an `audit_logs` route (and the durability work recorded for the
  dead `lib/security/audit.ts`).
- The sweep still covers only `POST` / `PUT` / `PATCH` / `DELETE`. `GET`
  relies on `middleware.ts` (founder scope: the gap, not GET).
- The `withAuth` form is recognised only as `export const M = withAuth(`.
  A generic call (`withAuth<T>(`) or a type annotation now fails as
  unclassified rather than passing. That is fail-closed by design; none
  exist today.
- No browser check of the `/teams` link.

#### P2-P07 — production build attempt (scratch copy, memory gate)

| Attempt | Result | Evidence |
|---|---|---|
| 0 | **NOT STARTED** | The pre-build secret scan matched the synthetic fixture in `observability-redaction.test.ts:380`, a `postgres` URL with placeholder credentials, used there since `5f2832f`. It is now allowed by exact file and value; every other match still blocks |
| 1 | **FAIL (environment)** | Exit 1 after 13 s: `Cannot find module 'next/dist/compiled/webpack/webpack-lib'`. The scratch `node_modules` under `%TEMP%` had lost files (2 of 28 in that directory). Re-synced with `robocopy /MIR` (14,266 copied, 854 extras removed, 0 failed); the script now checks Next's compiled directories file for file |
| 2 | **NOT STARTED** | The scan matched that fixture's literal, which I had quoted in a `VERIFICATION_STATE.md` row. The row was reworded |
| 3 | **BLOCKED (resources)** | Started at 513 MB free, with the copy (309 files, 0 hash mismatches, no `.env*`, no secret-named project env vars) and `node_modules` checks passing. The host killed it for low memory during "Creating an optimized production build …". No `BUILD_ID`, no process left |

Not retried: the founder's instruction was to record BLOCKED rather than
force it. `git status` and `syraven-audit.zip` (size and mtime) were
unchanged by every attempt; the canonical checkout was never built.

**RESULT (P2-P):**

| Item | Status |
|---|---|
| P2-P01–P04 (orphan pages, sweep hardening) | Implemented and verified: every step PASS |
| P2-P05 (`syraven-audit.zip`) | Recorded as an excluded artifact |
| P2-P06 (Phase 2 status, guard and docs) | Implemented and verified |
| P2-P07 (production build) | **BLOCKED** (resources) |

Committed as `f566757` on the founder's instruction (2026-09-15); not pushed.

### P2-H — documentation and architecture consistency (founder-approved 2026-09-15)

Scope: the seven stale statements named by the preflight. Each one was
checked against the code at `f566757` before it was classified. A
historical statement that is still accurate about its own date is left
alone. A dated, point-in-time document gets an annotation, not a rewrite.
Only present-tense claims that are false are corrected.

| ID | Target (file:line at `f566757`) | Claim | Reality (evidence) | Classification | Decision |
|---|---|---|---|---|---|
| P2-H01 | `MEMORY_ARCHITECTURE.md:138`, `:158` | Lifecycle: "Create / update \| `status = 'active'` — retrievable"; a new memory source filters "`status = 'active'`" | `app/api/knowledge/route.ts:156-168` `normalizeStatus` defaults to `"ready"`, and `lib/search/knowledgeBridge.ts:187,265` writes `"processing"`. `RETRIEVABLE_STATUSES = ["active"]` (`lib/memory/hierarchy.ts:117`, founder decision 2026-09-14), so created records are **not** retrievable. The rule has one authority: the constant | **STALE (false)** | Correct §6 and §7: name `RETRIEVABLE_STATUSES` as the authority and state the known limitation. §2 ("anything not `active` is refused") is true; unchanged |
| P2-H02 | `ARCHITECTURE_AUDIT.md:77`, `:177` | `@/services/action-types` is imported (types only) by `/api/action`; every `services/` file is unreferenced "except `action-types.ts`" | Deleted in P2-F05 (`services/action-types.ts`, 411 lines); `purification-authorities` P2-F05 pins its absence | **DATED** — Phase 0 audit of `68f468c` (2026-09-03); true on its date | Annotate both lines as superseded (Phase 2, P2-F05). No rewrite |
| P2-H03 | `IMPLEMENTATION_PLAN.md:170` | "Only `@/services/action-types` (types) is imported" | Same as P2-H02 | **DATED** — plan written from `68f468c` | Annotate as superseded |
| P2-H04a | `lib/orchestration/registry.ts:14` | "`/api/agents/execute` **is** a single stateless LLM call" | Retired to a `withAuth` 410 (P2-G02, G-B2); `RETIRED_ROUTES` guard | **STALE (present tense)** | Past tense + retirement reference. `:19` ("`/api/action` decided …") is past tense and accurate; unchanged |
| P2-H04b | `lib/ai/provider.ts:7` | "The single place that talks to an AI provider over the wire" | Four other callers fetch providers directly, each taking its endpoint and key from the registry: `/api/chat` (`route.ts:392,440`, own SSE: the P2-F08 known limitation), `/api/voice/transcribe` (`:263,484`), `/api/voice/speak` (`:485-486`), `lib/search/openaiEmbedding.ts:189` | **STALE (false architectural claim)** | Correct the header: the adapter is the chat-completion transport; name the four direct callers and the registry as the single source of endpoints and keys. `:14`, `:49-51` ("Before Phase 7 … `/api/agents/execute` passed `request.signal`") are dated history; unchanged |
| P2-H04c | `lib/usage/entitlements.ts:292-294`, `lib/ai/registry.ts:14-22` | "Before Phase 5 … 32,768 on `/api/agents/execute`"; "Before Phase 7, model identifiers were scattered …" | Both are explicitly dated history and accurate | **NOT STALE** | No change |
| P2-H05 | `tests/security/architecture-invariants.test.ts:332` | Test title "/api/action classifies; it neither runs work nor claims it ran" | `/api/action` no longer classifies. It is a retired 410 (P2-G03); the two assertions (no `executeTool` / `.from` / `.rpc`; no `"Done."`) still hold | **STALE (test description)** | Retitle; assertions unchanged |
| P2-H06 | `docs/engineering/GIT_PROTOCOL.md:32-45`, `:27-30` | "Pending commits (as of 2026-09-13)" with a recommended three-commit split, "awaiting founder instruction"; the trailer example hard-codes one session URL | The three efforts were committed 2026-09-14: `9837f30` (Brain semantic bridge …), `a4e052d` (Phase 1), `3314baa` (control plane). Every Phase 2 batch has its own commit. The session URL differs per session | **STALE** | Replace the pending section with the commit record and point to the state files; make the trailer session-generic |
| P2-H07 | `ARCHITECTURE_NORTH_STAR.md:172-188` (DEAD list), `:162` (Observability row) | "DEAD — no importer (verified by grep, 2026-09-13)" lists `lib/memory/hierarchy.ts`; the Observability row calls `lib/security/audit.ts` "unused" | `hierarchy.ts` **was imported** by `lib/memory/retrieval.ts` at `6de7dd0` and `3314baa`, and still is (`retrieval.ts:46`): the listing was wrong on its date. 12 of the 14 listed modules were deleted in Phase 2 (`git log --diff-filter=D`): the 11 `lib/` files in `232c62a` (P2-A) and `TopBar.tsx` in `1447998` (P2-C). `lib/observability/logger.ts` is kept by decision, still without an importer. `/api/canvas` still has no UI caller | **STALE (false on its date + superseded)** | Replace the list with a per-file status table: `hierarchy.ts` marked **[corrected] not dead**, deleted files with their batch, `logger.ts` kept; correct the `audit.ts` phrase in the Observability row |

**Found during inspection, outside the seven items (recorded, NOT
changed):** the `IMPLEMENTATION_PLAN.md` header still reads "Status:
Proposed — awaiting approval. No implementation has begun.", although
Phases 1–12 of that plan were implemented. It is a dated planning
document; changing its status line is a founder decision.

**Guards planned** (`purification-authorities`, P2-H block; runtime code untouched):
- `MEMORY_ARCHITECTURE.md` names `RETRIEVABLE_STATUSES` and does not claim
  created or updated records are retrievable while the constant excludes the
  knowledge route's default status.
- The North Star dead-module table stays true. A file marked deleted does
  not exist. A file marked kept or dead exists and has no importer in `app/`
  or `lib/`. `hierarchy.ts` is never marked dead.
- The `provider.ts` header does not claim to be the single provider transport
  while other files fetch a `PROVIDER_ENDPOINTS` base URL.

**Mutations planned:**
- M1: restore the §6 lifecycle row.
- M2: mark `hierarchy.ts` as dead in the table.
- M3: mark the kept `logger.ts` as deleted.
- M4: mark a deleted file as kept.
- M5: restore the "single place" header.
- M6: drop `RETRIEVABLE_STATUSES` from `MEMORY_ARCHITECTURE.md`.

No runtime behaviour changes: every edit is documentation, a comment, or a
test title, plus the new guards.

#### What changed (uncommitted at `f566757`)

- `MEMORY_ARCHITECTURE.md` §6: the lifecycle row states the real status
  writes (`ready`, `processing`), names `RETRIEVABLE_STATUSES` as the rule,
  and records the known limitation. §7 step 2 uses the constant instead
  of a literal.
- `ARCHITECTURE_AUDIT.md:77,177` and `IMPLEMENTATION_PLAN.md:170`: a
  "superseded" annotation each, citing P2-F05. The dated text is kept.
- `lib/orchestration/registry.ts`: the comment on `/api/agents/execute` is
  in the past tense, with the retirement cited (P2-G02).
- `lib/ai/provider.ts`: the header describes the adapter as the shared
  chat-completion transport and names the four direct provider callers.
- `tests/security/architecture-invariants.test.ts`: the test is retitled
  "the retired /api/action neither runs work nor claims it ran"; its
  assertions are unchanged.
- `docs/engineering/GIT_PROTOCOL.md`: the pending-commits section is
  replaced by the commit record (`9837f30`, `a4e052d`, `3314baa`, and
  Phase 2 per batch); the trailer's session URL is now a placeholder.
- `ARCHITECTURE_NORTH_STAR.md`: the dead list becomes a 14-row status
  table (12 deleted with their commit, `logger.ts` kept, `hierarchy.ts`
  **[corrected]** as not dead). The Observability row says `audit.ts` was
  deleted.
- `tests/security/purification-authorities.test.ts`: a P2-H block of 3
  tests (H01, H07, H04b).
- `lib/usage/entitlements.ts` and `lib/ai/registry.ts`: unchanged,
  because their dated history is accurate.

#### Verification (each heavy step alone, 300 MB gate before launch)

| # | Step | Command | Result | Free RAM before |
|---|---|---|---|---|
| 1 | Targeted suites | `node --test --test-concurrency=1` `purification-authorities`, `architecture-invariants`, `engineering-control-plane`, `ai-provider`, `memory-isolation`, `agent-orchestration` | **PASS**: 282 tests: 275 pass, 0 fail, 7 todo | 444 MB |
| 2 | Mutations | `scratchpad/mut-ph.mjs`, 7 below | **PASS**: 7 of 7 caught; files restored by hash | 364 … 438 MB |
| 3 | Typecheck | `npx tsc --noEmit -p tsconfig.json` (heap 1,536 MB) | **PASS**: exit 0, 0 `error TS` | 469 MB |
| 4 | Full suite | `npm run test:lowmem` | **PASS**: 1,863 tests, 352 suites: 1,856 pass, 0 fail, 7 todo | 851 MB |
| 5 | Lint | `npx eslint` on the 4 changed `.ts` files (heap 768 MB) | **FAIL, then fixed**: `@next/next/no-assign-module-variable` at `purification-authorities.test.ts:552`, a local named `module` in the new guard. Renamed to `modulePath` | 762 MB |
| R | Re-test after the fix | lint; `purification-authorities`; all 7 mutations; tsc; `test:lowmem` | **PASS**: lint exit 0; 65 / 65; 7 / 7 caught; tsc exit 0; 1,863: 1,856 pass, 0 fail, 7 todo | 452 … 859 MB |

**Test-count delta** (1,863 against 1,860 after P2-P, +3), from a
name-by-name diff: the three P2-H tests are new, and the one retitled test
is the same test under a new name. Suites went from 351 to 352 with the
new describe.

#### Mutation testing

Each mutation ran `purification-authorities` against one re-created stale
claim, and every one was **caught (64 / 1)**. Restored files:
`MEMORY_ARCHITECTURE.md` `D65820441730`, `ARCHITECTURE_NORTH_STAR.md`
`ED1DC9BD75AF`, `lib/ai/provider.ts` `7AAB4431A0D6`.

| # | Stale claim re-created | Test that failed |
|---|---|---|
| M1 | The §6 row claims "`status = 'active'` — retrievable" again | P2-H01 |
| M2 | `hierarchy.ts` marked "Kept" (dead) | P2-H07 |
| M3 | The kept `logger.ts` marked "Deleted" | P2-H07 |
| M4 | The deleted `groq.ts` marked "Kept" | P2-H07 |
| M5 | "The single place that talks to an AI provider" restored | P2-H04b |
| M6 | `RETRIEVABLE_STATUSES` removed from `MEMORY_ARCHITECTURE.md` | P2-H01 |
| M7 | The header stops naming `/api/voice/speak` | P2-H04b |

`git status --short` and `syraven-audit.zip` (size, mtime) were unchanged
throughout.

#### Known limitations

- The guards pin the corrected statements, not every sentence in every
  document. Dated Phase 0 documents remain dated, with annotations only
  where they cite removed code.
- The `IMPLEMENTATION_PLAN.md` header status ("Proposed — no
  implementation has begun") is recorded, not changed: a founder
  decision.
- Retrieval still returns no product-created knowledge; that is the
  documented P2-F07 limitation, and P2-H only made the docs say so.

**RESULT (P2-H):** implemented and verified; every step PASS after the
lint fix. Committed as `50346bb` on the founder's instruction
(2026-09-15); not pushed.

### Phase 2 final gate (2026-09-15, HEAD `50346bb`)

Verification only; no code changed. Every result, with its command, is
recorded in `VERIFICATION_STATE.md` (the "P2 gate" rows).

| ID | Finding | Evidence | Classification | Disposition |
|---|---|---|---|---|
| FG-01 | `/profile` has no inbound product link | Reachability matrix: only `app/robots.ts` names it. At `e0ac56f` its one link was `app/privacy/activity/page.tsx:465` ("Manage your account"), which P2-P03 retired. The P2-P guard checked the three pages but not what removing one left unreachable | **FAIL**, a Phase 2 regression | Not fixed during the gate (UI change). Proposed: link `/profile` from Settings or the navigation, and add a reachability guard for every kept page. Founder decision. **Subsequently resolved and committed in `cd24c57`** (the FG-01 fix below; re-run: PASS) |
| FG-02 | No sign-out control in the product | `/api/auth/logout` and `lib/supabase.ts` `signOut()` have no caller in `app/` or `lib/`; the same was true at `3314baa` | Pre-existing reachability gap, not introduced by Phase 2 | Recorded. Founder decision |
| FG-03 | `signOut()` in `lib/supabase.ts` is an exported function with no importer | `git grep signOut` | Dead export (the P2-A pass worked per file, not per export) | Recorded; resolves with FG-02 |
| FG-04 | Remaining duplicate authorities | Duplicate-authority rescan | **PARTIAL** | Recorded, not fixed. The five are listed after this table |
| FG-05 | Production build of the Phase 2 tree | Memory 308–629 MB sampled; the last attempt was killed during compilation at 513 MB start | **BLOCKED** (resources) | Not attempted; no OOM retry |
| FG-06 | Browser / E2E and visual QA | No build of the current tree | **BLOCKED** / **NOT RUN** | Needs FG-05 first |

The remaining duplicate authorities (FG-04):

1. The embedding model authority (`lib/search/openaiEmbedding.ts`
   `APPROVED_EMBEDDING_MODEL` plus the `lib/search/embedding.ts`
   candidate table) sits beside `lib/ai/registry.ts`, although it takes
   its endpoint and key from the registry.
2. `/agents/[id]` keeps its own catalogue of agents (research, coding,
   writing), mapped onto the orchestration ids (researcher, organizer,
   curator).
3. `AgentStatus` vocabularies.
4. Checkout `BillingPlan`, a deliberate sellable subset.
5. Direct provider fetches in `/api/chat`, the voice routes and
   embeddings (documented in `lib/ai/provider.ts`).

Everything else passed: repository integrity, the secret scan (1
synthetic fixture), the full suite (1,863: 1,856 / 0 / 7), invariants,
schema, the E2E guards, the boundary guards, the Playwright listing, tsc,
and lint on 50 files.

#### FG-01 fix — `/profile` gets an inbound link (founder-approved 2026-09-15)

| Field | Record |
|---|---|
| Target | `app/settings/page.tsx` `ProfileSettings` (`:587-676` at `50346bb`); `app/profile/page.tsx` unchanged |
| Finding | `/profile`, a kept and honest page (the verified account email via `auth.getUser()`, disabled fields with the reason), lost its only inbound link when P2-P03 retired `/privacy/activity` |
| Surface chosen | The Profile section of `/settings`. Settings is in both the desktop and the mobile navigation, and its Profile section is the one place a user looks for their account profile. No navigation entry is added (founder: no unrelated UX change) |
| Change | One `next/link` `Link` to `/profile` ("View your account profile") under the "Profile identity" text; `Link` import added. The existing `/pricing` `<a>` is not touched |
| Not changed | `/privacy/activity` stays retired; FG-02, FG-03 and the duplicate-authority findings stay open |
| Guard | `purification-authorities` P2-P block: `app/profile/page.tsx` exists and at least one product file other than the page itself and `robots.ts` links to it with an `href` (comments stripped) |
| Mutations planned | M1: the link's `href` changed to `/settings`. M2: the link moved into a JSX comment. M3: the link removed |

**Verification** (each step alone, 300 MB gate):

| Step | Result |
|---|---|
| Targeted suites: `purification-authorities`, `fields-are-labelled`, `no-false-claims`, `one-product-language` (the suites that read `app/settings/page.tsx`) | **PASS**: 86 / 86, 0 fail, including "FG-01: /profile is kept and has an inbound product link" |
| Mutations (`scratchpad/mut-fg01.mjs`) | **PASS**: 3 of 3 caught (65 / 1 each; FG-01 fails); `app/settings/page.tsx` restored to `71448E6B1A27` |
| Typecheck (`tsc`, heap 1,536 MB) | **PASS**: exit 0, 0 `error TS` |
| Lint on `tests/security/purification-authorities.test.ts` | **PASS**: 0 problems |
| Lint on `app/settings/page.tsx` | **1 error, pre-existing and not introduced here**: `react-hooks/set-state-in-effect` at `:204`, the settings-load effect. The same error is reported on the unmodified `50346bb` file (`:203`, through `eslint --stdin`). The file was never in Phase 2's lint set (it was not modified in Phase 2). This change adds lines at `:3` and `:628-640` only. Not fixed: out of scope |
| Reachability (`scratchpad/reach.cjs`) | `/profile` ← `app/settings/page.tsx` (plus `robots.ts`). The only other pages without a code reference are `/billing/success` and `/billing/cancel`, which are Stripe return URLs. `/chat/[id]` and `/privacy/activity` remain absent; `/teams/[id]` remains linked |

`syraven-audit.zip` size and mtime unchanged. The three stale final-gate
documents were annotated afterwards, and the fix was committed with them
as `cd24c57` on the founder's instruction (2026-09-15); not pushed.

### Phase 2 final gate re-run (2026-09-15, HEAD `cd24c57`)

Verification only; no code changed. The per-check rows are in
`VERIFICATION_STATE.md` (the "re-run" rows). **Overall: PARTIAL.**

| Area | Result |
|---|---|
| Repository integrity | **PASS**. HEAD `cd24c57`; clean; only `syraven-audit.zip` untracked (excluded, not touched) |
| Secret scan | **PASS**. 1 synthetic fixture (`observability-redaction.test.ts:380`), not a secret |
| Full suite | **PASS**. 1,864: 1,857 pass, 0 fail, 7 todo |
| Invariants and control plane; migrations; E2E guards | **PASS**. 61 / 0 / 7; 185 / 185; 24 / 24 |
| Boundary guards, including `api-auth-boundary` export-shape detection | **PASS**. 412: 405 / 0 / 7 (14 shape tests and 45 sweep tests) |
| Playwright config and production-origin safety | **PASS**. 78 tests listed; no browser; production never visited |
| Typecheck | **PASS**. exit 0 |
| Lint on the 51 Phase 2 files | **PARTIAL**. 50 clean. 1 pre-existing error, `react-hooks/set-state-in-effect` at `app/settings/page.tsx:204`: already present at `50346bb` (`:203`), unrelated to the FG-01 change (lines `:3`, `:628-640`); left unfixed on the founder's instruction |
| Reachability | **PASS**. 44/44 kept pages reachable; FG-01 resolved (`/profile` linked from `/settings`); retired routes still `withAuth` + 410 with no work; `/teams/[id]` linked; `/chat/[id]` and `/privacy/activity` absent |
| Fabrication audit | **PASS**. No new finding |
| Duplicate authorities | **PARTIAL**. The five FG-04 items remain, plus the dead `signOut()` export (FG-03). See the distinction below |
| Production build | **BLOCKED**. Insufficient sustained memory: 365–635 MB sampled; the last attempt was killed at 513 MB start; not attempted |
| Browser / E2E, visual QA | **BLOCKED / NOT RUN**. No current production build |
| Mutation | Not re-run; no guard changed (FG-01 guard 3/3 caught) |
| Phase state | Unchanged: Phase 2 IN PROGRESS, Phase 3 NOT STARTED |

**Documented distinction, surfaced by the broader status-filter rescan
(not a duplicate authority):** two rules on `public.knowledge`, each with
a different purpose.

- **Keyword search visibility**, `["draft", "ready", "active"]`
  (`lib/search/query.ts:200`), decides what a user can *find* through
  `/api/search`. It was set from the statuses the table actually holds,
  after it was verified that no production row was `active`.
- **AI retrieval**, `RETRIEVABLE_STATUSES = ["active"]`
  (`lib/memory/hierarchy.ts`), decides what may *enter AI context*.

That `ready` records are findable but never retrieved is the documented
P2-F07 limitation, and the founder decided (2026-09-14) not to widen
retrieval in Phase 2.

**Still open (founder decisions, not fixed in this pass):**

- FG-02: no sign-out control.
- FG-03: the dead `signOut()` export.
- The FG-04 duplicate authorities.
- The pre-existing settings lint error.
- FG-05: the production build.
- FG-06: browser/E2E and visual QA.
