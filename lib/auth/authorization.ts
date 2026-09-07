/**
 * SYRAVEN — Server-side authorization
 * lib/auth/authorization.ts
 *
 * SECURITY BOUNDARY.
 *
 * Phase 1 established *authentication*: who the caller is, derived only
 * from a verified session (lib/auth/session.ts).
 *
 * This module establishes *authorization*: what that caller may reach.
 * It answers one question — does this user have access to this tenant
 * resource? — and it answers it against the database, never against
 * client input.
 *
 * THE PROBLEM THIS SOLVES
 *
 * Routes accept `workspaceId`, `projectId` and `teamId` as request
 * parameters and pass them straight into queries. Today those queries
 * also filter on `user_id`, so a wrong id yields nothing — but that is a
 * single layer of defence resting on every query remembering the filter.
 * ARCHITECTURE_AUDIT.md §8.1 is what happens when one forgets.
 *
 * These helpers verify membership explicitly, so a tenant key from a
 * client is proven before it is trusted.
 *
 * THE MODEL
 *
 *   auth.users
 *     └── organization_members (role, status)
 *           └── organizations
 *                 └── workspaces
 *                       └── projects
 *
 * Membership is held at the ORGANIZATION level. A workspace is reachable
 * when the caller is an active member of its owning organization.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

/**
 * Organization roles, ordered least to most privileged.
 *
 * Mirrors the CHECK constraint on `organization_members.role` in
 * 20260901154222_syraven_enterprise_core.sql. Do not add a value here
 * that the database does not accept.
 */
export const ORGANIZATION_ROLES = [
  "viewer",
  "member",
  "manager",
  "admin",
  "owner",
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

/**
 * Rank used for "at least this role" checks. Higher is more privileged.
 */
const ROLE_RANK: Record<OrganizationRole, number> = {
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export type AuthorizationDenialReason =
  | "NOT_A_MEMBER"
  | "MEMBERSHIP_INACTIVE"
  | "INSUFFICIENT_ROLE"
  | "RESOURCE_NOT_FOUND"
  | "LOOKUP_FAILED";

export type AuthorizationResult =
  | {
      allowed: true;
      organizationId: string;
      role: OrganizationRole;
    }
  | {
      allowed: false;
      reason: AuthorizationDenialReason;
    };

/* -------------------------------------------------------------------------- */
/*                               ROLE HELPERS                                 */
/* -------------------------------------------------------------------------- */

export function isOrganizationRole(
  value: unknown,
): value is OrganizationRole {
  return (
    typeof value === "string" &&
    (ORGANIZATION_ROLES as readonly string[]).includes(value)
  );
}

/**
 * True when `role` is at least as privileged as `minimum`.
 */
export function roleMeets(
  role: OrganizationRole,
  minimum: OrganizationRole,
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/* -------------------------------------------------------------------------- */
/*                            MEMBERSHIP LOOKUP                               */
/* -------------------------------------------------------------------------- */

/**
 * Resolves the caller's membership in an organization.
 *
 * Only `status = 'active'` counts. An `invited` or `suspended` row is a
 * record of a relationship, not a grant of access.
 */
export async function getOrganizationMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string,
): Promise<AuthorizationResult> {
  if (!isUuid(organizationId)) {
    return { allowed: false, reason: "RESOURCE_NOT_FOUND" };
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("SYRAVEN AUTHZ: membership lookup failed.", {
      organizationId,
      error: error.message,
    });

    /*
     * Fail closed. A lookup error must never read as "allowed".
     */
    return { allowed: false, reason: "LOOKUP_FAILED" };
  }

  if (!data) {
    return { allowed: false, reason: "NOT_A_MEMBER" };
  }

  const record = data as { role: unknown; status: unknown };

  if (record.status !== "active") {
    return { allowed: false, reason: "MEMBERSHIP_INACTIVE" };
  }

  if (!isOrganizationRole(record.role)) {
    /*
     * An unrecognised role is treated as no access rather than mapped to
     * a default, so a database value this code does not understand can
     * never silently grant more than intended.
     */
    console.error("SYRAVEN AUTHZ: unrecognised organization role.", {
      organizationId,
      role: record.role,
    });

    return { allowed: false, reason: "INSUFFICIENT_ROLE" };
  }

  return {
    allowed: true,
    organizationId,
    role: record.role,
  };
}

/* -------------------------------------------------------------------------- */
/*                           RESOURCE AUTHORIZATION                           */
/* -------------------------------------------------------------------------- */

/**
 * Authorizes access to a workspace.
 *
 * Resolves the workspace's owning organization, then checks membership.
 * A workspace that does not exist and a workspace the caller cannot see
 * both return RESOURCE_NOT_FOUND, so ids are not enumerable.
 */
export async function authorizeWorkspace(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceId: string,
  options: { minimumRole?: OrganizationRole } = {},
): Promise<AuthorizationResult> {
  if (!isUuid(workspaceId)) {
    return { allowed: false, reason: "RESOURCE_NOT_FOUND" };
  }

  const { data, error } = await supabase
    .from("workspaces")
    .select("organization_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("SYRAVEN AUTHZ: workspace lookup failed.", {
      workspaceId,
      error: error.message,
    });

    return { allowed: false, reason: "LOOKUP_FAILED" };
  }

  const organizationId = (data as { organization_id?: unknown } | null)
    ?.organization_id;

  if (typeof organizationId !== "string") {
    return { allowed: false, reason: "RESOURCE_NOT_FOUND" };
  }

  const membership = await getOrganizationMembership(
    supabase,
    userId,
    organizationId,
  );

  return applyMinimumRole(membership, options.minimumRole);
}

