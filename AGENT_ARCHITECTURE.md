# SYRAVEN — AGENT ORCHESTRATION ARCHITECTURE

**Last updated:** 2026-09-05 (Phase 9 + wiring)
**Scope:** agent registry, tool authorization, execution lifecycle,
approval, and the end-to-end execution route.

---

## 1. The governing principle

> **The model proposes. The server authorizes.**

A plan produced by our own model is treated exactly like a request body:
untrusted input that must be validated before anything privileged
happens. Nothing a model emits — a tool name, an argument, a risk
assessment, a claim of approval — is taken at face value.

---

## 2. What existed before Phase 9

| Area | State found |
|---|---|
| Agent execution | A single stateless LLM call. No tools, no state, no approval |
| `lib/agents/` registry | 13 persona definitions, **never consulted** by execution |
| Tools | None |
| Risk classification | **Client-supplied** — `action.requiresConfirmation` |
| Scheduler | In-memory `Map` + `setTimeout`, **0 importers** |
| Execution history | Tables exist (`agent_runs`, `agent_tasks`), unused |

The risk finding was the serious one: a caller who simply omitted
`requiresConfirmation` had **every** action classified as safe.

---

## 3. Agent registry

`lib/orchestration/registry.ts` defines agents and tools server-side.

| Agent | Tools | Max risk | Tool calls | Plan |
|---|---|---|---|---|
| `researcher` | search, task.list | **low** | 5 | free |
| `organizer` | + task.create, knowledge.create | **medium** | 8 | free |
| `curator` | + knowledge.delete | **high** | 6 | **pro** |

Two independent bounds apply to every call:

1. the tool must be in **that agent's** `allowedTools` — capability is
   granted per agent, not globally
2. the tool's risk must not exceed the agent's `maxRisk`

`researcher` is read-only *by construction* — it holds no write tool at
all. `organizer` can create but never delete.

Only three agents are registered. The 13 personas in `lib/agents/` have
no execution semantics; registering them would grant capability to
definitions never designed with a permission model.

---

## 4. Tool authorization

| Risk | Meaning | Approval |
|---|---|---|
| **low** | Reads, drafts. Reversible by ignoring output | No |
| **medium** | Changes workspace state. User-reversible | No |
| **high** | External, financial, or destructive. **Not** reversible | **Always** |

Every tool declares a strict schema. Validation **refuses** rather than
coerces:

- unknown fields → refused (not ignored)
- malformed UUIDs → refused
- oversized strings → **refused, not truncated**
- wrong types → refused

> Ignoring an unexpected key lets a model — or an instruction injected
> into a retrieved document — add arguments a future tool version might
> honour. Truncating a deletion target changes what the user approved.

**No tool grants open-ended execution.** There is no `shell.exec`, no
`http.fetch`, no `db.query`. A tool taking a free-form target is a tool
that can be pointed anywhere; a test asserts none exists.

---

## 5. Execution state machine

```
queued → planning → awaiting_approval → executing → validating → completed
              ↘         ↘                    ↘           ↘
            failed / cancelled / expired  (terminal)
```

Terminal states accept **no** transitions. That is what stops a browser
refresh, a network retry, or a duplicate delivery from running work
twice — `completed → executing` is not an edge.

Every non-terminal state has a failure path, so an execution cannot
stall with nowhere to go.

---

## 6. Human-in-the-loop

An approval is a **server record**, never a request field. A body
claiming `approved: true` proves nothing.

`verifyApproval()` re-checks every dimension against the action about to
run:

| Check | Failure |
|---|---|
| Record exists and is `approved` | `NOT_APPROVED` |
| Approver **is** the acting user | `WRONG_USER` |
| Within TTL (15 min) | `EXPIRED` |
| Same tool | `TOOL_MISMATCH` |
| Same workspace/project | `SCOPE_MISMATCH` |

An approval for one tool does not authorize another. An approval issued
in one workspace does not carry into a different tenant. A colleague's
approval does not authorize this caller.

TTL is bounded because an approval is a statement about a moment — the
user agreed to delete *that* record given *that* context. An
approval that never expires becomes a standing grant nobody remembers
issuing.

---

## 7. Execution limits

| Limit | Value | Prevents |
|---|---|---|
| `maxSteps` | 10 | Unbounded task generation |
| `maxDepth` | 3 | **Recursive agent explosion** |
| `maxToolCalls` | 10 | Runaway tool loops |
| `maxRetriesPerStep` | 1 | Retry storms — **declared, not yet used** |
| `maxExecutionMs` | 120,000 | Abandoned executions lingering |

