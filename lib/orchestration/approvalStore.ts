import "server-only";

import type { AuthenticatedSession } from "@/lib/auth/session";

import {
  APPROVAL_TTL_MS,
  type ApprovalRecord,
  buildApprovalRequest,
} from "./execution";
import type { RiskLevel } from "./registry";

/** Postgres unique_violation: a live approval for this action already exists. */
const UNIQUE_VIOLATION = "23505";

/*
  SYRAVEN — Approval persistence

  WHY THIS EXISTS

  app/api/agents/run/route.ts held a `loadApprovals()` that returned an
  empty map, with a comment explaining that approvals could not be
  stored because `public.agent_runs` has a NOT NULL foreign key and a
  select-only policy.

  That comment named the wrong table. Approvals were never going to live
  in agent_runs: `public.agent_approvals` was migrated for exactly this
  purpose, it is present in types/database.ts, and its policies permit
  precisely the two writes this file needs --

    insert   own rows only, status must be 'pending',
             decided_by_user_id must be null   (no self-approval at birth)
    update   own rows only, from 'pending'/'approved',
             decider must be the caller

  -- while granting no delete at all, because the table is the audit
  trail of who authorized a destructive action.

  So the control was failing closed for a reason that did not hold. Every
  high-risk step stopped, permanently, and there was no path by which a
  person could grant one. This module is that path.

  WHAT IS ENFORCED HERE AND WHAT IS ENFORCED BY THE DATABASE

  The database owns what must be true regardless of this code: RLS scopes
  every row to the requesting user, a CHECK makes a decided-but-undecided
  row unrepresentable, and a partial unique index over the non-terminal
  states means one action cannot have two live approvals at once.

  This module owns what the database cannot express: mapping rows onto
  ApprovalRecord, and treating an elapsed expiry as expired on READ. A
  row whose expires_at has passed is still literally 'approved' in the
  column until something rewrites it, so reading it back as approved
  would resurrect a grant the clock has already retired.
*/

/** The row shape this module reads back. */
interface ApprovalRow {
  id: string;
  execution_key: string;
  requested_for_user_id: string;
  decided_by_user_id: string | null;
  agent_id: string;
  tool_id: string;
  risk: string;
  effect: string;
  workspace_id: string | null;
  project_id: string | null;
  status: string;
  created_at: string;
  decided_at: string | null;
  expires_at: string;
}

const APPROVAL_SELECT = `
  id,
  execution_key,
  requested_for_user_id,
  decided_by_user_id,
  agent_id,
  tool_id,
  risk,
  effect,
  workspace_id,
  project_id,
  status,
  created_at,
  decided_at,
  expires_at
`;

/** The states a row may hold, mirroring the column's CHECK. */
export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "used";

function toMillis(value: string | null): number {
  if (!value) return 0;

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? 0 : parsed;
}

function isRiskLevel(value: string): value is RiskLevel {
  return value === "low" || value === "medium" || value === "high";
}

/**
 * Maps a stored row onto the record `verifyApproval()` checks.
 *
 * Expiry is applied here rather than trusted from the column. A row can
 * sit at 'approved' with an expires_at in the past -- nothing rewrites
 * it at the moment the clock passes -- and returning that as approved
 * would hand back a grant that has already lapsed. The state is
 * therefore derived, and the stored value is what the audit trail keeps.
 */
export function toApprovalRecord(
  row: ApprovalRow,
  now = Date.now(),
): ApprovalRecord {
  const expiresAt = toMillis(row.expires_at);

  const stored = row.status as ApprovalStatus;

  const state: ApprovalRecord["state"] =
    (stored === "pending" || stored === "approved") && expiresAt <= now
      ? "expired"
      : stored;

  return {
    executionId: row.execution_key,
    requestedForUserId: row.requested_for_user_id,
    agentId: row.agent_id,
    toolId: row.tool_id,
    risk: isRiskLevel(row.risk) ? row.risk : "high",
    effect: row.effect,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    createdAt: toMillis(row.created_at),
    expiresAt,
    state,
    decidedByUserId: row.decided_by_user_id,
    decidedAt: row.decided_at === null ? null : toMillis(row.decided_at),
  };
}

