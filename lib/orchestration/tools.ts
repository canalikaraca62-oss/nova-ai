/**
 * SYRAVEN — Tool executors
 * lib/orchestration/tools.ts
 *
 * Phase 9 completion (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * The code that actually runs an authorized tool call.
 *
 * SCOPE — deliberately narrow
 *
 * Only tools backed by a REAL existing application capability are
 * implemented. Nothing here was invented to make a test pass:
 *
 *   knowledge.search  -> lib/memory/retrieval.assembleContext (Phase 8)
 *   knowledge.create  -> insert into public.knowledge
 *   task.list         -> select from public.tasks
 *
 * `task.create`, `task.delete` and `knowledge.delete` are REGISTERED but
 * NOT executable. They are declared in the registry so their risk level
 * and approval requirement are defined, and they resolve to
 * TOOL_NOT_IMPLEMENTED at execution. That is the honest state: a
 * registered-but-unimplemented tool fails closed, whereas a stub that
 * pretends to succeed would report work that never happened.
 *
 * DATA ACCESS
 *
 * Every executor runs on the CALLER'S RLS-enforced client
 * (session.supabase). An agent inherits exactly the authorization of the
 * user who started it — never more. There is no service-role path here.
 */

import "server-only";

import type { AuthenticatedSession } from "@/lib/auth/session";
import { assembleContext } from "@/lib/memory/retrieval";
import { CONTEXT_BUDGET } from "@/lib/memory/contextBudget";
import type { ToolDefinition } from "./registry";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type ToolArgs = Readonly<
  Record<string, string | number | boolean>
>;

export interface ToolContext {
  readonly session: AuthenticatedSession;
  /** Tenant scope, already PROVEN by the route's tenant guards. */
  readonly workspaceId: string | null;
  readonly projectId: string | null;
}

export type ToolOutcome =
  | { ok: true; summary: string; data: unknown }
  | {
      ok: false;
      reason:
        | "TOOL_NOT_IMPLEMENTED"
        | "TOOL_FAILED"
        | "RESOURCE_NOT_FOUND";
      message: string;
    };

/**
 * Maximum rows any read tool may return.
 *
 * Bounds the work one execution can cause and keeps tool output from
 * blowing past the Phase 8 context budget when it is fed back to a model.
 */
const MAX_ROWS = 20;

/* -------------------------------------------------------------------------- */
/*                                 EXECUTORS                                  */
/* -------------------------------------------------------------------------- */

/**
 * Searches the caller's authorized knowledge.
 *
 * Delegates entirely to Phase 8 retrieval, so tenant scoping, status
 * filtering, per-row re-authorization and the context budget all apply
 * unchanged. The agent gets exactly what the user would.
 */
async function knowledgeSearch(
  args: ToolArgs,
  context: ToolContext,
): Promise<ToolOutcome> {
  const query = typeof args.query === "string" ? args.query : "";

  const assembled = await assembleContext({
    session: context.session,
    query,
    workspaceId: context.workspaceId,
    projectId: context.projectId,
  });

  return {
    ok: true,
    summary: `Found ${assembled.items.length} authorized knowledge item(s).`,
    data: {
      items: assembled.items.map((item) => ({
        source: item.source,
        scope: item.scope,
        /*
         * Truncated per item. Tool RESULTS are untrusted content too —
         * they are re-fenced by the caller before reaching a model.
         */
        excerpt: item.content.slice(0, CONTEXT_BUDGET.maxCharsPerItem),
      })),
      refused: assembled.refused,
    },
  };
}

/**
 * Lists tasks the caller owns.
 *
 * public.tasks carries an owner-scoped select policy, so the caller's
 * client returns only their own rows. The explicit user_id filter is
 * retained as the second control (Phase 4 convention).
 */
