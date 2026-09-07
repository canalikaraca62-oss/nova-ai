# SYRAVEN — ARCHITECTURE AUDIT (PHASE 0)

**Audit date:** 2026-09-03
**Repository:** `canalikaraca62-oss/nova-ai` (product: SYRAVEN)
**Branch:** `main` @ `68f468c`
**Auditor:** Phase 0 architecture audit — read-only, no implementation changes

---

## 0. How to read this document

Findings are classified as:

| Status | Meaning |
|---|---|
| **IMPLEMENTED** | Verified working in the repository |
| **PARTIALLY IMPLEMENTED** | Exists but incomplete or not wired end-to-end |
| **MISSING** | Does not exist |
| **BROKEN** | Exists but does not function / references non-existent resources |
| **RISKY** | Functions, but creates a security, correctness or operational hazard |
| **UNKNOWN** | Could not be determined from the repository alone |

**Nothing in this document is claimed as implemented unless the repository proves it.** Every claim below is backed by a file path and, where relevant, a line number.

---

## 1. Current architecture

### 1.1 Verified stack

Read from `package.json`:

| Component | Version | Notes |
|---|---|---|
| Next.js | `^16.0.0` | App Router |
| React | `^19.0.0` | |
| TypeScript | `^5.7.2` | `strict: true` + `noUncheckedIndexedAccess` |
| Supabase JS | `^2.49.0` | plus `@supabase/ssr ^0.7.0` |
| Stripe | `^17.6.0` | |
| Zod | `^3.24.2` | present, used in **exactly one** file |
| Tailwind CSS | `^4.3.3` | via `@tailwindcss/postcss` |
| OpenAI SDK | `^4.80.0` | installed but **never imported** |

Node `>=20.9.0`, npm `>=10.0.0`.

### 1.2 Actual directory layout

The layout **differs from what `AGENTS.md` documents**. `AGENTS.md` describes `components/`, `contexts/`, `hooks/` at the repository root; they are actually nested under `app/`.

```text
/
├── app/
│   ├── api/                  # 24 route files
│   ├── components/           # 78 components  (AGENTS.md says /components)
│   ├── context/              # 7 contexts     (AGENTS.md says /contexts)
│   ├── hooks/                # 12 hooks       (AGENTS.md says /hooks)
│   └── <42 page routes>
├── lib/                      # 40 files  — infrastructure
├── services/                 # 31 files  — business/service layer
├── types/                    # 13 files  — domain + generated DB types
├── supabase/migrations/      # 3 migrations
└── public/                   # 5 default Next.js SVGs only
```

**Scale:** ~230 TypeScript source files. `services/` alone is ~37,000 lines; `lib/` ~20,900 lines.

### 1.3 The defining structural fact

> **The `services/` layer and most of `lib/` are not connected to the application.**

Across `app/`, `lib/`, `services/` and `types/`, the complete set of internal `@/`-prefixed imports is only **six specifiers**:

```text
@/lib/plans              → imported only by app/pricing/page.tsx
@/lib/supabase/json
@/lib/supabaseAdmin
@/services/action-types  → types only, by app/api/action/route.ts
@/services/search        → appears ONLY inside a comment (app/api/search/route.ts:269)
@/types/database
```

This is the single most consequential finding in the audit and it shapes every recommendation that follows. See §7.

### 1.4 Request/data flow as actually implemented

```text
Browser (client components, "use client")
    │
    │  fetch() to /api/*
    ▼
app/api/*/route.ts   ← self-contained: each route re-implements
    │                   auth, validation, provider calls, DB access
    │
    ├─► supabaseAdmin (SERVICE ROLE — bypasses RLS)   ← used by most data routes
    │
    └─► fetch() directly to OpenAI / Groq HTTP APIs
```

There is **no service layer in the request path**, **no middleware**, and **no shared authorization helper**. Each route is an island.

---

## 2. Existing features

**IMPLEMENTED (verified working):**

| Feature | Evidence |
|---|---|
| TypeScript strict mode compiles clean | `npx tsc --noEmit` → **0 errors** |
| ESLint passes clean | `npm run lint` → **0 errors, 0 warnings** |
| Registration flow with Zod validation | `app/api/auth/register/route.ts` (1334 lines) — the only validated route |
| Stripe webhook signature verification | `app/api/billing/webhook/route.ts:1092` `constructEvent` |
| Stripe checkout + billing portal, authenticated | `app/api/billing/checkout/route.ts:140`, `portal/route.ts:61` |
| Multi-provider AI chat w/ fallback + SSE streaming | `app/api/chat/route.ts` |
| Server-only guard on admin client | `lib/supabaseAdmin.ts:23` `import "server-only"` |
| Lazy Proxy-based Supabase clients (no build-time crash) | `lib/supabase.ts:170`, `lib/supabaseAdmin.ts:231` |
| SEO scaffolding | `app/robots.ts`, `app/sitemap.ts` |
| Git secret hygiene | `.env.local` correctly gitignored and untracked |
| Enterprise DB schema (48 tables) | 3 migrations, 3,849 lines total |
| Husky pre-commit hooks | `.husky/` present |

