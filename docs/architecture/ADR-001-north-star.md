# ADR-001 — SYRAVEN is organised around one work loop

- **Status:** Accepted (Phase 1, 2026-09-13)
- **Context document:** `ARCHITECTURE_NORTH_STAR.md`
- **Checked by:** `tests/security/architecture-invariants.test.ts`

## Context

By Phase 1 the repository held many real capabilities — chat, agents,
approvals, a Brain with semantic search, a work graph, billing — built in
sequence and joined unevenly. The audit for this decision found the cost
of that directly in the code:

- three routes that each implemented "execution" differently, two of
  them reporting work that never happened (`/api/tasks/execute`,
  `/api/action`);
- a route that chose its API key and endpoint independently, and sent
  the OpenAI key to Groq;
- an approval that could authorize the same high-risk step twice under
  concurrency, because it was spent after the run instead of before it;
- two agent concepts (catalogue rows and a code registry).

Each was locally reasonable. Together they are what "a pile of features"
means in practice: every feature carries its own definition of identity,
execution and done.

## Decisions

### 1. The product is organised around the work loop
Goal → Context → Brain → Plan → Agents → Work Graph → Action Engine →
Approval → Execution → Verification → Outcome → Memory → Autopilot.
Features are views onto stages of this loop, not separate systems. A new
capability is placed at a stage and uses that stage's authority.

*Why:* the founder's promise — "give SYRAVEN the goal, it runs the work" —
is a statement about the loop. A feature outside it cannot contribute to
running work.

### 2. The Action Engine is the only execution boundary
Real-world effects happen only through `executeTool()`, which has exactly
one caller (the orchestrator). Routes classify, plan or display; they do
not execute.

*Why:* the two fabricated executors found in Phase 1 existed because
execution could be written anywhere. One boundary means one place to
authorize, approve, meter, verify and audit.

### 3. Autopilot shares the durable execution substrate
Autopilot schedules goals into `public.jobs` and runs them through the
same orchestrator, approvals and executors. It gets no executor or state
machine of its own.

*Why:* a second engine would need its own approval, idempotency and
verification — and would differ from the first in exactly the cases that
matter (retries, failures, cancellation).

### 4. The Brain is the context and intelligence layer
Durable knowledge lives in the Brain (`public.knowledge` as the record,
the semantic index derived from it). Agents, chat and projects read it;
they do not keep private copies.

*Why:* duplicated knowledge diverges, and a deletion that reaches one
copy but not another is a deletion that did not happen.

### 5. The Work Graph is the relationship layer
Relationships come only from persisted links. The graph never invents
edges from similarity for visual effect.

*Why:* a graph is the easiest surface to fake and the hardest for a user
to check.

### 6. AI is never authoritative for security or state
The model proposes plans and text. Identity, tenancy, entitlement, model
choice, tool risk, approval and execution state are decided by
deterministic server code. A key travels only to its own provider.

*Why:* model output is attacker-influenced input (through goals and
retrieved documents). Anything it can decide, a prompt can decide.

### 7. Approval is first-class
An approval is a server record made by the person it was requested for,
bounded in time, and **spent before** the step it authorizes runs, by
compare-and-set. No request field can stand in for it.

*Why:* human control is only real if it cannot be replayed, forged, or
used twice.

### 8. Verification is first-class
A step is complete only when its executor reports success, and writes are
read back from the database. An action result is not a business outcome;
the two are recorded separately once outcomes exist.

*Why:* "the call returned 200" is not evidence that the world changed as
intended.

## Consequences

- Positive: each concept has one owner (North Star §7); invariants I-1 to
  I-16 are checked in CI; fabricated execution paths are gone.
- Negative / accepted: some existing routes still carry their own AI
  transport and must move onto the adapter; run state remains
  request-scoped until a migration for persisted runs is approved;
  Autopilot stays BLOCKED on a scheduler and delegated identity.
- Follow-ups: persisted runs/actions, goals and outcomes need migrations
  and founder approval (North Star §15). Further ADRs are warranted when
  those schemas are chosen.
- Refined by **ADR-002** (a plan runs only when every high-risk step is
  authorized; a run completes only when every step completed) and
  **ADR-003** (for client writes the database is the boundary of record —
  the second Phase 1 pass found decisions 6 and 7 held in code while the
  database let a signed-in user write their own plan and rewrite their
  own approvals).
