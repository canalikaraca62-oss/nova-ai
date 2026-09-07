/**
 * SYRAVEN — Memory hierarchy and authorization model
 * lib/memory/hierarchy.ts
 *
 * Phase 8 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY BOUNDARY.
 *
 * Defines what memory scopes exist, who may read each, and how they
 * compose into an AI request's context.
 *
 * WHY THIS EXISTS
 *
 * `public.knowledge` already carries user_id, workspace_id, project_id,
 * team_id, visibility and status — the columns for a real hierarchy —
 * but nothing in the application interpreted them as one. Retrieval
 * filtered on `user_id` alone, so:
 *
 *   - workspace/project scoping was decorative
 *   - `visibility` was never enforced at read time
 *   - `status` was never checked, so ARCHIVED and DELETED records were
 *     retrievable
 *
 * THE HIERARCHY
 *
 *     user      — private to one person. NEVER visible to anyone else,
 *                 including workspace admins and the org owner.
 *     project   — shared with members of the owning project
 *     workspace — shared with members of the owning workspace
 *     org       — shared across the organization
 *
 * PRECEDENCE (most specific wins when assembling context)
 *
 *     user > project > workspace > org
 *
 * A user's private note about a project outranks the shared project
 * note, because it is the more specific statement of what THAT user
 * knows.
 *
 * THE ONE RULE THAT MATTERS MOST
 *
 * Private user memory never becomes visible to another user merely
 * because they share a workspace. Sharing a tenant is not sharing a
 * mind.
 */

import "server-only";

/* -------------------------------------------------------------------------- */
/*                                  SCOPES                                    */
/* -------------------------------------------------------------------------- */

export const MEMORY_SCOPES = [
  "user",
  "project",
  "workspace",
  "org",
] as const;

export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export function isMemoryScope(value: unknown): value is MemoryScope {
  return (
    typeof value === "string" &&
    (MEMORY_SCOPES as readonly string[]).includes(value)
  );
}

/**
 * Precedence when the same fact appears at several scopes.
 *
 * Higher wins. Deliberately the inverse of "breadth": the narrower the
 * audience, the more specific the claim.
 */
export const SCOPE_PRECEDENCE: Record<MemoryScope, number> = {
  org: 0,
  workspace: 1,
  project: 2,
  user: 3,
};

/* -------------------------------------------------------------------------- */
/*                                VISIBILITY                                  */
/* -------------------------------------------------------------------------- */

/**
 * Values `public.knowledge.visibility` may hold.
 *
 * Mirrors the column's existing vocabulary — this module interprets it
 * rather than redefining it.
 */
export const VISIBILITY_VALUES = [
  "private",
  "workspace",
  "public",
] as const;

export type Visibility = (typeof VISIBILITY_VALUES)[number];

/**
 * Statuses whose records may be RETRIEVED into AI context.
 *
 * Anything else — archived, deleted, draft — is excluded. This is the
 * control that stops deleted knowledge silently re-entering a prompt.
 */
export const RETRIEVABLE_STATUSES = ["active"] as const;

export function isRetrievableStatus(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (RETRIEVABLE_STATUSES as readonly string[]).includes(value)
  );
}

/* -------------------------------------------------------------------------- */
/*                            ACCESS DECISIONS                                */
/* -------------------------------------------------------------------------- */

/**
 * A stored memory/knowledge record, reduced to the fields that decide
 * access. Deliberately not the full row: nothing here should tempt a
 * caller into authorizing on content.
 */
export interface MemoryRecordDescriptor {
  ownerUserId: string | null;
  workspaceId: string | null;
  projectId: string | null;
  visibility: string | null;
  status: string | null;
}

/**
 * The caller's proven position in the tenant hierarchy.
 *
 * Every field is derived server-side: `userId` from the verified
 * session, the workspace/project sets from membership already checked by
 * lib/api/tenantGuard.ts. None of it is client-supplied.
 */
export interface MemoryAccessContext {
  userId: string;
  /** Workspaces the caller is a proven member of. */
  workspaceIds: ReadonlySet<string>;
  /** Projects the caller is a proven member of, or owns. */
  projectIds: ReadonlySet<string>;
}

export type AccessDecision =
  | { allowed: true; scope: MemoryScope }
  | {
      allowed: false;
      reason:
        | "NOT_RETRIEVABLE_STATUS"
        | "PRIVATE_TO_ANOTHER_USER"
        | "OUTSIDE_TENANT";
    };

/**
 * Decides whether one record may enter this caller's context.
 *
 * Order matters. Status is checked FIRST so that a deleted record is
 * refused even for its own owner — otherwise "delete" would only mean
 * "hide from others".
 */
export function canRetrieve(
  record: MemoryRecordDescriptor,
  context: MemoryAccessContext,
): AccessDecision {
  if (!isRetrievableStatus(record.status)) {
    return { allowed: false, reason: "NOT_RETRIEVABLE_STATUS" };
  }

  const isOwner =
    record.ownerUserId !== null && record.ownerUserId === context.userId;

  /*
   * PRIVATE means private, full stop. A workspace admin, an org owner,
   * and a project collaborator all see nothing here. This is the rule
   * the phase brief singles out, so it is checked before any tenant
   * membership can widen access.
   */
  if (record.visibility === "private") {
    return isOwner
      ? { allowed: true, scope: "user" }
      : { allowed: false, reason: "PRIVATE_TO_ANOTHER_USER" };
  }

  /* The owner always reaches their own non-private records. */
  if (isOwner) {
    return { allowed: true, scope: scopeOf(record) };
  }

  /*
   * Shared records require proven membership of the owning tenant.
   * Membership sets come from the database, never from the request.
   */
  if (
    record.projectId !== null &&
    context.projectIds.has(record.projectId)
  ) {
    return { allowed: true, scope: "project" };
  }

  if (
    record.workspaceId !== null &&
    context.workspaceIds.has(record.workspaceId)
  ) {
    return { allowed: true, scope: "workspace" };
  }

  /*
   * No membership path. Note there is deliberately no "public means
   * everyone" branch: `visibility = 'public'` in this schema means
   * "visible across the owning tenant", not "visible to the internet".
   * Treating it as global would leak across tenants.
   */
  return { allowed: false, reason: "OUTSIDE_TENANT" };
}

/**
 * The scope a record belongs to, from its own columns.
 *
 * Most specific first — a record naming a project is project memory even
 * if it also names a workspace.
 */
export function scopeOf(record: MemoryRecordDescriptor): MemoryScope {
  if (record.visibility === "private") return "user";
  if (record.projectId !== null) return "project";
  if (record.workspaceId !== null) return "workspace";
  return "org";
}

/**
 * Orders records for context assembly: most specific scope first, so
 * that budget truncation drops the broadest material rather than the
 * most relevant.
 */
export function compareByPrecedence(
  a: MemoryRecordDescriptor,
  b: MemoryRecordDescriptor,
): number {
  return SCOPE_PRECEDENCE[scopeOf(b)] - SCOPE_PRECEDENCE[scopeOf(a)];
}
