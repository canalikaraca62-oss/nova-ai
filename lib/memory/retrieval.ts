/**
 * SYRAVEN — Tenant-aware memory retrieval and context assembly
 * lib/memory/retrieval.ts
 *
 * Phase 8 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * The one place that turns "who is asking" into "what context they may
 * see". Routes call `assembleContext()`; none of them query knowledge
 * directly.
 *
 * WHAT THIS FIXES
 *
 *   - Retrieval filtered on user_id alone, so workspace/project scoping
 *     was decorative and `visibility` was never enforced at read time.
 *   - `status` was never checked, so ARCHIVED and DELETED knowledge
 *     could be retrieved into an AI prompt.
 *   - `/api/chat` accepted `body.knowledge` and concatenated it into the
 *     SYSTEM prompt, letting a caller inject arbitrary instructions.
 *
 * DEFENCE IN DEPTH
 *
 *   1. the query filters by tenant and status (this module)
 *   2. every returned row is re-checked in code (canRetrieve)
 *   3. content is fenced as untrusted data (contextBudget)
 *
 * Step 2 is not redundant: it is what makes a mistake in step 1 fail
 * closed instead of leaking.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { AuthenticatedSession } from "@/lib/auth/session";
import { isUuid } from "@/lib/auth/authorization";
import {
  type MemoryAccessContext,
  type MemoryRecordDescriptor,
  canRetrieve,
  compareByPrecedence,
  scopeOf,
} from "./hierarchy";
import {
  CONTEXT_BUDGET,
  type BudgetedContext,
  type ContextItem,
  buildBoundedContext,
} from "./contextBudget";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface ContextRequest {
  readonly session: AuthenticatedSession;

  /** Free-text hint used to bias retrieval. Optional. */
  readonly query?: string | null;

  /**
   * Tenant scoping. MUST already be authorized by the caller via
   * lib/api/tenantGuard.ts — this module trusts that the ids it is
   * handed were proven, and additionally verifies membership below.
   */
  readonly workspaceId?: string | null;
  readonly projectId?: string | null;
}

export interface AssembledContext extends BudgetedContext {
  /** Rows examined before authorization filtering. */
  readonly examined: number;
  /** Rows refused by the in-code authorization re-check. */
  readonly refused: number;
}

/* -------------------------------------------------------------------------- */
/*                          MEMBERSHIP RESOLUTION                             */
/* -------------------------------------------------------------------------- */

/**
 * Resolves the tenants the caller is genuinely a member of.
 *
 * Read through the caller's own RLS-enforced client, so the database
 * enforces the same boundary a second time. Nothing here comes from the
 * request.
 */
export async function resolveAccessContext(
  db: SupabaseClient<Database>,
  userId: string,
): Promise<MemoryAccessContext> {
  const workspaceIds = new Set<string>();
  const projectIds = new Set<string>();

  /*
   * Workspaces reachable through organization membership. One query, not
   * one per organization — avoiding the N+1 the brief calls out.
   */
  const { data: workspaces, error: workspaceError } = await db
    .from("workspaces")
    .select("id")
    .limit(200);

  if (workspaceError) {
    console.error("SYRAVEN MEMORY: workspace lookup failed.", {
      userId,
      error: workspaceError.message,
    });
  } else {
    for (const row of workspaces ?? []) {
      const id = (row as { id?: unknown }).id;
      if (typeof id === "string") workspaceIds.add(id);
    }
  }

  const { data: projects, error: projectError } = await db
    .from("projects")
    .select("id")
    .limit(200);

  if (projectError) {
    console.error("SYRAVEN MEMORY: project lookup failed.", {
      userId,
      error: projectError.message,
    });
  } else {
    for (const row of projects ?? []) {
      const id = (row as { id?: unknown }).id;
      if (typeof id === "string") projectIds.add(id);
    }
  }

  return { userId, workspaceIds, projectIds };
}

/* -------------------------------------------------------------------------- */
/*                                RETRIEVAL                                   */
/* -------------------------------------------------------------------------- */

/**
 * Escapes a search term before it reaches a PostgREST filter.
 *
 * `ilike` treats % and _ as wildcards, and a comma would terminate the
 * filter expression — a term containing one could otherwise widen the
 * query beyond what was intended.
 */
