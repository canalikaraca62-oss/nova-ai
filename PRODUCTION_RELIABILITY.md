# SYRAVEN — Production Reliability

Phase 11 (Integrations, Reliability & Observability).
Phase 12 (Final readiness, UX/UI, E2E validation).
Audit date: 2026-09-06.

**Status: NOT production-ready.** Material blockers remain — see
[Blockers](#blockers). This document records what is verified, what is
not, and what must be resolved before a production launch.

## Phase 12 — what was and was not verifiable

The repository has **no browser or E2E tooling** (no Playwright,
Cypress, Puppeteer or Testing Library). Phase 12's brief asks for
verification of *rendered* UI. That was not possible, and the brief also
forbids introducing a large framework unnecessarily.

**Verified without a browser** (decidable from source/filesystem):

- Every internal `href` resolves to a real App Router page — dynamic
  segments included. Five dead links were found and fixed.
- Billing/pricing/contact buttons state background and text colour on
  the same element, so no payment CTA inherits a colour that could break
  to dark-on-dark.
- Plan vocabulary agreement between UI and `lib/plans.ts`.
- No page imports the unwired integration scaffolding.

**NOT verified — requires a browser, and is not claimed:**

- Actual rendered contrast ratios (WCAG AA/AAA measurement).
- Hydration behaviour and runtime console errors.
- Responsive layout at real breakpoints; overflow, clipping, z-index.
- Focus order, keyboard traps, screen-reader output.
- Whether a button's complete flow works end to end against a live
  backend.

Anyone claiming those requires a browser pass. This document does not
claim them.

---

## 1. Integrations

| Integration | Wired | Auth | Timeout | Retry | Idempotent | Notes |
|---|---|---|---|---|---|---|
| Supabase (user-scoped) | Yes | Session JWT, RLS | Client default | — | n/a | Every user-scoped read/write uses the caller's RLS client |
| Supabase (service-role) | Yes | Service key | Client default | — | n/a | **Webhook only**, justified below |
| OpenAI — chat | Yes | `OPENAI_API_KEY` | 120s server-owned | 1 retry | n/a | Via `lib/ai/provider.ts` |
| OpenAI — embeddings | **Built, never called** | `OPENAI_API_KEY` | 30s server-owned | 1 retry | Skip-if-present | `lib/search/openaiEmbedding.ts` |
| OpenAI — voice/vision | Yes | `OPENAI_API_KEY` | Per-route abort | Route-level | n/a | speak, transcribe, analyze |
| Stripe — checkout/portal | Yes | `STRIPE_SECRET_KEY` | SDK default | SDK default | Stripe-side | |
| Stripe — webhook | Yes | **Signature verified** | n/a | Stripe redelivers | **DB unique constraint** | See §4 |
| Groq | **Scaffolding only** | `GROQ_API_KEY` | Manual timer | 2, exponential | n/a | `lib/ai/groq.ts` unreferenced |
| GitHub / Gmail / Notion / Slack / Calendar | **Scaffolding only** | — | — | — | — | ~145KB in `services/integrations/`, unreferenced |
| Email (Resend) | **Not implemented** | — | — | — | — | Env var only |
| Storage (Supabase buckets) | Yes | Session | Client default | — | — | |

### Scaffolding vs. wired

Five integration modules and `lib/ai/groq.ts` are **not imported
anywhere**. They are dead code today. They are listed because dead code
that looks live is an operational hazard: an engineer wiring
`services/integrations/slack.ts` would inherit whatever controls it does
or does not have, unreviewed. Either wire them through the same
`lib/ai/provider.ts`-style adapter, or delete them.

`lib/security/audit.ts` (~900 lines) is in the same position.

---

## 2. Reliability controls

### Verified present

- **Server-owned timeouts** on the AI adapter (120s) and embedding
  client (30s). Neither accepts a caller's `AbortSignal` — a client
  cannot hold a provider connection open.
- **Bounded retries.** One retry in `lib/ai/provider.ts` and
  `lib/search/embedding.ts`; two with exponential backoff in the unwired
  Groq client. No unbounded loop exists.
- **Webhook idempotency** enforced by a database unique constraint, not
  application-level check-then-act (which would race).
- **Claim-before-effect ordering** in the webhook: a crash mid-processing
  leaves `status = 'pending'` for investigation rather than silently
  re-applying.
- **Usage guards** on all nine paid routes (`action`, `agents/execute`,
  `agents/run`, `canvas`, `chat`, `files/analyze`, `stream`,
  `voice/speak`, `voice/transcribe`). Verified by grep, not assumed.
- **Partial-write protection** in embedding ingestion: a provider failure
  writes nothing, leaving the prior state intact.

### Fixed in this phase

Five unbounded log statements that wrote provider response bodies or
user document content into server logs. See §3.

---

## 3. Observability

`lib/observability/logger.ts` — structured JSON logging, no dependency.

**Why it exists.** The audit found 114 bare `console.*` calls across
`app/api/**`, each deciding independently what was safe to log. Five were
wrong. The problem was not carelessness at those five sites; it was that
"is this field safe?" was re-answered at every site, so the answer was
only as good as the least careful one.

**What it provides**

- Redaction by key name (substring, case-insensitive) covering
  credentials, user content, vectors, and personal identifiers.
- Field truncation at 300 characters — no single field can flood a log.
- Depth-bounded recursion; arrays summarised by length, never enumerated.
- Error classification (`timeout`, `upstream_unavailable`,
  `not_authorized`, …) that never writes an error's message or stack.
- Request-id correlation, with inbound `x-request-id` accepted only when
  it matches `[A-Za-z0-9_-]{1,200}` — otherwise it is attacker-controlled
  text written into every log line for that request.
- `timed()` records duration on **both** success and failure paths.

### Leaks found and fixed

| Route | Field | Risk |
|---|---|---|
| `files/analyze` | `content` | Model's analysis **of the user's uploaded document**, logged verbatim |
| `files/analyze` | `errorText` | Untruncated provider body |
| `stream` | `errorText` | Untruncated provider body |
| `chat` | `errorText` | Untruncated provider body |
| `agents/execute` (×2) | `errorText` | Untruncated provider body |

A provider error body can echo the request back, which for these routes
carries the prompt — and for `files/analyze`, the document's extracted
text. All are now bounded to 300 characters, matching the convention
already used in `lib/ai/provider.ts`.

**Not yet done:** the logger is available but the 114 existing
`console.*` calls are not migrated to it. Migrating them is mechanical
but touches every route, which exceeds the "do not modify unrelated
routes" constraint of this phase.

---

## 4. Webhook reliability

`app/api/billing/webhook/route.ts` — audited, **no changes needed**.

- Signature verified via `stripe.webhooks.constructEvent` before any
  processing.
- Service-role client is justified and documented: a webhook carries no
  user session, so there is no identity for RLS to evaluate. The request
  is authenticated by signature instead, and it writes billing state a
  client must never set. This is the **only** service-role use outside
  admin paths.
- Replay-safe via `billing_webhook_events.stripe_event_id` UNIQUE. The
  claim is an INSERT: success means this process owns the event, a unique
  violation means it is already claimed.
- Plan vocabulary unified on `PlanId`; legacy names accepted as input,
  never written.

**Blocker:** the migration creating `billing_webhook_events`
(`20260904130000`) exists in the repository but is **not applied to the
live database** — `types/database.ts`, generated from the live schema,
does not contain the table. Until it is applied, the idempotency claim
writes to a table that does not exist, and **replay protection is not
actually in force**.

---

## 5. AI / agent reliability

- Provider failures normalise to seven error kinds; provider bodies are
  logged server-side only and never returned to a caller.
- A provider `401/403` maps to a client-visible `503`, not `401` — so a
  server misconfiguration cannot be mistaken for a bad session.
- Agent approval gating exists (`20260905120000_syraven_agent_approvals`).
- Embedding ingestion authorises **before** content reaches a provider,
  and its mutation tests prove the ordering is load-bearing.

**Known gap:** no per-caller concurrency limit on agent execution. A
caller may start many executions in parallel; each is individually
quota-checked, but there is no ceiling on simultaneity.

---

## 6. Cost safety

- All nine paid routes are behind usage guards.
- Embedding ingestion is **one chunk per call**, skips chunks that
  already have a vector, and has no bulk runner or scheduler.
- The embedding client is **never constructed** — no route or job builds
  it. Cost requires a deliberate, reviewed change.
- Retries are bounded everywhere, so an outage cannot produce a retry
  storm.

**Known gap:** `ingestChunk` has no per-caller rate limit of its own. A
caller looping it is bounded only by how many chunks they own. Wire it to
`lib/usage/` before exposing it through any route.

---

## 7. Known failure modes

| Failure | Behaviour | Safe? |
|---|---|---|
| AI provider down | 1 retry, then normalised 502/503 | Yes |
| AI provider timeout | Aborted at 120s, 504 | Yes |
| Embedding returns wrong dimension | Rejected before any DB write | Yes |
| Embedding provider fails mid-ingest | Nothing written, prior state kept | Yes |
| Stripe webhook redelivered | Second claim rejected by unique constraint | **Only once migration is applied** |
| Webhook crash mid-processing | Row left `pending`, visible for investigation | Yes |
| Caller unauthorized for a chunk | Refused before provider call | Yes |
| Semantic query with no ranking RPC | Returns `degraded: true`, never fabricates a distance | Yes |
| Supabase unreachable | Route-level error, no partial write | Mostly — not systematically tested |

---

## 8. Operational risks

1. **Dead integration code** (~145KB + Groq + audit service) that looks
   production-ready but is unreviewed and unwired.
2. **114 unmigrated `console.*` calls** — the five known leaks are fixed,
   but the pattern that produced them persists.
3. **No health endpoint**, so there is no readiness signal for a
   deployment target.
4. **In-memory rate limiting** (if `REDIS_URL` is unset) does not survive
   a restart and is per-instance, so it does not hold across replicas.
5. **No alerting.** Structured logs exist; nothing consumes them.

---

## Blockers

Must be resolved before production:

1. **`billing_webhook_events` migration not applied.** Webhook replay
   protection is not actually in force. *(Migration exists; applying it
   is an operational step, not a code change.)*
2. **Semantic ranking RPC + vector index not migrated.** Retrieval is
   permanently `degraded`. Deferred by explicit instruction; still a
   functional blocker.
3. **Embedding client never exercised against the live API.** The wire
   format is unverified. First call should be a single chunk on
   non-production data.
4. **No production ingestion has run.** The corpus has no embeddings, so
   semantic search returns nothing regardless of ranking.
5. **No rate limit on ingestion.** Must be wired to `lib/usage/` before
   any route exposes it.

---

## UI defects found and fixed (Phase 12)

All five were dead links — a CTA that returns a 404 for the user.

| File | Link | Fix |
|---|---|---|
| `app/login/page.tsx` | `/signup` | → `/register` (exists) |
| `app/login/page.tsx` | `/forgot-password` | → `/reset-password` (exists) |
| `app/pricing/page.tsx` | `/signup` ×3 | → `/register` (exists) |
| `app/canvas/page.tsx` | `/canvas/new` | → opens the existing create panel |
| `app/canvas/page.tsx` | `/search?scope=canvas` | Removed — no global search route exists |
| `app/pricing`, `app/billing` | `/contact` ×3 | **Created** `app/contact/page.tsx` |

`/contact` was the most consequential: the Enterprise plan has no
self-serve checkout, so `/contact` was the *only* route to an enterprise
sale — and all three of its entry points 404'd.

The canvas "Advanced search" link was **removed rather than repointed**.
The page already has its own search and filter controls, and
`/projects/search` covers a different scope; a link promising advanced
search that goes nowhere is a false affordance.

## Verification

Phase 11: 38 targeted tests, 910 full-suite.
Phase 12: 12 targeted tests, 922 full-suite, typecheck, lint, production
build (45 pages).

No migration created. No production data touched. No paid API call made.
