# SYRAVEN — IMPLEMENTATION PLAN

**Created:** 2026-09-03
**Basis:** `ARCHITECTURE_AUDIT.md` (Phase 0), derived from the actual repository at `68f468c`
**Status:** Proposed — awaiting approval. No implementation has begun.

---

## How this plan differs from the roadmap in the operating protocol

The protocol's §39 roadmap lists 22 phases beginning with rebranding and build stabilization. **This plan reorders them**, as §39 explicitly permits, because the repository facts require it:

| Protocol order | Reality found in audit | This plan |
|---|---|---|
| PHASE 1 — Rebranding | 14 cosmetic strings; zero risk | Deferred to Phase 6 |
| PHASE 2 — Build/TS/Lint stabilization | **Already clean**: 0 TS errors, 0 lint errors | Removed as a phase; kept as a gate |
| PHASE 21 — Security audit (last) | **Live IDOR on `main`** exposing all tenant data | Pulled to Phase 1 |

Rebranding a product whose API serves any user's private data to an anonymous caller would be the wrong order of work. **Security and data-integrity findings come first.**

### Guiding constraints

- Every phase ends green on `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- No phase deletes code before its import graph is verified (protocol §33).
- No phase invents secrets, credentials or destructive database operations (protocol §36/§37).
- Each phase is an independently reviewable change set (protocol §40).

---

## Phase summary

| # | Phase | Priority | Risk if skipped | Depends on |
|---|---|---|---|---|
| 1 | Critical security remediation | **P0 — immediate** | Active data breach + uncapped cost | — |
| 2 | Database reproducibility | **P0** | Cannot rebuild or recover the database | — |
| 3 | Unified auth & authorization boundary | **P1** | Security fixes rot; drift returns | 1, 2 |
| 4 | Service layer reconnection | **P1** | 57k lines stay dead; routes stay unmaintainable | 3 |
| 5 | Usage, rate limiting & entitlements | **P1** | No cost control, no monetization | 3, 4 |
| 6 | Billing hardening & rebranding | **P2** | Duplicate charges; brand inconsistency | 3, 5 |
| 7 | Testing & CI | **P2** | Regressions ship silently | 3–6 |
| 8 | AI provider abstraction | **P2** | Provider lock-in; inconsistent behavior | 4 |
| 9 | Agent orchestration | **P3** | Core differentiator remains a prompt wrapper | 5, 8 |
| 10 | Search & organizational memory | **P3** | Product promise unfulfilled | 4, 8 |
| 11 | Observability & reliability | **P3** | Undiagnosable in production | 3–5 |
| 12 | UX, performance, SEO, docs | **P3** | Polish debt | all |

---

# PHASE 1 — Critical security remediation

**Objective:** Eliminate the three critical vulnerabilities that make the current deployment unsafe to operate.

**Reason:** `ARCHITECTURE_AUDIT.md` §8.1 documents a working IDOR: `GET /api/projects?userId=<any-uuid>` returns any user's projects through the RLS-bypassing service-role client, with no authentication. `PATCH`/`DELETE` are equally exposed, as are `/api/notifications` and `/api/knowledge`. §8.2 documents seven unauthenticated endpoints that spend real money against AI provider keys with caller-controlled token budgets up to 32,768.

**Current state:** 13 of 23 routes have no authentication; 0 of 23 have rate limiting.

**Target state:** Zero unauthenticated routes except genuinely public ones (`auth/register`, `billing/webhook`, health). Identity is derived exclusively from a verified session — never from client input.

**Files likely to change:**
- New: `middleware.ts`, `lib/auth/session.ts` (server session helper), `lib/api/withAuth.ts`
- Modified: `app/api/projects/route.ts`, `app/api/notifications/route.ts`, `app/api/knowledge/route.ts` (remove `?userId=`; derive from session)
- Modified: `app/api/chat/route.ts`, `agents/execute`, `stream`, `files/analyze`, `voice/speak`, `voice/transcribe` (add auth)
- Removed: `app/api/test-openai/route.ts` (debug endpoint, protocol §37)

**Database changes:** None.

**Dependencies:** None. Can start immediately.

**Security considerations:** This *is* the security phase. Guard against fixing the symptom only — the `?userId=` parameter must be **deleted**, not merely validated against the session, so it cannot be reintroduced. Removing `test-openai` requires confirming no internal tooling depends on it.

**Testing requirements:**
- Authorization tests proving user A cannot read/modify/delete user B's projects, notifications or knowledge.
- Tests proving each AI endpoint returns 401 when unauthenticated.
- Manual verification that the existing UI still functions after `?userId=` removal (client callers must be updated in the same change set).

**Risks:** Client components currently pass `userId` explicitly; removing it will break callers not updated together. Mitigate by changing route and callers atomically and testing each affected page.

**Rollback strategy:** Single revertible commit per route family. No schema or data changes, so rollback is clean.

**Definition of done:**
- No route reads identity from a query parameter or request body.
- Every AI-spending endpoint requires a valid session.
- `test-openai` deleted.
- Authorization tests pass; lint, typecheck and build green.

---

# PHASE 2 — Database reproducibility

**Objective:** Bring the 13 untracked production tables under migration control so the database can be rebuilt from the repository.

**Reason:** §9.1 — the live database has 61 tables; migrations create 48. The 13 missing include `profiles` (all billing state: `plan`, `subscription_status`, `stripe_customer_id`) and `usage` (all metering). A fresh environment cannot be provisioned; there is no staging parity and no disaster recovery.

**Current state:** `profiles`, `usage`, `chats`, `messages`, `conversations`, `files`, `memories`, `agents`, `agent_runs`, `agent_tasks`, `agent_conversations`, `agent_messages`, `user_settings` exist only in the hosted project.

**Target state:** A baseline migration reproduces the live schema exactly. RLS gaps closed. `types/database.ts` stored as UTF-8.

**Files likely to change:**
- New: `supabase/migrations/<ts>_baseline_drifted_tables.sql` (additive, `create table if not exists`)
- New: `supabase/migrations/<ts>_rls_coverage.sql`
- Modified: `types/database.ts` (re-encode UTF-8)
- New: `DATABASE.md`

**Database changes:** This phase is entirely database work. **Additive only** — no `drop`, no destructive migration against production. The baseline must be written so that applying it to the existing database is a no-op, and applying it to an empty database reproduces the schema.

Also in scope:
- Enable RLS on `teams` and `usage_events` (§8.8 — currently world-readable with the anon key).
- Add policies for the six deny-all tables, or document why they are intentionally service-role-only (§8.7): `feature_flags`, `organization_feature_flags`, `organization_invites`, `rate_limit_events`, `webhook_deliveries`, `workflow_steps`.
- Resolve the duplicate `handle_updated_at()` definition (§9.3).

**Dependencies:** None. Runs in parallel with Phase 1.

**Security considerations:** Enabling RLS on `teams`/`usage_events` may break code that reads them via the anon key — audit call sites first. Adding policies to currently deny-all tables is a **widening** of access and must be reviewed carefully, not written permissively to "make it work". Never run a destructive migration against production (protocol §37).

**Testing requirements:** Apply all migrations to a **fresh local Supabase instance** and diff the resulting schema against generated types from production. This is the acceptance test.

**Risks:** The generated types show table shapes but not every constraint, index, trigger or policy on the drifted tables. Reconstruction may be incomplete. Mitigate by dumping the live schema (read-only) and reconciling before writing the baseline — do not hand-write from types alone.

**Rollback strategy:** Migrations are additive and idempotent; a failed baseline can be superseded without data loss. Take a database backup before any application to a shared environment.

**Definition of done:**
- `supabase db reset` on a clean instance produces a schema matching production.
- No table lacks a deliberate RLS decision (enabled with policies, or documented exception).
- `types/database.ts` is UTF-8 and regenerable.
- `DATABASE.md` documents the schema and the RLS model.

---

# PHASE 3 — Unified auth & authorization boundary

**Objective:** Replace six duplicated per-route auth helpers with one enforced boundary, and make the RLS-enforced Supabase client the default.

**Reason:** Phase 1 fixes today's holes; this phase prevents tomorrow's. §7 shows six routes each defining a local auth function while `lib/auth.ts` (1,295 lines of RBAC) is imported by nothing. §8.6 shows `supabaseAdmin` used as the default data client, which is why RLS never executes and why a single missing filter became a full breach.

**Current state:** Six local auth helpers; `lib/auth.ts`, `lib/permissions.ts`, `lib/billing/permissions.ts` orphaned; service-role client is the default.

**Target state:** One `withAuth` wrapper handling session verification, org/workspace resolution, Zod validation and error shaping. A request-scoped, RLS-enforcing Supabase client is the default; `supabaseAdmin` requires justification per call site.

**Files likely to change:**
- New: `lib/api/withAuth.ts`, `lib/supabase/server.ts` (user-scoped SSR client)
- Modified: all 23 routes in `app/api/`
- Wired in: `lib/auth.ts`, `lib/permissions.ts`, `lib/security/validation.ts`

**Database changes:** None (relies on Phase 2's RLS coverage).

**Dependencies:** Phases 1 and 2.

**Security considerations:** The highest-value phase for defense in depth. Switching to the RLS-enforced client will surface places where RLS policies are wrong or missing — those are genuine bugs to fix, **not** reasons to revert to `supabaseAdmin`. Each remaining `supabaseAdmin` use must carry a comment justifying it.

**Testing requirements:** Authorization test suite covering role hierarchy, org membership, workspace isolation, and cross-tenant denial for every resource type. This suite becomes the regression net for all later phases.

**Risks:** Touching all 23 routes at once is high-blast-radius. Mitigate by migrating route families incrementally (billing → tasks → knowledge → AI), each its own commit with tests, rather than one sweeping change.

**Rollback strategy:** Per-route-family commits, individually revertible.

**Definition of done:**
- No route implements its own auth.
- Every data route uses the RLS-enforced client unless justified in a comment.
- Authorization tests pass for every resource type.
- Lint, typecheck, build green.

---

# PHASE 4 — Service layer reconnection

**Objective:** Route business logic through the existing `services/` layer; reduce routes to thin controllers.

**Reason:** §6/§7 — all 31 `services/` files (~37,000 lines) plus 14 `lib/` modules are orphaned, while routes re-implement the same concerns inline, producing 1,000–2,000-line route files. This is not merely waste: it is *two divergent implementations* of every domain, and the worse one is the one running.

**Current state:** Only `@/services/action-types` (types) is imported. `services/search.ts` appears solely in a comment.

**Target state:** Routes validate, authorize, delegate to services, and shape responses. Domain logic lives in `services/`.

**Files likely to change:** All `app/api/*/route.ts`; most of `services/`; `lib/security/validation.ts`, `lib/security/audit.ts` wired in.

**Database changes:** None.

**Dependencies:** Phase 3 (services need the auth context to enforce anything).

**Security considerations:** The orphaned services were written against assumptions that may no longer hold — **audit each for authorization checks before trusting it**. Reconnecting a service that assumes a pre-authorized caller, without the boundary from Phase 3, would reintroduce §8.1-class bugs. Never wire a service in without reading it.

**Testing requirements:** Unit tests per service; integration tests per migrated route confirming behavior is unchanged.

**Risks:** Orphaned code has never run — expect latent bugs. Mitigate by migrating one domain at a time, verifying against current behavior, and treating any service that cannot be validated as a **deletion candidate** rather than reconnecting it blindly. Per §33, verify the import graph before deleting anything.

**Rollback strategy:** One domain per commit.

**Definition of done:**
- No route exceeds ~300 lines.
- Every route delegates to a service.
- Each orphaned module is either reconnected, or deleted with justification recorded.
- Misnamed files resolved (`lib/untils.ts`, `Loanding.tsx`, `─ ConversationSearch.tsx`).
- Tests pass; lint, typecheck, build green.

---

# PHASE 5 — Usage, rate limiting & entitlements

**Objective:** Make plan limits real: meter usage, enforce rate limits, gate features by entitlement.

**Reason:** §17 — `lib/plans.ts` (1,519 lines) defines every plan limit and is imported only by the pricing page. Limits are **advertised to users but never enforced**. Combined with §8.2, AI spend is unbounded even after authentication is added.

**Current state:** 0 of 23 routes rate-limit; 0 record usage. `services/usage.server.ts` (2,520 lines) and `lib/billing/permissions.ts` are orphaned. A `rate_limit_events` table exists and nothing writes to it.

**Target state:** Every AI/compute route checks entitlement before executing and records usage after. Rate limits enforced per user and per plan. Usage visible to users.

**Files likely to change:**
- Modified: all AI routes; `lib/plans.ts`, `lib/billing/permissions.ts`, `services/usage.server.ts` wired in
- New: `lib/rate-limit.ts`
- Modified: `app/api/usage/route.ts` (read from the metering the system now actually writes)

**Database changes:** Use `usage`, `usage_events`, `ai_model_usage`, `ai_budgets`, `rate_limit_events` — all exist after Phase 2. Verify indexes support aggregation queries; add if not.

**Dependencies:** Phases 3, 4.

**Security considerations:** Rate limiting is itself an abuse-prevention control — it must be enforced server-side and keyed on verified session identity, never on client-supplied values or IP alone. Caller-controlled `maxTokens` (up to 32,768) must be clamped by plan entitlement, not merely by the current hard cap. Usage recording must not be bypassable by aborting the request mid-flight.

**Testing requirements:** Unit tests for limit calculations and entitlement resolution (protocol §29 names these explicitly). Integration tests proving a user at their limit is refused, and that usage is recorded even on partial/streamed responses.

**Risks:** Enforcing limits on existing users could disrupt current usage. Mitigate by shipping in observe-only mode first (record, log, do not block), reviewing real data, then enabling enforcement.

**Definition of done:**
- Every AI route checks entitlement and records usage.
- Rate limits enforced and tested.
- `/api/usage` reflects real recorded data.
- Users can see their own usage.

---

# PHASE 6 — Billing hardening & rebranding

**Objective:** Make webhook processing idempotent and plan resolution authoritative; finish the SYRAVEN rebrand.

**Reason:** §8.4 — Stripe guarantees at-least-once delivery and the webhook stores no `event.id`, so a redelivered `checkout.session.completed` re-applies billing side effects, violating protocol §24. §8.5 — `handleCheckoutCompleted` trusts `session.metadata.plan` without reconciling against the purchased price, while `handleSubscriptionUpdated` is stricter; the two paths disagree. §17 of the audit — 14 user-facing `NOVA` strings remain in `app/pricing/page.tsx` and `lib/plans.ts`.

**Current state:** Signature verification correct; no idempotency; no billing audit trail (`transactions`/`subscription_events` unused); `invoice.payment_succeeded` unhandled.

**Target state:** Every webhook event recorded and processed exactly once. Plan derived from the actual Stripe price, with metadata as a hint only. Full billing audit trail. Brand consistent.

**Files likely to change:** `app/api/billing/webhook/route.ts`, `services/billing.ts` (wire in), `app/pricing/page.tsx`, `lib/plans.ts`; new `BILLING.md`.

**Database changes:** A processed-events table for idempotency (unique on Stripe `event.id`); persistence for subscription events and transactions.

**Dependencies:** Phases 3, 5.

**Security considerations:** Billing state must remain authoritative on the server and reconciled with Stripe (protocol §16). Never trust client-side payment status. Idempotency keys must be the Stripe event ID, stored transactionally with the side effect — otherwise a crash between the two reintroduces double-processing.

**Testing requirements:** Webhook tests including **replayed events** (the specific §24 requirement), signature failure, out-of-order delivery, and plan resolution for each price ID.

**Risks:** Billing changes affect real money. Test against Stripe test mode only. Do not perform real payments or invent credentials (protocol §36/§37). Rebranding must not rename Stripe price IDs, database columns or env var names — product-facing strings only (protocol §3).

**Rollback strategy:** Idempotency is additive and safe to revert. Rebranding is cosmetic and isolated.

**Definition of done:**
- Replayed webhooks produce exactly one side effect (test-proven).
- Plan resolution reconciles against the purchased price on all paths.
- Billing audit trail persisted.
- Zero user-facing `NOVA`/`Qelvora` strings; no technical identifiers renamed.

---

# PHASE 7 — Testing & CI

**Objective:** Establish the test suite and automated verification the repository has never had.

**Reason:** §23 — zero tests, no runner, no CI. This is *how* a complete IDOR reached `main` undetected. Protocol §29 requires critical security flows to be tested.

**Note on sequencing:** Phases 1–6 each specify their own tests. This phase formalizes the harness and CI. In practice the runner should be introduced *during Phase 1* so security fixes ship with regression protection; Phase 7 then broadens coverage and enforces it in CI.

**Current state:** No test infrastructure.

**Target state:** Unit tests for entitlements, limits, auth helpers and billing math; integration tests for auth, API, webhooks; E2E for signup → login → workspace → project → AI → upgrade. CI runs lint, typecheck, build and tests on every push.

**Files likely to change:** New `.github/workflows/ci.yml`; test config; test files alongside sources.

**Dependencies:** Phases 3–6 (stable interfaces to test).

**Security considerations:** Authorization and tenant-isolation tests are the highest-value assets here. CI must never expose secrets in logs; use repository secrets and test-mode keys only.

**Testing requirements:** Per protocol §29 — **no fake tests that merely make the suite pass.**

**Risks:** Test-writing can become unbounded. Mitigate by prioritizing: security flows first, then billing, then everything else.

**Definition of done:**
- `npm test` exists and passes.
- Cross-tenant access is test-proven impossible for every resource.
- CI green on `main` and required for merge.

---

# PHASE 8 — AI provider abstraction

**Objective:** Consolidate provider access behind one abstraction with model routing.

**Reason:** §13 — `lib/ai/router.ts` (1,035 lines), `models.ts`, `prompts.ts`, `groq.ts` are all orphaned while every route hand-rolls `fetch`. `/api/chat` defaults to OpenAI, `/api/agents/execute` to Groq; env vars are inconsistent (`AI_API_KEY` / `OPENAI_API_KEY` / `GROQ_API_KEY` / `SYRAVEN_AI_MODEL`). The `openai` SDK is installed and never used.

**Current state:** Duplicated provider logic across six routes.

**Target state:** One `AIProvider` abstraction; consistent fallback; model routing by tier (cheap/balanced/reasoning/premium) bound to entitlements from Phase 5; token usage persisted to `ai_model_usage`.

**Files likely to change:** `lib/ai/*` (wire in), all AI routes, `services/ai.server.ts`; new `AI_ARCHITECTURE.md`.

**Database changes:** Populate `ai_model_usage`, `ai_budgets`.

**Dependencies:** Phase 4; integrates with Phase 5.

**Security considerations:** Model selection and token budgets must be entitlement-bound, not caller-controlled (currently `maxTokens` up to 32,768 from the request body). Address prompt injection: knowledge context is concatenated directly into the system prompt at `app/api/chat/route.ts:235` — retrieved content must be delimited and treated as untrusted data.

**Testing requirements:** Provider fallback, timeout, malformed-response handling; entitlement-bound model selection.

**Risks:** Changing provider behavior can regress response quality. Mitigate by preserving current defaults per route initially, then unifying deliberately.

**Definition of done:**
- No route calls a provider directly.
- Provider addable without touching domain logic.
- Token usage persisted; prompt-injection boundary documented.

---

# PHASE 9 — Agent orchestration

**Objective:** Turn agents from single LLM calls into a real execution system.

**Reason:** §14 — `/api/agents/execute` is one stateless completion: no tools, no planning, no state, no retry, no budget, no permissions. The schema already provides `ai_agent_executions`, `ai_execution_steps`, `ai_tool_executions`, `ai_agent_permissions`, `ai_budgets`. This is the product's core differentiator (protocol §2, §7).

**Current state:** 13 agent definitions; registry loads 10; UI references 2 the registry omits.

**Target state:** Agents plan, use tools, persist execution state, retry recoverable failures, respect budgets and timeouts, request human approval for critical actions, and record full run history.

**Files likely to change:** New `lib/agents/orchestrator.ts`, `lib/agents/tools/`; modified `app/api/agents/execute/route.ts`, `lib/agents/registry.ts`, `services/agents.ts`.

**Database changes:** Use the existing AI execution tables.

**Dependencies:** Phases 5, 8.

**Security considerations:** **The defining constraint (protocol §7): an agent must never exceed the permissions of the user or service context that authorized it, and permissions must be revalidated at execution boundaries** — not merely checked once at dispatch. Tool execution is the highest-risk surface in the entire product: every tool needs an explicit permission, budget and timeout, and side-effecting tools must be idempotent so a retry cannot execute a dangerous external action twice (protocol §24). Human-in-the-loop approval (protocol §8) is required for payments, deletion, external communications and high-cost operations.

**Testing requirements:** Permission-boundary tests (an agent cannot exceed its authorizing user); retry-safety tests for side-effecting tools; approval-flow tests.

**Risks:** Highest-risk phase in the plan — agents take real actions. Mitigate by starting with read-only tools, requiring approval for all side effects initially, and relaxing only with evidence.

**Definition of done:**
- Execution state persisted and inspectable.
- Permission boundary enforced and test-proven.
- Approval flow works for critical actions.
- Registry and UI agree on the agent roster.

---

# PHASE 10 — Search & organizational memory

**Objective:** Replace the search stub with real permission-aware search; begin organizational memory retrieval.

**Reason:** §19 — `app/api/search/route.ts:280` returns hardcoded `[]` while `services/search.ts` (1,919 lines) implements real search and is referenced only in a comment. `ai_knowledge_chunks` supports vector search and is unused. Organizational memory is a stated core differentiator (protocol §6).

**Current state:** Search returns nothing. No ingestion or retrieval pipeline.

**Target state:** Permission-aware search across projects, tasks, documents, knowledge, messages and agent runs, with a clean abstraction for semantic search.

**Files likely to change:** `app/api/search/route.ts`, `services/search.ts`, `lib/knowledge/search.ts`, `services/knowledge.ts`; new ingestion pipeline.

**Database changes:** Vector index configuration on `ai_knowledge_chunks`; verify embedding storage.

**Dependencies:** Phases 4, 8.

**Security considerations:** **Search is the easiest place to leak cross-tenant data.** Every result must be authorization-filtered at query time, not filtered after retrieval, and never ranked across tenants. Memory must be permission-aware, tenant-isolated and auditable (protocol §6). Retrieved content fed to an LLM is untrusted input — see Phase 8's injection boundary.

**Testing requirements:** Cross-tenant search-isolation tests are mandatory before this ships.

**Risks:** Embedding costs and latency. Mitigate by scoping ingestion to explicitly authorized sources and measuring before broadening.

**Definition of done:**
- Search returns real, authorization-filtered results.
- Cross-tenant isolation test-proven.
- Retrieval abstraction supports semantic search without leaking into domain logic.

---

# PHASE 11 — Observability & reliability

**Objective:** Make production diagnosable and background work durable.

**Reason:** §20/§11 — logging is bare `console.*`; `lib/security/audit.ts` (945 lines) is orphaned; there is no error tracking, tracing, health check or metrics. `lib/tasks/scheduler.ts:242` keeps task state in an in-memory `Map` with `setTimeout` — **state is lost on restart and the design does not work on serverless at all.** A `jobs` table exists with no worker.

**Current state:** No observability; no durable background execution.

**Target state:** Structured logging, error tracking, request and AI-execution tracing, audit logs, health checks; durable queue-backed jobs with timeout, retry, backoff, idempotency and dead-letter handling.

**Files likely to change:** New `lib/observability/`; `lib/security/audit.ts` (wire in); `lib/tasks/scheduler.ts` (replace in-memory model); new health endpoint.

**Database changes:** Use `audit_logs`, `jobs`, `system_events`, `webhook_deliveries`.

**Dependencies:** Phases 3–5.

**Security considerations:** Logs must never contain secrets, tokens or full request bodies (protocol §34). Audit logs are a security control — they must be append-only and tamper-evident, and must record actor, action, resource and outcome. Per protocol §23, a failed agent run must be reconstructable: what happened, where, why, what was attempted, what the system did next.

**Testing requirements:** Retry/idempotency tests; verification that no secret reaches logs.

**Risks:** Replacing the scheduler affects any dependent feature — but since it is currently in-memory and effectively non-functional in production, risk is low.

**Definition of done:**
- Structured logs with correlation IDs.
- Audit logging active on security-relevant actions.
- Background jobs survive restart.
- Health check live; no secrets in logs.

---

# PHASE 12 — UX, performance, SEO & documentation

**Objective:** Production polish.

**Reason:** §12/§24 — no `loading.tsx`, `error.tsx` or `not-found.tsx` anywhere; 78 near-universally client components in a Next.js 16 App Router app; `public/` holds only stock Next.js SVGs (no favicon set, OG image or manifest); every document required by protocol §38 is missing; `AGENTS.md` inaccurately describes the layout (§24).

**Current state:** Functional UI; no loading/error/empty-state boundaries; docs absent or wrong.

**Target state:** Proper App Router boundaries; RSC where beneficial; accessibility (keyboard nav, focus states, ARIA, contrast); responsive across phone/tablet/desktop; complete SEO assets with dashboard pages excluded from indexing; documentation matching the implementation.

**Files likely to change:** `app/**/loading.tsx`, `error.tsx`, `not-found.tsx`; components; `public/`; new `ARCHITECTURE.md`, `SECURITY.md`, `DEPLOYMENT.md`, `PRODUCTION_READINESS.md`, `.env.example`; corrected `AGENTS.md`.

**Database changes:** None.

**Dependencies:** All prior phases.

**Security considerations:** Private dashboard routes must not be indexed (protocol §27). Error UI must not leak internal details to users while remaining useful to developers via secure logging (protocol §28). `.env.example` must contain **names only, never values** (protocol §34/§37).

**Testing requirements:** E2E for critical flows; accessibility and responsive checks.

**Risks:** Low. Largely additive.

**Definition of done:**
- Loading/error/empty states on all critical interfaces.
- Accessibility and responsive targets met.
- SEO assets complete; private pages excluded.
- All protocol §38 documents exist and reflect reality — no fictional capabilities.
- `PRODUCTION_READINESS.md` marked from evidence only.

---

## Immediate next actions (highest priority)

If only three things are done next, they are:

1. **Fix the IDOR** — `app/api/{projects,notifications,knowledge}/route.ts` currently serve and mutate any user's data to anonymous callers. This is live on `main`.
2. **Authenticate the AI endpoints** — seven unauthenticated routes spend real money with caller-controlled token budgets.
3. **Baseline the 13 drifted tables** — until then the database cannot be rebuilt, and `profiles` (all billing state) exists only in the hosted project.

Items 1 and 2 are Phase 1; item 3 is Phase 2. They are independent and can proceed in parallel.

---

## Explicitly out of scope for now

Per protocol §39 ("a roadmap, not a command to blindly implement everything"), the following are **not** planned until the repository demonstrates need:

- Additional integrations beyond the five already stubbed in `services/integrations/` — none are currently reachable; connecting the existing ones precedes adding more.
- The referral system (protocol §17) — no code, no tables, no evidenced demand.
- Provider expansion beyond OpenAI/Groq — the abstraction (Phase 8) makes this cheap later; adding providers now would be feature count, not value.
- Creating tables from the protocol §9 list that the product does not yet use.
