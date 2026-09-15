# SYRAVEN — Project State

**Last updated:** 2026-09-14, Phase 1 final gate (step 8).
This file is authoritative only together with `git status`. If they
disagree, git wins and this file is stale — fix it before continuing.

## Repository

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `6de7dd0` — "feat: Home answers what needs you, from sources that exist" |
| Working tree | **NOT CLEAN — nothing below is committed** |
| Commit instruction | **Pending founder decision** (see `GIT_PROTOCOL.md` → pending commits) |

The uncommitted work comes from four separate efforts and must be
committed separately:

1. **Pre-Phase-1 (verified in its own session, uncommitted):** Brain
   semantic bridge (`lib/search/knowledgeIndex.ts`, `knowledgeBridge.ts`,
   `/api/knowledge/index`, `/api/knowledge/semantic`, knowledge route
   delete/edit hooks, `/knowledge` ask-by-meaning), `/profile` honesty
   rewrite, Activity in navigation, credential-failure logging in
   `lib/auth/session.ts`, E2E fixture response-shape fixes, similarity
   floor 0.3, `embedding:query` rate key.
2. **Phase 1 — North Star (PARTIAL, STOPPED):** approval claimed before
   execution, `/api/agents/execute` on the provider adapter, `/api/action`
   no longer claims completion, `/api/tasks/execute` retired (410),
   `architecture-invariants.test.ts`, `ARCHITECTURE_NORTH_STAR.md`,
   `docs/architecture/ADR-001-north-star.md`, corrections to
   `AGENT_ARCHITECTURE.md` and `MIGRATION_APPROVAL_REQUIRED.md`.
3. **Engineering control plane (this bootstrap):** `CLAUDE.md` merge,
   `docs/engineering/*`, `.mcp.json`, `.claude/agents/playwright-test-*`,
   `specs/`, `.gitignore`, `package.json` scripts, visual-QA settings in
   `playwright.config.ts`, `tests/e2e/README.md`,
   `tests/security/engineering-control-plane.test.ts`.
4. **Phase 1 — second pass (PARTIAL, STOPPED):** new
   `lib/orchestration/runSettlement.ts`, `tests/security/run-settlement.test.ts`,
   `supabase/migrations/20260913120000_syraven_profiles_billing_lockdown.sql`,
   `supabase/migrations/20260913130000_syraven_tenant_write_boundaries.sql`
   (both **NOT APPLIED**), `docs/architecture/ADR-002-*`, `ADR-003-*`;
   changes to `lib/orchestration/orchestrator.ts`, `approvalStore.ts`,
   `app/api/agents/run/route.ts`, `app/api/canvas/route.ts`,
   `app/studio/page.tsx`, `tests/security/architecture-invariants.test.ts`,
   `ARCHITECTURE_NORTH_STAR.md`, `ADR-001`, `MIGRATION_APPROVAL_REQUIRED.md`,
   the state files and `CLAUDE.md`. Several of these files also carry
   effort-2 changes; commit them together with effort 2, or split by hunk.
   Steps 1–8 (2026-09-13/14) add: `messages` INSERT revoke in
   `20260913130000`; unsafe `db push` instructions removed from
   `MIGRATION_APPROVAL_REQUIRED.md` and `DATABASE.md` (§1.1, §3.1, §6);
   `next.config.ts` security headers; `/api/canvas` on the registry and
   adapter; `tests/security/security-headers.test.ts`; invariant guards
   and deferred `todo`s.

## Active phase

**Phase 1 — North Star Architecture: PASS** (founder-accepted 2026-09-14;
I-7 and I-15 PARTIAL, I-14 BLOCKED remain documented limitations).
**Phase 2 — Repository and Architecture Purification: IN PROGRESS**
(started 2026-09-14; stopped and resumed by the founder the same day, to
be completed before Phase 3). Committed locally only, never pushed; P2-H
and the Phase 2 final gate remain. Phase 3 has not started. Details:
`PHASE_STATE.md`.

## Major blockers