The effective limit is the **lower** of the global ceiling and the
agent's own, so a mistake in one registry entry cannot lift the global
bound.

---

## 8. Idempotency

`deriveExecutionKey()` hashes the **verified user id** plus the request's
semantic content. The user id comes first, so a crafted goal cannot
collide with another tenant's key.

The same user retrying the same goal gets the same key; two users
issuing the same goal get different keys.

This is a de-duplication key, **not a secret** — its security value comes
from being bound to a verified identity, not from being unguessable.

---

## 9. Cost controls

Phase 9 adds **no second quota system**. `/api/action` now runs through
the existing Phase 5 `enforceUsage()` — it was previously unmetered
because it calls no paid provider, but it is an action-execution
boundary, and an unmetered one is a way to drive server-side work
without it counting against anything.

Phase 7 model/token policy and Phase 5 rate limits apply unchanged.

---

## 10. Known limitations — stated plainly

**The scheduler is in-memory and not durable.** `lib/tasks/scheduler.ts`
holds state in a `Map` with `setTimeout`. It is lost on restart and does
not work across instances. It currently has **zero importers**, so
nothing depends on it — and Phase 9 did not wire it in, precisely
because doing so would imply a durability that does not exist.

**Execution state is NOT persisted.** The state machine, approval model
and budget are pure logic evaluated within a single request. An earlier
draft of this document claimed persisting to `agent_runs` would need no
migration because the table exists. **That was wrong**, and the wiring
step established why:

- `agent_runs.agent_id` is `uuid NOT NULL REFERENCES public.agents(id)`.
  The orchestration agents are code constants, not rows in
  `public.agents`, so there is no id to satisfy the foreign key.
- `agent_runs` carries a **select-only** RLS policy
  (`agent_runs_select_via_agent`) and has no `user_id` column, so the
  caller's client cannot insert into it.

Persistence therefore genuinely requires a migration, which this step
was instructed not to create.

**The consequence, stated plainly: high-risk steps can never currently
execute.** Approvals are read from server-side storage, and there is no
such storage, so `loadApprovals()` returns empty and every high-risk
step stops at `awaiting_approval`. That is the correct failing
direction — the alternative, accepting an approval flag from the request
body, is exactly the vulnerability Phase 9 removed. It is a missing
feature, not a weakened control.

**Three of six registered tools are not executable.** `knowledge.search`,
`task.list` and `knowledge.create` have real executors. `task.create`,
`task.delete` and `knowledge.delete` are registered — so their risk and
approval requirements are defined — but resolve to
`TOOL_NOT_IMPLEMENTED` at execution. They were deliberately not stubbed:
a stub returning success reports work that never happened.

---

## 11. The execution route

`POST /api/agents/run` — `app/api/agents/run/route.ts`.

Order of controls, each before the next:

| # | Control | Source of truth |
|---|---|---|
| 1 | Authentication | `withAuth` session |
| 2 | Usage + rate limit | Phase 5 `enforceUsage` |
| 3 | Goal bounds | 1–2,000 chars |
| 4 | Tenant access | Phase 3/4 tenant guards |
| 5 | Agent resolution | server registry, fails closed |
| 6 | Plan validation | `validatePlan` — whole plan, not per step |
| 7 | Approval | server-held record, never the body |
| 8 | Budget | re-checked before **every** tool call |
| 9 | Execution | caller's RLS client only |

**What the client may decide:** the agent id, the goal text, and the
workspace/project to scope to. Each is validated or proven server-side.

**What the client may not decide:** risk, capability, approval,
identity, tenancy, plan, model, or token ceiling. A body field named
`approved`, `risk`, `userId` or `plan` has no effect anywhere in the
path.

A plan is refused **whole** if any step fails validation. Executing the
valid prefix would leave the workspace half-changed by a plan the server
rejected.

---

## 12. Adding an agent or tool safely

**A tool:**
1. Add it to `TOOL_REGISTRY` with a risk level and strict schema.
2. Keep arguments narrow — never a free-form URL, query, or command.
3. If it touches tenant data, set `tenantScoped: true` and prove access
   before running it.
4. High risk means **always** requiring approval. Do not work around it.

**An agent:**
1. Add it to `AGENT_REGISTRY` with the **smallest** `allowedTools` set
   that does the job.
2. Set `maxRisk` to the lowest tier it genuinely needs — this is a second
   bound, not a duplicate of the tool list.
3. Set `maxToolCalls` and `maxDepth` explicitly.
4. Add isolation tests, including one asserting it **cannot** reach a
   tool it was not granted.