/**
 * Loads the caller's live approvals for one execution, keyed by tool id.
 *
 * Keyed by tool because that is how the orchestrator looks them up: it
 * asks whether THIS step's tool has a grant. Terminal rows are excluded
 * from the query, so a rejected or already-used approval cannot be
 * mistaken for a live one -- and because the unique index only covers
 * the non-terminal states, at most one row per tool can come back.
 *
 * A query failure returns an empty map. That is the same answer as "no
 * approval exists", which is the correct failing direction: a database
 * error must never read as permission.
 */
export async function loadApprovals(
  session: AuthenticatedSession,
  executionKey: string,
): Promise<ReadonlyMap<string, ApprovalRecord>> {
  const approvals = new Map<string, ApprovalRecord>();

  if (!executionKey) return approvals;

  const { data, error } = await session.supabase
    .from("agent_approvals")
    .select(APPROVAL_SELECT)
    /*
      Explicit ownership filter alongside RLS. The policy already
      restricts this; a query that states its own boundary does not
      depend on the policy being present to be correct.
    */
    .eq("requested_for_user_id", session.userId)
    .eq("execution_key", executionKey)
    .in("status", ["pending", "approved"]);

  if (error || !data) return approvals;

  const now = Date.now();

  for (const row of data as unknown as ApprovalRow[]) {
    approvals.set(row.tool_id, toApprovalRecord(row, now));
  }

  return approvals;
}

/**
 * Records that a step is waiting on a person.
 *
 * Inserted as 'pending' with no decider, which is the only shape the
 * insert policy accepts -- a caller cannot create a row that is already
 * approved. `organization_id` is written null: the session carries no
 * organization, and the policy's `organization_id is null` arm covers
 * exactly that case. Writing an id this code has not proven membership
 * of would be inventing tenancy.
 *
 * A duplicate is not an error. The partial unique index means a second
 * live row for the same (execution, tool, user) cannot exist, so a
 * repeated request is already represented by the row that is there.
 *
 * Resolves true only when every requested tool has a live row -- written
 * now, or already present. The route must not tell a person something is
 * waiting for their approval when nothing was recorded.
 */
export async function requestApprovals(
  session: AuthenticatedSession,
  input: {
    executionKey: string;
    agentId: string;
    toolIds: readonly string[];
    riskByTool: ReadonlyMap<string, RiskLevel>;
    effectByTool: ReadonlyMap<string, string>;
    workspaceId: string | null;
    projectId: string | null;
  },
): Promise<boolean> {
  if (input.toolIds.length === 0) return true;

  const now = Date.now();

  const rows = input.toolIds.map((toolId) => {
    const request = buildApprovalRequest({
      executionId: input.executionKey,
      userId: session.userId,
      agentId: input.agentId,
      toolId,
      risk: input.riskByTool.get(toolId) ?? "high",
      effect:
        input.effectByTool.get(toolId) ??
        `Run ${toolId}. This step changes something outside SYRAVEN.`,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      now,
    });

    return {
      execution_key: request.executionId,
      requested_for_user_id: request.requestedForUserId,
      agent_id: request.agentId,
      tool_id: request.toolId,
      risk: request.risk,
      effect: request.effect,
      organization_id: null,
      workspace_id: request.workspaceId,
      project_id: request.projectId,
      status: "pending" as const,
      expires_at: new Date(request.expiresAt).toISOString(),
    };
  });

  /*
    One plain insert per tool, and every result is read.

    This was an upsert whose conflict target named the columns of a
    PARTIAL unique index. Postgres infers a partial index for ON CONFLICT
    only when the statement repeats the index predicate, which
    PostgREST's on_conflict cannot express -- so the statement is refused
    (42P10), and its result was discarded. The run then answered "This
    plan needs your approval" while no approval existed to give.

    A plain insert needs no inference. A live row for the same action
    makes the partial unique index refuse it with 23505, which means
    "already requested" and is success. Any other refusal is a failure,
    logged and reported: nothing runs either way, but the person must
    not be told something waits for them that does not.
  */
  let recorded = true;

  for (const row of rows) {
    const { error } = await session.supabase
      .from("agent_approvals")
      .insert(row);

    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error("SYRAVEN APPROVAL: request could not be recorded.", {
        userId: session.userId,
        toolId: row.tool_id,
        code: error.code,
      });

      recorded = false;
    }
  }

  return recorded;
}