| Blocker | Effect | Owner |
|---|---|---|
| Machine RAM (~3.9 GB; often < 500 MB free) | Builds and browser E2E time out or are killed | Environment |
| **Migrations `20260913120000`, `20260913130000`** | Applied and verified on **TEST** (history not recorded) and, by the founder, on **PRODUCTION** (2026-09-14; history not reported). Production `projects` policies founder-verified 2026-09-14 (I-2 PASS) | Founder: record migration history; reconcile `profiles.plan` with Stripe |
| ~~No verification build of the Phase 1 tree~~ | **Resolved 2026-09-14:** production `next build` passed in a secret-free scratch copy (`BUILD_ID` `R3WTT03LAIpTqm5j4I0tf`). Phase 1 is eligible for PASS on founder acceptance | Founder: accept or not |
| No read-only production credential; no test-project DB credential | This session cannot read either catalog or record history; production evidence comes from the founder | Founder |
| Build uses production secrets | `next build` loads `.env.local` (production `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`); a verification build needs a secret-free environment | Founder / environment |
| Migrations `20260909120000`, `20260910120000` unapplied | Connectors cannot store connections; job lease policy absent | Founder approval |
| No `GROQ_API_KEY` | Provider failover cannot switch provider | Founder / credentials |
| No scheduler, no delegated-identity design | Autopilot BLOCKED (I-14) | Founder / external account |
| No OAuth credentials | Connectors BLOCKED | Founder / external account |
| No persisted run/goal/outcome records | I-7 and I-15 PARTIAL | Needs migrations → founder approval |

## Pending founder approvals

- Applying each of the four written migrations — the two Phase 1 ones
  first (`MIGRATION_APPROVAL_REQUIRED.md`), then a read of production
  `pg_policies` and a `profiles.plan` ↔ Stripe reconciliation.
- How to commit the working tree (three separate commits recommended).
- Future migrations: persisted runs/actions, goals, outcomes.
- Any scheduler account (e.g. cron/Trigger.dev) and any OAuth application.
- Adding an accessibility rule engine (`@axe-core/playwright`), if wanted (`VISUAL_QA.md`).

## Standing production restrictions

- No production migration, deployment, secret change, OAuth authorization,
  or real financial transaction without explicit approval in the conversation.
- No destructive use of production data for testing.
- Automated browsers and E2E target the **test** Supabase project only.
- The **Vercel Git integration is connected** to `canalikaraca62-oss/nova-ai`
  (founder, 2026-09-14): any branch push or PR creates a deployment, and
  `main` deploys production. No push, PR or merge without explicit
  founder approval. Build verification uses a local secret-free scratch
  copy instead.

## Environment facts

| Fact | Value |
|---|---|
| Production Supabase ref | `wpmbumtpcuahyqmdeqgf` — what `.env.local` (development) points at |
| E2E test Supabase ref | `akhkukajdgayqwhedeoo` — `.env.e2e.local` |
| Current `.next` | Built for the **test** project (BUILD_ID `8s0c9m4RUNW1nDCSDTjtQ`), from HEAD `6de7dd0`, before the uncommitted work |
| Node / Playwright / Claude Code | v24.18.1 / 1.63.0 / 2.1.270 |
| OS | Windows 11 Pro |

## Architectural invariants (summary)

Full list and evidence: `ARCHITECTURE_NORTH_STAR.md` §12; checked by
`npm run test:invariants`.

| # | Invariant | Status |
|---|---|---|
| I-1 | Client cannot define authorization truth | PASS |
| I-2 | Client cannot define tenant truth | PASS (production `messages` and `projects` founder-verified) |
| I-3 | AI cannot bypass policy | PASS |
| I-4 | Agent cannot bypass the Action Engine | PASS |
| I-5 | Action cannot bypass approval | PASS |
| I-6 | Approval cannot be replayed | PASS (production column privileges + TTL constraint founder-verified) |
| I-7 | Execution cannot be duplicated | PARTIAL |
| I-8 | Autopilot has no parallel execution model | PASS |
| I-9–11 | Brain / Search / Graph respect tenancy | PASS |
| I-12 | Billing entitlement is server-authoritative | PASS (production `profiles` writes revoked, founder-verified) |
| I-13 | Connector actions use controlled execution | PASS |
| I-14 | Durable jobs survive request lifetime | BLOCKED |
| I-15 | Execution ≠ verified outcome | PARTIAL |
| I-16 | Memory is not a hallucination store | PASS |
