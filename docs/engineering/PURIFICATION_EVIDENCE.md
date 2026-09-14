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

### Later groups

Recorded as each batch is prepared: dependencies (P2-D), fabricated UI
(P2-E), duplicate authorities (P2-F), routes (P2-G), documentation (P2-H).