export type DecisionOutcome =
  | { ok: true; status: "approved" | "rejected" }
  | { ok: false; reason: "NOT_FOUND" | "NOT_PENDING" | "FAILED" };

/**
 * Records a person's decision on one pending approval.
 *
 * The decider is taken from the verified session and never from the
 * request, and the update is filtered to rows still pending -- so a
 * second decision on an already-decided row changes nothing rather than
 * overwriting the first. The policy enforces the same thing; both are
 * present because this is the step that turns a refusal into a grant.
 */
export async function decideApproval(
  session: AuthenticatedSession,
  input: {
    approvalId: string;
    decision: "approved" | "rejected";
  },
): Promise<DecisionOutcome> {
  const { data, error } = await session.supabase
    .from("agent_approvals")
    .update({
      status: input.decision,
      decided_by_user_id: session.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", input.approvalId)
    .eq("requested_for_user_id", session.userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, reason: "FAILED" };

  if (!data) {
    /*
      Absent, not the caller's, or no longer pending -- reported
      identically. Telling them apart would say whether an approval id
      exists, which is an id-probing oracle on an audit table.
    */
    return { ok: false, reason: "NOT_FOUND" };
  }

  return { ok: true, status: input.decision };
}

/**
 * Spends an approval for exactly one execution, BEFORE its step runs.
 *
 * THIS REPLACES A CONSUME-AFTER-RUN THAT LEFT A RACE. `verifyApproval()`
 * accepts any approved, unexpired record, and the same goal derives the
 * same execution key. When the grant was only marked 'used' after the
 * whole run, two concurrent requests for one goal could both load it
 * while it was still 'approved', both pass verification, and both run
 * the high-risk step before either spent it.
 *
 * Here approved -> used is a compare-and-set. The update matches only a
 * row that is still 'approved' and unexpired, and only the request whose
 * update returns that row may run the step. Every other request gets
 * false and runs nothing. A database error is also false: a grant that
 * could not be claimed must never read as permission.
 *
 * The grant is spent whether the step then succeeds or fails. It
 * authorized the ATTEMPT, and a failed attempt at a destructive action
 * is not a licence to try again unasked. Moving the row to 'used' also
 * frees the partial unique index, so a fresh approval for the same
 * action can be requested deliberately.
 */
export async function claimApproval(
  session: AuthenticatedSession,
  input: { executionKey: string; toolId: string },
): Promise<boolean> {
  const { data, error } = await session.supabase
    .from("agent_approvals")
    .update({ status: "used" })
    .eq("execution_key", input.executionKey)
    .eq("tool_id", input.toolId)
    .eq("requested_for_user_id", session.userId)
    .eq("status", "approved")
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("SYRAVEN APPROVAL: claim failed.", {
      userId: session.userId,
      toolId: input.toolId,
    });

    return false;
  }

  return data !== null;
}

/**
 * Lists the caller's approvals awaiting a decision.
 *
 * Expired rows are filtered out here rather than shown greyed: an
 * approval whose moment has passed is not a decision anybody can still
 * make, and offering the button would be a control that cannot act.
 */
export async function listPendingApprovals(
  session: AuthenticatedSession,
): Promise<
  Array<{
    id: string;
    executionKey: string;
    agentId: string;
    toolId: string;
    risk: string;
    effect: string;
    createdAt: string;
    expiresAt: string;
  }>
> {
  const { data, error } = await session.supabase
    .from("agent_approvals")
    .select(APPROVAL_SELECT)
    .eq("requested_for_user_id", session.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  const now = Date.now();

  return (data as unknown as ApprovalRow[])
    .filter((row) => toMillis(row.expires_at) > now)
    .map((row) => ({
      id: row.id,
      executionKey: row.execution_key,
      agentId: row.agent_id,
      toolId: row.tool_id,
      risk: row.risk,
      effect: row.effect,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
}

/** Exposed so a caller can state the same window the store uses. */
export { APPROVAL_TTL_MS };
