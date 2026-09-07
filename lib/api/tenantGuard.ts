/**
 * SYRAVEN — Tenant boundary guard for API routes
 * lib/api/tenantGuard.ts
 *
 * SECURITY BOUNDARY.
 *
 * Routes accept `workspaceId`, `projectId` and `teamId` from clients and
 * use them as query filters. Before Phase 3 nothing verified that the
 * caller could actually reach the named tenant — safety rested entirely
 * on each query also filtering `user_id`.
 *
 * These helpers make the check explicit and uniform, so a tenant key is
 * proven before it is trusted rather than trusted because a sibling
 * filter happens to be present.
 *
 * Usage:
 *
 *   const guard = await requireWorkspaceAccess(session, workspaceId);
 *   if (guard.denied) return guard.response;
 *
 *   // workspaceId is now proven reachable by session.userId
 */

import "server-only";

import { NextResponse } from "next/server";

import type { AuthenticatedSession } from "@/lib/auth/session";
import {
  type AuthorizationResult,
  type OrganizationRole,
  authorizeProject,
  authorizeWorkspace,
} from "@/lib/auth/authorization";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type TenantGuardOutcome =
  | {
      denied: false;
      organizationId: string;
      role: OrganizationRole;
    }
  | {
      denied: true;
      response: NextResponse;
    };

/* -------------------------------------------------------------------------- */
/*                              DENIAL RESPONSES                              */
/* -------------------------------------------------------------------------- */

/**
 * Converts an authorization denial into an HTTP response.
 *
 * Every denial reports 404, never 403.
 *
 * Rationale: a 403 confirms that the resource exists, which lets an
 * unauthorized caller enumerate workspace and project ids by probing.
 * A uniform 404 makes "does not exist" and "not yours" indistinguishable
 * from outside. The real reason is logged server-side instead.
 *
 * A LOOKUP_FAILED is the exception: that is a server fault, not a
 * statement about the caller, so it reports 500.
 */
function denialResponse(
  result: Extract<AuthorizationResult, { allowed: false }>,
  resourceKind: string,
  resourceId: string,
  userId: string,
): NextResponse {
  if (result.reason === "LOOKUP_FAILED") {
    console.error("SYRAVEN AUTHZ: lookup failed.", {
      resourceKind,
      resourceId,
      userId,
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AUTHORIZATION_UNAVAILABLE",
          message: "Access could not be verified.",
        },
      },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  console.warn("SYRAVEN AUTHZ: access denied.", {
    resourceKind,
    resourceId,
    userId,
    reason: result.reason,
  });

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `${resourceKind} not found.`,
      },
    },
    {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

/* -------------------------------------------------------------------------- */
/*                                  GUARDS                                    */
/* -------------------------------------------------------------------------- */

/**
 * Requires that the session user can reach the given workspace.
 */
export async function requireWorkspaceAccess(
  session: AuthenticatedSession,
  workspaceId: string,
  options: { minimumRole?: OrganizationRole } = {},
): Promise<TenantGuardOutcome> {
  const result = await authorizeWorkspace(
    session.supabase,
    session.userId,
    workspaceId,
    options,
  );

  if (!result.allowed) {
    return {
      denied: true,
      response: denialResponse(
        result,
        "Workspace",
        workspaceId,
        session.userId,
      ),
    };
  }

  return {
    denied: false,
    organizationId: result.organizationId,
    role: result.role,
  };
}

/**
 * Requires that the session user can reach the given project.
 */
export async function requireProjectAccess(
  session: AuthenticatedSession,
  projectId: string,
  options: { minimumRole?: OrganizationRole } = {},
): Promise<TenantGuardOutcome> {
  const result = await authorizeProject(
    session.supabase,
    session.userId,
    projectId,
    options,
  );

  if (!result.allowed) {
    return {
      denied: true,
      response: denialResponse(
        result,
        "Project",
        projectId,
        session.userId,
      ),
    };
  }

  return {
    denied: false,
    organizationId: result.organizationId,
    role: result.role,
  };
}

/**
 * Guards an OPTIONAL tenant filter.
 *
 * Routes commonly accept `?workspaceId=` as a narrowing filter. When it
 * is absent the request is fine — results stay scoped to the caller's
 * own rows. When it is present it must be proven, otherwise a caller
 * could name someone else's workspace and rely on a sibling `user_id`
 * filter being the only thing standing in the way.
 */
export async function requireOptionalWorkspaceAccess(
  session: AuthenticatedSession,
  workspaceId: string | null | undefined,
  options: { minimumRole?: OrganizationRole } = {},
): Promise<TenantGuardOutcome | null> {
  if (workspaceId === null || workspaceId === undefined || workspaceId === "") {
    return null;
  }

  return requireWorkspaceAccess(session, workspaceId, options);
}

/**
 * Guards an OPTIONAL project filter.
 */
export async function requireOptionalProjectAccess(
  session: AuthenticatedSession,
  projectId: string | null | undefined,
  options: { minimumRole?: OrganizationRole } = {},
): Promise<TenantGuardOutcome | null> {
  if (projectId === null || projectId === undefined || projectId === "") {
    return null;
  }

  return requireProjectAccess(session, projectId, options);
}