/**
 * Authorizes access to a project.
 *
 * `projects` carries both `organization_id` and `user_id`. A project is
 * reachable when the caller owns it, or when it belongs to an
 * organization the caller is an active member of.
 */
export async function authorizeProject(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  options: { minimumRole?: OrganizationRole } = {},
): Promise<AuthorizationResult> {
  if (!isUuid(projectId)) {
    return { allowed: false, reason: "RESOURCE_NOT_FOUND" };
  }

  const { data, error } = await supabase
    .from("projects")
    .select("organization_id, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    console.error("SYRAVEN AUTHZ: project lookup failed.", {
      projectId,
      error: error.message,
    });

    return { allowed: false, reason: "LOOKUP_FAILED" };
  }

  if (!data) {
    return { allowed: false, reason: "RESOURCE_NOT_FOUND" };
  }

  const record = data as {
    organization_id?: unknown;
    user_id?: unknown;
  };

  /*
   * Direct ownership. `owner` is reported because the owner of a
   * personal project holds full rights over it.
   */
  if (record.user_id === userId) {
    return {
      allowed: true,
      organizationId:
        typeof record.organization_id === "string"
          ? record.organization_id
          : "",
      role: "owner",
    };
  }

  if (typeof record.organization_id !== "string") {
    /*
     * A personal project belonging to somebody else. Reported as
     * not-found so ownership is not disclosed.
     */
    return { allowed: false, reason: "RESOURCE_NOT_FOUND" };
  }

  const membership = await getOrganizationMembership(
    supabase,
    userId,
    record.organization_id,
  );

  return applyMinimumRole(membership, options.minimumRole);
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

/**
 * Applies a minimum-role requirement to a membership result.
 */
function applyMinimumRole(
  result: AuthorizationResult,
  minimumRole: OrganizationRole | undefined,
): AuthorizationResult {
  if (!result.allowed || minimumRole === undefined) {
    return result;
  }

  if (!roleMeets(result.role, minimumRole)) {
    return { allowed: false, reason: "INSUFFICIENT_ROLE" };
  }

  return result;
}

/**
 * Validates UUID shape before it reaches a query.
 *
 * PostgREST rejects a malformed uuid with a 400 that differs from an
 * empty result, which would let a caller distinguish "bad id" from "not
 * yours". Checking here keeps both paths identical.
 */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