export function escapeSearchTerm(term: string): string {
  return term.replace(/[%_,()]/g, " ").trim().slice(0, 200);
}

/**
 * Retrieves knowledge the caller is entitled to see.
 *
 * Bounded at every step: the query has a hard limit, each row is
 * re-authorized in code, and the result is budgeted before rendering.
 */
export async function assembleContext(
  request: ContextRequest,
): Promise<AssembledContext> {
  const { session } = request;
  const db = session.supabase;

  const access = await resolveAccessContext(db, session.userId);

  /*
   * Reject malformed tenant ids before they reach a query. PostgREST
   * answers a bad uuid with a 400 that differs from an empty result,
   * which would let a caller distinguish "no such workspace" from "not
   * yours".
   */
  const workspaceId =
    typeof request.workspaceId === "string" && isUuid(request.workspaceId)
      ? request.workspaceId
      : null;

  const projectId =
    typeof request.projectId === "string" && isUuid(request.projectId)
      ? request.projectId
      : null;

  let query = db
    .from("knowledge")
    .select(
      "id, user_id, workspace_id, project_id, title, content, visibility, status, updated_at",
    )
    /*
     * STATUS FILTER — the control that stops deleted or archived
     * knowledge silently re-entering an AI prompt.
     */
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    /*
     * Over-fetch modestly relative to the item budget: authorization
     * filtering below will discard some rows, and the budget then trims
     * to CONTEXT_BUDGET.maxItems.
     */
    .limit(CONTEXT_BUDGET.maxItems * 4);

  if (projectId !== null) {
    query = query.eq("project_id", projectId);
  } else if (workspaceId !== null) {
    query = query.eq("workspace_id", workspaceId);
  }

  const searchTerm =
    typeof request.query === "string" && request.query.trim().length > 0
      ? escapeSearchTerm(request.query)
      : null;

  if (searchTerm !== null && searchTerm.length > 0) {
    query = query.ilike("title", `%${searchTerm}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("SYRAVEN MEMORY: retrieval failed.", {
      userId: session.userId,
      error: error.message,
    });

    /*
     * Fail closed. Returning empty context degrades the answer; a thrown
     * error would fail the request. Neither leaks, and an AI response
     * without context is the safe outcome.
     */
    return {
      items: [],
      rendered: "",
      totalChars: 0,
      droppedForBudget: 0,
      examined: 0,
      refused: 0,
    };
  }

  const rows = data ?? [];

  let refused = 0;

  const authorized: Array<{
    descriptor: MemoryRecordDescriptor;
    title: string;
    content: string;
  }> = [];

  for (const raw of rows) {
    const row = raw as {
      user_id?: unknown;
      workspace_id?: unknown;
      project_id?: unknown;
      visibility?: unknown;
      status?: unknown;
      title?: unknown;
      content?: unknown;
    };

    const descriptor: MemoryRecordDescriptor = {
      ownerUserId:
        typeof row.user_id === "string" ? row.user_id : null,
      workspaceId:
        typeof row.workspace_id === "string" ? row.workspace_id : null,
      projectId:
        typeof row.project_id === "string" ? row.project_id : null,
      visibility:
        typeof row.visibility === "string" ? row.visibility : null,
      status: typeof row.status === "string" ? row.status : null,
    };

    /*
     * IN-CODE RE-AUTHORIZATION.
     *
     * The query already filtered, and RLS applies underneath. This third
     * check is what makes a mistake in either of those fail closed
     * rather than leak — particularly `visibility = 'private'` belonging
     * to another user, which no single column filter expresses.
     */
    const decision = canRetrieve(descriptor, access);

    if (!decision.allowed) {
      refused += 1;
      continue;
    }

    const content =
      typeof row.content === "string" ? row.content : "";

    if (content.trim().length === 0) continue;

    authorized.push({
      descriptor,
      title: typeof row.title === "string" ? row.title : "Untitled",
      content,
    });
  }

  /* Most specific scope first, so budget truncation drops the broadest. */
  authorized.sort((a, b) =>
    compareByPrecedence(a.descriptor, b.descriptor),
  );

  const items: ContextItem[] = authorized.map((entry) => ({
    source: entry.title,
    content: entry.content,
    scope: scopeOf(entry.descriptor),
  }));

  const budgeted = buildBoundedContext(items);

  return {
    ...budgeted,
    examined: rows.length,
    refused,
  };
}