async function taskList(
  args: ToolArgs,
  context: ToolContext,
): Promise<ToolOutcome> {
  let query = context.session.supabase
    .from("tasks")
    .select("id, title, status, created_at")
    .eq("user_id", context.session.userId)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (typeof args.projectId === "string") {
    query = query.eq("project_id", args.projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("SYRAVEN TOOL: task.list failed.", {
      userId: context.session.userId,
      error: error.message,
    });

    return {
      ok: false,
      reason: "TOOL_FAILED",
      message: "Tasks could not be listed.",
    };
  }

  const rows = data ?? [];

  return {
    ok: true,
    summary: `Listed ${rows.length} task(s).`,
    data: { tasks: rows },
  };
}

/**
 * Stores a note in the caller's knowledge base.
 *
 * `user_id` comes from the verified session, never from the model's
 * arguments — an agent cannot write knowledge on another user's behalf.
 * Records are created `private`, so an agent's output does not become
 * workspace-visible without a deliberate later change.
 */
async function knowledgeCreate(
  args: ToolArgs,
  context: ToolContext,
): Promise<ToolOutcome> {
  const title = typeof args.title === "string" ? args.title : "";
  const content = typeof args.content === "string" ? args.content : "";

  if (title.trim().length === 0 || content.trim().length === 0) {
    return {
      ok: false,
      reason: "TOOL_FAILED",
      message: "A title and content are required.",
    };
  }

  const { data, error } = await context.session.supabase
    .from("knowledge")
    .insert({
      user_id: context.session.userId,
      title,
      content,
      status: "active",
      visibility: "private",
      project_id:
        typeof args.projectId === "string" ? args.projectId : null,
      workspace_id: context.workspaceId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("SYRAVEN TOOL: knowledge.create failed.", {
      userId: context.session.userId,
      error: error.message,
    });

    return {
      ok: false,
      reason: "TOOL_FAILED",
      message: "The note could not be saved.",
    };
  }

  const id = (data as { id?: unknown } | null)?.id;

  return {
    ok: true,
    summary: `Saved note "${title.slice(0, 80)}".`,
    data: { id: typeof id === "string" ? id : null },
  };
}

/* -------------------------------------------------------------------------- */
/*                                 DISPATCH                                   */
/* -------------------------------------------------------------------------- */

type Executor = (
  args: ToolArgs,
  context: ToolContext,
) => Promise<ToolOutcome>;

/**
 * Tools that can actually run.
 *
 * A tool absent from this map is registered but not implemented, and is
 * refused at execution rather than silently reported as done.
 */
const EXECUTORS: Readonly<Record<string, Executor>> = {
  "knowledge.search": knowledgeSearch,
  "task.list": taskList,
  "knowledge.create": knowledgeCreate,
};

export function isExecutable(toolId: string): boolean {
  return toolId in EXECUTORS;
}

/**
 * Runs one authorized tool call.
 *
 * The caller MUST have resolved capability and, for high-risk tools,
 * verified an approval record before calling this. This function does
 * not re-authorize — it is the last step, not the gate.
 */
export async function executeTool(
  tool: ToolDefinition,
  args: ToolArgs,
  context: ToolContext,
): Promise<ToolOutcome> {
  const executor = EXECUTORS[tool.id];

  if (!executor) {
    /*
     * Registered but unimplemented. Failing here is deliberate: a stub
     * returning success would report work that never happened, which is
     * worse than an honest refusal.
     */
    return {
      ok: false,
      reason: "TOOL_NOT_IMPLEMENTED",
      message: "This action is not available yet.",
    };
  }

  try {
    return await executor(args, context);
  } catch (cause) {
    /*
     * An executor throwing must not surface provider or database
     * internals to the caller. The detail is logged; the client gets a
     * generic failure.
     */
    console.error("SYRAVEN TOOL: executor threw.", {
      tool: tool.id,
      userId: context.session.userId,
      name: cause instanceof Error ? cause.name : "unknown",
    });

    return {
      ok: false,
      reason: "TOOL_FAILED",
      message: "The action could not be completed.",
    };
  }
}