**Environment boundary is clean (verified):** only three `NEXT_PUBLIC_*` variables exist (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`). `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` and all AI keys are server-only, and `supabaseAdmin` is **not** imported by any component, context or hook. No secret leaks into the client bundle.

---

## 3. Partially implemented features

| Feature | Status | Evidence |
|---|---|---|
| Authentication | **PARTIALLY** — works, but unenforced at boundaries | `AuthContext` + register/login exist; **no `middleware.ts`**, no route guards |
| Authorization | **PARTIALLY** | `lib/auth.ts` has a full RBAC model — but it is *types + pure functions only*, imported by nothing |
| Usage tracking | **PARTIALLY / BROKEN** | `/api/usage` reads a `usage` table with **no migration** |
| Billing | **PARTIALLY** | Webhook verifies signatures but has **no idempotency**; writes to `profiles`, which has **no migration** |
| Agent system | **PARTIALLY** | 13 agent definition files; registry imports only **10**. Execution is a single stateless LLM call — no tools, no state, no persistence |
| Knowledge / RAG | **PARTIALLY** | Rich schema (`ai_knowledge_chunks`, embeddings) exists; no ingestion or retrieval pipeline is wired |
| Search | **BROKEN / STUB** | `app/api/search/route.ts:280` returns hardcoded `results: []` |
| Rebranding | **PARTIALLY (~95%)** | 14 user-facing `NOVA` strings remain (§17) |

---

## 4. Missing features

**MISSING — confirmed absent:**

- `middleware.ts` — **no route-level authentication anywhere in the application**
- Any test file, test runner, or test script (`package.json` has no `test` script)
- Any CI/CD configuration (no `.github/`)
- `.env.example` (gitignore at line 37 explicitly whitelists `!.env.example`, but the file was never created)
- Rate limiting implementation (a `rate_limit_events` **table** exists; nothing writes to it)
- Idempotency for Stripe webhooks
- Structured logging / error tracking / tracing (only bare `console.*`)
- Health-check endpoint
- Referral system (no code, no tables)
- AI provider abstraction (each route hand-rolls its own `fetch`)
- Organizational memory retrieval (tables exist; no code path)
- Human-in-the-loop approval (`/api/action` returns `pending_confirmation` but no approval store exists)
- Vector/semantic search (`ai_knowledge_chunks` exists; unused)
- Documentation: `ARCHITECTURE.md`, `SECURITY.md`, `DATABASE.md`, `AI_ARCHITECTURE.md`, `BILLING.md`, `DEPLOYMENT.md`, `PRODUCTION_READINESS.md`

---

## 5. Broken imports

**None.** TypeScript resolves every import; `tsc --noEmit` returns 0 errors.

The problem is the inverse of broken imports: **modules that are never imported at all** (§7).

One structural anomaly: a file literally named
`app/components/chat/─ ConversationSearch.tsx` — the filename begins with a U+2500 box-drawing character and a space, presumably pasted from a tree diagram. It is tracked in git and imported by nothing.

---

## 6. Dead code candidates

### 6.1 Orphaned `services/` — 31 of 31 files (~37,000 lines)

Every file under `services/` is unreferenced except `action-types.ts` (types only). This includes:

`action-executor.ts`, `action-parser.ts`, `agents.ts`, `ai.server.ts`, `ai.ts`, `billing.ts`, `canvas.ts`, `chats.ts`, `file.ts`, `knowledge.ts`, `messages.ts`, `notifications.ts`, `projects.ts`, `search.ts`, `storage.ts`, `tasks.ts`, `usage.server.ts` (2,520 lines), `usage.ts`, `vision.server.ts`, `voice.ts`, all 5 `document-reader/*`, all 6 `integrations/*` (Slack, GitHub, Gmail, Notion, Calendar — ~6,000 lines of integration code reachable by nothing).

### 6.2 Orphaned `lib/` — 14 files

`lib/permissions.ts`, `lib/constants.ts`, `lib/billing/permissions.ts`, `lib/security/audit.ts` (945 lines), `lib/security/validation.ts` (1,480 lines), `lib/ai/router.ts` (1,035 lines), `lib/ai/models.ts`, `lib/ai/prompts.ts`, `lib/ai/groq.ts`, `lib/knowledge/search.ts`, `lib/agents/defaults.ts`, `lib/agents/{study,website,writing}-agent.ts`.

> The two files named `security/*` — the audit-logging and input-validation infrastructure — are among the dead modules. The security layer exists as source code but is not in any execution path.

### 6.3 Misnamed / stray files

| File | Issue |
|---|---|
| `lib/untils.ts` (521 lines) | typo for `utils.ts`; imported by nothing. `AGENTS.md` documents `lib/utils.ts`, which does not exist |
| `app/components/ui/Loanding.tsx` | typo for `Loading.tsx`; imported by nothing |
| `app/components/chat/─ ConversationSearch.tsx` | box-drawing char in filename; unused |
| `all-errors.txt`, `structure.txt`, `tailwind-test.css` (121 KB) | build/debug artifacts committed to git |
| `tsconfig.tsbuildinfo` (1.1 MB) | build cache on disk |

**Do not delete any of the above during Phase 0.** §33 of the operating protocol requires import-graph verification first; several orphaned modules are *intended* architecture (see §26 — they are assets, not merely waste).

---

## 7. Duplicate implementations

The orphaned `services/` layer is not dead weight — it is a **parallel, more complete implementation** of what the API routes re-implement inline, badly.

| Concern | Orphaned implementation | What actually runs |
|---|---|---|
| Usage metering | `services/usage.server.ts` (2,520 lines) | ad-hoc reads in `/api/usage` |
| Projects | `services/projects.ts` (2,112 lines) | inline queries in `/api/projects` |
| Notifications | `services/notifications.ts` (2,032 lines) | inline queries in `/api/notifications` |
| Search | `services/search.ts` (1,919 lines) | **stub returning `[]`** |
| Auth/RBAC | `lib/auth.ts` (1,295 lines) | 6 hand-rolled per-route auth functions |
| Validation | `lib/security/validation.ts` (1,480 lines) | manual `typeof` checks per route |
| Audit logging | `lib/security/audit.ts` (945 lines) | `console.log` |
| Plans/entitlements | `lib/plans.ts` (1,519 lines) | **nothing enforces entitlements** |
| AI routing | `lib/ai/router.ts` (1,035 lines) | hand-rolled `fetch` per route |

**Duplicated auth logic:** 6 routes each define their own local authentication function (`app/api/{agents,files/upload,knowledge/search,tasks/execute,tasks,usage}/route.ts`), while `lib/auth.ts` — the designed helper — is used by none of them.

**Route file sizes** reflect this inlining: `tasks/route.ts` 1,985 lines; `auth/register` 1,334; `usage` 1,245; `tasks/execute` 1,239; `billing/webhook` 1,205; `knowledge/search` 1,188; `files/analyze` 1,069.

---

## 8. Security risks

> Per the operating protocol §10, no claim of "100% secure" is made. These are concrete, evidenced findings.

### 8.1 CRITICAL — Insecure Direct Object Reference (IDOR) via `userId` query parameter

**`app/api/projects/route.ts`, `app/api/notifications/route.ts`, `app/api/knowledge/route.ts` contain no authentication of any kind.** They accept the caller's identity as a **URL query parameter** and then query using the **service-role client, which bypasses RLS**.

`app/api/projects/route.ts:283-334`:

```ts
const userId = normalizeString(searchParams.get("userId"), 200);
if (!userId) return jsonError("userId is required.", 400);
// ...
let query = supabaseAdmin              // ← service role: RLS BYPASSED
  .from("projects")
  .select(PROJECT_SELECT, { count: "exact" })
  .eq("user_id", userId);              // ← attacker-controlled
```

Any unauthenticated party can read, and via `PATCH`/`DELETE` modify or destroy, **any user's** projects, notifications and knowledge by supplying a `userId`. This is a complete tenant-isolation failure and the single highest-severity finding in this audit.

### 8.2 CRITICAL — Unauthenticated, unmetered AI endpoints (direct financial loss)

These routes require **no authentication** and enforce **no usage limits**, yet spend money against `OPENAI_API_KEY` / `GROQ_API_KEY`:

| Route | Exposure |
|---|---|
| `app/api/chat/route.ts` | up to 16,000 `max_tokens` per call, caller-controlled |
| `app/api/agents/execute/route.ts` | up to 32,768 `max_tokens` per call, caller-controlled |
| `app/api/stream/route.ts` | streaming LLM |
| `app/api/files/analyze/route.ts` | vision/analysis |
| `app/api/voice/speak/route.ts` | TTS |
| `app/api/voice/transcribe/route.ts` | STT |
| `app/api/test-openai/route.ts` | debug endpoint, live key, shipped to production |

An anonymous script can drain the AI budget. There is **no rate limiting anywhere in the codebase**.

### 8.3 CRITICAL — No route-level authentication

`middleware.ts` does not exist. `app/dashboard/layout.tsx` is a client component that renders `WorkspaceProvider` with **no session check**. All protection is client-side rendering logic, which is not a security control.

### 8.4 HIGH — Stripe webhook has no idempotency

`app/api/billing/webhook/route.ts` verifies signatures correctly (line 1092) but does not record `event.id`. Stripe **guarantees at-least-once delivery**; a redelivered `checkout.session.completed` re-runs `updateBilling` unconditionally. This directly violates operating-protocol §24 ("A webhook delivered twice must not create two billing side effects").

### 8.5 HIGH — Plan can be set from client-controlled checkout metadata

`app/api/billing/webhook/route.ts:693-700`:

```ts
const metadataPlan = getPlanFromMetadata(session.metadata);
const plan = metadataPlan ?? "free";
```

`handleCheckoutCompleted` trusts `session.metadata.plan` and never reconciles it against the actual purchased Stripe price. If checkout metadata can be influenced, a user may obtain a higher plan than paid for. Note `handleSubscriptionUpdated` is stricter (it falls through to `getPlanFromPriceId`) — the two paths are inconsistent.

### 8.6 HIGH — Service-role client used as the default data client

`supabaseAdmin` (RLS-bypassing) is the data client in `/api/{projects,notifications,knowledge,tasks,usage,files/upload,knowledge/search}`. Consequently the RLS policies written in the migrations **never execute for application traffic**. Defense-in-depth is absent: a single missing `.eq("user_id", …)` becomes a full data breach, as §8.1 demonstrates.

### 8.7 MEDIUM — Six tables have RLS enabled but zero policies

In `20260901154222_syraven_enterprise_core.sql`, RLS is enabled on 18 tables but only 12 have policies. These six are therefore **deny-all** to normal clients:

`feature_flags`, `organization_feature_flags`, `organization_invites`, `rate_limit_events`, `webhook_deliveries`, `workflow_steps`

Not a breach risk, but organization invites and feature flags are silently unreachable — a latent functional break.

### 8.8 MEDIUM — Tables with RLS never enabled

`teams` and `usage_events` (`20260901165535_syraven_missing_app_tables.sql`) are created but never receive `enable row level security` — that migration enables RLS on only `knowledge`, `notifications` and `tasks`. With the anon key, `teams` and `usage_events` are world-readable.

### 8.9 MEDIUM — No input-validation layer

Zod is a dependency but appears in exactly one file (`app/api/auth/register/route.ts:39`). All other routes hand-roll `typeof` checks. `lib/security/validation.ts` (1,480 lines) exists to solve this and is imported by nothing.

### 8.10 LOW — Debug endpoint in production

`app/api/test-openai/route.ts` exposes `GET`/`POST` that report provider configuration and issue live API calls. It should not ship.

---

## 9. Database risks

### 9.1 CRITICAL — 13 production tables have no migration (schema drift)

Comparing generated types in `types/database.ts` (the live schema) against all 3 migrations:

- **Live database: 61 tables**
- **Migrations create: 48 tables**
- **Untracked in migrations (13):**

```text
agent_conversations   agent_messages   agent_runs   agent_tasks
agents                chats            conversations  files
memories              messages         profiles       usage
user_settings
```

These were created manually against the hosted project. Consequences:

- **The database cannot be rebuilt from the repository.** A fresh environment will lack `profiles` and `usage`.
- `profiles` holds `plan`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id` — **all billing state lives in an untracked table.**
- `usage` backs the entire metering endpoint.
- Disaster recovery, staging parity and review environments are all currently impossible.

Only `supabase/.temp/linked-project.json` ties the repo to the live project.

### 9.2 HIGH — `types/database.ts` is UTF-16LE encoded

The file is 3,207 lines of correctly generated Supabase types, but stored as **UTF-16LE with a BOM** (Supabase CLI on Windows PowerShell redirect). It compiles, but it breaks `grep`, diffs and most tooling, and will corrupt on regeneration. Should be UTF-8.

### 9.3 MEDIUM — Two conflicting `handle_updated_at()` definitions

`create or replace function public.handle_updated_at()` appears in both `20260901154222_…:20` and `20260901165535_…:286`. The later migration silently redefines the function for every earlier trigger. Currently benign (bodies match) but fragile.

### 9.4 MEDIUM — Migration timestamps are dated in the future

All three migrations are stamped `202609…` (September 2026) while the audit date is 2026-09-03 and commits date from Aug–Sep. Ordering works, but the convention is unreliable.

### 9.5 Schema quality — a genuine strength

Within the 48 migrated tables, quality is high: proper FKs, `on delete` behaviour, check constraints, unique constraints, indexes, `updated_at` triggers, and `security definer` helper functions (`is_organization_member`, `is_organization_admin`, `is_organization_owner`). This schema is a real asset.

---

## 10. Multi-tenancy risks

**Status: RISKY — tenant isolation is designed but not enforced.**

The intended model is present in the schema (`organizations` → `organization_members` → `workspaces` → `projects`, with RLS policies referencing `is_organization_member`).

It is defeated in practice because:

1. Application traffic uses `supabaseAdmin`, which bypasses RLS entirely (§8.6).
2. Tenant identity is taken from client input (`?userId=`) rather than a verified session (§8.1).
3. `lib/auth.ts` — which models `organizationId`, `belongsToOrganization()` and `ROLE_HIERARCHY` — is imported by nothing.
4. No API route resolves an organization or workspace membership before returning data.

There is currently **no enforced workspace isolation** in the running application.

---

## 11. Scalability risks

| Risk | Evidence |
|---|---|
| **In-memory task scheduler** | `lib/tasks/scheduler.ts:242-249` — `Map`-based state + `setTimeout`. State is lost on restart and is per-instance; on serverless it does not work at all |
| **In-process singletons** | `lib/supabase.ts:116`, `lib/supabaseAdmin.ts:177` — fine for clients, but the pattern is extended to stateful concerns elsewhere |
| **No job queue** | A `jobs` table exists; no worker, no dequeue logic |
| **No caching layer** | Every request hits Postgres or a provider directly |
| **Unbounded LLM concurrency** | No queue, no concurrency cap, no budget ceiling |
| **`select("*")`-style projections** | Broad selects in list endpoints without column narrowing in several routes |

---

## 12. Performance risks

- No `loading.tsx` / `error.tsx` / `not-found.tsx` files exist anywhere in `app/` — no streaming boundaries, no App-Router error isolation.
- Heavy client-side composition: 78 components, nearly all `"use client"`; minimal use of React Server Components despite Next.js 16.
- `tailwind-test.css` (121 KB) committed; `app/globals.css` should be verified as the only stylesheet in the bundle.
- `public/` contains only the 5 stock Next.js SVGs — **no favicon set, no OG image, no manifest** (`app/favicon.ico` exists).
- Pagination exists in list routes (`limit`/`offset`) — good.
- Provider calls carry a 120s timeout (`app/api/chat/route.ts:444`) — good.

---

## 13. AI architecture

**Status: PARTIALLY IMPLEMENTED — functional but architecturally uncontrolled.**

**What works:** `/api/chat` supports OpenAI + Groq, automatic cross-provider fallback, SSE streaming, knowledge-context injection, and a strong SYRAVEN system prompt that explicitly forbids fabricating actions.

**Problems:**

1. **No provider abstraction.** `lib/ai/router.ts`, `lib/ai/models.ts`, `lib/ai/prompts.ts`, `lib/ai/groq.ts` all exist and are all orphaned. Meanwhile each route hand-rolls `fetch` against provider URLs. The `openai` SDK is installed and never imported.
2. **Inconsistent provider defaults.** `/api/chat` defaults to OpenAI (`gpt-4o-mini`); `/api/agents/execute` defaults to Groq (`llama-3.3-70b-versatile`). Different routes, different fallback chains, different env vars (`AI_API_KEY` vs `OPENAI_API_KEY` vs `GROQ_API_KEY` vs `SYRAVEN_AI_MODEL`).
3. **Caller-controlled model and token budget.** `model`, `temperature` and `maxTokens` are accepted from the request body with no entitlement check.
4. **No cost tracking.** Token usage is returned to the client but never persisted, despite `ai_model_usage` and `ai_budgets` tables existing.
5. **No prompt-injection defense** on knowledge context (`buildSystemPrompt` at `app/api/chat/route.ts:235` concatenates retrieved content directly into the system prompt).

---

## 14. Agent architecture

**Status: PARTIALLY IMPLEMENTED — definitions without an execution engine.**

`lib/agents/` contains 13 well-structured agent definitions. `lib/agents/registry.ts:38` registers only **10** — `study-agent`, `website-agent` and `writing-agent` are omitted from the registry (the latter two are referenced directly by `app/agents/page.tsx`, so the UI and the registry disagree about which agents exist).

`/api/agents/execute` is **a single stateless chat-completion call**. It has no tools, no planning, no delegation, no retry, no budget, no timeout policy, no persistence, and no permission model — despite the schema providing `ai_agent_executions`, `ai_execution_steps`, `ai_tool_executions`, `ai_agent_permissions` and `ai_budgets` for exactly these purposes.

Critically, per operating-protocol §7 ("An agent must never exceed the permissions of the user or service context that authorized the execution"): the endpoint **has no user context at all** — it is unauthenticated.

---

## 15. Payment architecture

**Status: PARTIALLY IMPLEMENTED.**

Working: signature verification, checkout session creation (authenticated), billing portal (authenticated), handlers for `checkout.session.completed`, `async_payment_succeeded`, `subscription.created/updated/deleted`, `invoice.payment_failed`; plan resolution falls back through subscription metadata → price metadata → env price IDs.

Gaps: **no idempotency** (§8.4); **plan trusted from checkout metadata** (§8.5); writes to the **unmigrated `profiles` table** (§9.1); no `transactions` / `subscription_events` persistence, so there is no billing audit trail; `invoice.payment_succeeded` is not handled; env price-ID naming is inconsistent (`STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_VIP_MONTHLY` all appear).

---

## 16. Authentication architecture

**Status: PARTIALLY IMPLEMENTED.**

`app/api/auth/register/route.ts` (1,334 lines) is the highest-quality route in the repository: Zod-validated, uses `createServerClient` with cookies, creates the auth user, provisions an organization, and — notably — **compensates by deleting the created auth user if organization provisioning fails** (line 1139). That is genuine production-grade thinking.

However: `lib/auth.ts` (1,295 lines) defines a complete RBAC/session model with **no Supabase integration and no server-side session retrieval** — it is pure types and predicates, imported by nothing. `AuthContext` stores state in `localStorage`. There is no `middleware.ts`, no MFA, and no server-side session helper that routes could share.

---

## 17. Authorization architecture

**Status: MISSING in the execution path.**

`lib/auth.ts` (`ROLE_HIERARCHY`, `hasPermission`, `requireRole`, `authorize`, `belongsToOrganization`) and `lib/permissions.ts` (749 lines) and `lib/billing/permissions.ts` (514 lines) are **all orphaned**. No API route performs a role, permission or entitlement check. `lib/plans.ts` (1,519 lines) — which defines every plan limit — is imported only by the pricing page, so **plan limits are displayed to users but never enforced**.

---

## 18. API architecture

24 route files, ~19,000 lines. Consistent strengths: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, structured JSON error envelopes, sanitized client-facing messages (internals go to `console.error`), `Cache-Control: no-store` on sensitive responses, and 405 handlers on several routes.

Weaknesses: no shared middleware, auth or validation; six duplicated local auth helpers; enormous files caused by inlining what `services/` already implements; Turkish-language comments mixed into English code (`app/api/action/route.ts`, `app/api/billing/webhook/route.ts:1031`, `app/api/agents/execute/route.ts:278`) — including **Turkish user-facing error strings** in `/api/action` (`"Geçersiz JSON request body gönderildi."`), which is a product-consistency defect.

---

## 19. Search architecture

**BROKEN.** `app/api/search/route.ts:280` returns a hardcoded empty result set. `services/search.ts` (1,919 lines) implements real search and is referenced only inside a **comment** at line 269. Vector search infrastructure (`ai_knowledge_chunks`) exists in the schema and is unused.

---

## 20. Deployment risks

- No CI/CD, no `.github/workflows`, no automated checks on push.
- No `.env.example`, so required configuration is undocumented — ~24 server variables are referenced across the code.
- **The database cannot be provisioned from the repository** (§9.1) — the most severe deployment risk.
- No deployment configuration (`vercel.json` or equivalent), no documented target.
- No health-check endpoint for load balancers.
- Build artifacts (`all-errors.txt`, `structure.txt`, `tailwind-test.css`) committed.

---

## 21. Technical debt (ranked)

1. **~57,000 lines of orphaned `services/` + `lib/` code** running in parallel to inline route implementations (§6, §7).
2. **13 untracked production tables** (§9.1).
3. Six duplicated per-route auth helpers instead of one shared boundary.
4. 1,000–2,000-line route files that should be thin controllers.
5. Misnamed files: `lib/untils.ts`, `Loanding.tsx`, `─ ConversationSearch.tsx`.
6. UTF-16LE `types/database.ts` (§9.2).
7. Mixed-language comments and Turkish user-facing strings.
8. Committed build artifacts.
9. Registry/UI disagreement on the agent roster (§14).
10. Inconsistent AI env-var naming.

---

## 22. Dependency risks

**Low.** The dependency set is small (12 runtime deps), current, and appropriate. No unnecessary packages.

Two observations: `openai@^4.80.0` is installed but never imported (all provider calls are raw `fetch`); `pdf-parse` and `mammoth` are used only by the orphaned `services/document-reader/`. No lockfile drift; `package-lock.json` is committed.

---

## 23. Testing gaps

**MISSING — total.** Zero test files. No test runner, no `test` script in `package.json`, no CI. Operating-protocol §29 requires tested critical security flows; currently authentication, authorization, billing, webhooks, entitlements and tenant isolation have **no automated verification whatsoever**. Given §8.1, this is how a complete IDOR reached `main` unnoticed.

---

## 24. Documentation gaps

Present: `README.md` (2.2 KB), `AGENTS.md`, `CLAUDE.md`.

Missing: every document required by operating-protocol §38 — `ARCHITECTURE.md`, `SECURITY.md`, `DATABASE.md`, `AI_ARCHITECTURE.md`, `BILLING.md`, `DEPLOYMENT.md`, `PRODUCTION_READINESS.md`, plus `.env.example`.

**`AGENTS.md` is inaccurate:** it documents `components/`, `contexts/`, `hooks/`, `lib/utils.ts` and `lib/auth.ts` as load-bearing. The first three are actually under `app/`, `lib/utils.ts` does not exist (it is `lib/untils.ts`), and `lib/auth.ts` is orphaned.

---

## 25. Current strengths

These are real and should be preserved:

1. **TypeScript discipline is excellent** — `strict` + `noUncheckedIndexedAccess` + `noFallthroughCasesInSwitch`, and it compiles with **zero errors**. ESLint bans `any` and floating promises, and passes with **zero warnings**.
2. **The database schema is genuinely enterprise-grade** — 48 tables with proper constraints, indexes, triggers and `security definer` helpers.
3. **Secret hygiene is correct** — verified: no service-role or Stripe key reachable from client code; `.env.local` untracked.
4. **The registration route is production-quality**, including failure compensation.
5. **Error handling is well-mannered** — internal details logged, sanitized messages returned.
6. **The orphaned code is high quality.** `services/` and `lib/` are not junk — they are a well-designed layer that was simply never wired in. This is a large latent asset.
7. **Stripe signature verification is correct.**
8. **AI provider fallback and SSE streaming work.**

---

## 26. Current weaknesses

1. Critical IDOR / total tenant-isolation failure (§8.1).
2. Unauthenticated, unmetered AI spend (§8.2).
3. No route-level authentication (§8.3).
4. Database not reproducible from the repository (§9.1).
5. The architecture is bypassed — services and security layers are orphaned (§7).
6. No enforcement of plans, entitlements or rate limits (§17).
7. No tests, no CI (§23).
8. RLS present but circumvented by service-role usage (§8.6).
9. Search is a stub (§19).
10. Agents are prompt wrappers, not an execution system (§14).

---

## 27. Recommended target architecture

The goal is **not** to rewrite. It is to **connect what already exists** behind one enforced boundary.

```text
                     Client (RSC-first, minimal "use client")
                                    │
                                    ▼
                        middleware.ts  ── session verification
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  API Route (thin controller)  │
                    │  withAuth(handler)            │  ← ONE shared boundary
                    │   1. verify session           │
                    │   2. resolve org/workspace    │
                    │   3. Zod-validate input       │
                    │   4. check entitlement        │
                    │   5. rate limit               │
                    │   6. delegate ↓               │
                    │   7. record usage + audit     │
                    └───────────────┬───────────────┘
                                    ▼
                          services/  (EXISTS — wire it in)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              lib/ai/router    lib/security    lib/plans
              (provider        (validation +   (entitlements)
               abstraction)     audit)
                    │
                    ▼
        Supabase — user-scoped client (RLS enforced) by default;
        supabaseAdmin only where genuinely privileged
```

**Governing principles:**

1. **RLS-enforced client by default.** `supabaseAdmin` becomes the exception, justified per call site — not the default. RLS becomes a real second line of defense.
2. **Identity never comes from client input.** Always from a verified session. Delete every `?userId=` parameter.
3. **One authorization boundary.** A single `withAuth` wrapper replaces six duplicated helpers.
4. **Routes become thin.** Move logic into the `services/` layer that already implements it.
5. **Provider-agnostic AI** through `lib/ai/router.ts`, with entitlement-bound model and token limits.
6. **Every schema change is a migration.** Baseline the 13 drifted tables immediately.
7. **Security flows are tested** before they are trusted.

---

## Appendix A — Verification commands and results

| Command | Result (2026-09-03) |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run lint` | **0 errors, 0 warnings** |
| `npm run build` | **Not run** — Phase 0 is read-only; deferred to Phase 1 |

## Appendix B — Complete API route security matrix

| Route | Auth | Validation (Zod) | Rate limit | Usage metering | Risk |
|---|---|---|---|---|---|
| `auth/register` | n/a (public) | ✅ **yes** | ❌ | ❌ | Medium (no signup throttle) |
| `billing/checkout` | ✅ Bearer | ❌ | ❌ | ❌ | Low |
| `billing/portal` | ✅ Bearer | ❌ | ❌ | ❌ | Low |
| `billing/webhook` | ✅ signature | ❌ | ❌ | ❌ | **High** (no idempotency) |
| `agents` | ✅ Bearer | ❌ | ❌ | ❌ | Medium |
| `files/upload` | ✅ Bearer | ❌ | ❌ | ❌ | Medium |
| `knowledge/search` | ✅ Bearer | ❌ | ❌ | ❌ | Medium |
| `tasks` | ✅ Bearer | ❌ | ❌ | ❌ | Medium |
| `tasks/execute` | ✅ Bearer | ❌ | ❌ | ❌ | Medium |
| `usage` | ✅ Bearer | ❌ | ❌ | ❌ | Medium |
| **`projects`** | ❌ **none** | ❌ | ❌ | ❌ | **CRITICAL — IDOR** |
| **`notifications`** | ❌ **none** | ❌ | ❌ | ❌ | **CRITICAL — IDOR** |
| **`knowledge`** | ❌ **none** | ❌ | ❌ | ❌ | **CRITICAL — IDOR** |
| **`chat`** | ❌ **none** | ❌ | ❌ | ❌ | **CRITICAL — AI cost** |
| **`agents/execute`** | ❌ **none** | ❌ | ❌ | ❌ | **CRITICAL — AI cost** |
| **`stream`** | ❌ **none** | ❌ | ❌ | ❌ | **CRITICAL — AI cost** |
| **`files/analyze`** | ❌ **none** | ❌ | ❌ | ❌ | **CRITICAL — AI cost** |
| **`voice/speak`** | ❌ **none** | ❌ | ❌ | ❌ | **High — AI cost** |
| **`voice/transcribe`** | ❌ **none** | ❌ | ❌ | ❌ | **High — AI cost** |
| **`test-openai`** | ❌ **none** | ❌ | ❌ | ❌ | **High — debug endpoint** |
| `action` | ❌ none | ❌ | ❌ | ❌ | Medium (currently inert) |
| `canvas` | ❌ none | ❌ | ❌ | ❌ | Medium |
| `search` | ❌ none | ❌ | ❌ | ❌ | Low (stub) |

**Totals: 13 of 23 routes have no authentication. 0 of 23 have rate limiting. 0 of 23 record usage. 1 of 23 validates input with Zod.**


---

## §22 — `public.projects` has no Row Level Security (found in Phase 10.1)

**Severity: high. Not yet remediated.**

`public.projects` has RLS **neither enabled nor policied**. It was missed
by `20260904122000_syraven_rls_coverage.sql`, which enabled RLS on 16
tables but not this one, and no migration defines a policy for it.

Verified: no `enable row level security` statement and no `create policy`
targeting `public.projects` exists in any migration.

**Why it is not currently exploitable.** Every table in this database
returns SQLSTATE 42501 (`permission denied`) to the `anon` and
`authenticated` roles — the systemic grants condition recorded in §8.6
and re-confirmed in Phase 6. The grants layer refuses before RLS would be
consulted, so nothing is publicly reachable today.

**Why it still matters.** That protection is incidental, not designed. If
those grants are ever corrected — the natural fix for the routes that
still need caller-scoped access — `projects` would become the one table
with no row-level protection at all, while `tasks`, `knowledge` and the
rest are covered. The tables around it would be safe and this one would
not.

**Consequence for Phase 10.1 search.** For `tasks` and `knowledge` the
explicit `.eq("user_id", …)` filter is the FIRST of two layers, with RLS
behind it. For `projects` it is currently the ONLY layer. The search code
is written identically for all three so it does not depend on which — but
this is why that filter is not optional, and why its removal is treated
as a critical mutation
(`S1_source_ownership_removed`, `M1_ownership_filter_removed`).

**Recommended remediation:** an additive migration enabling RLS on
`public.projects` with an owner-scoped policy matching the
`tasks`/`knowledge` pattern, plus an organization-membership branch for
workspace-shared projects. Not created in Phase 10.1, which was
instructed not to create migrations.
