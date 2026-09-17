/**
 * SYRAVEN — personal account provisioning result
 * lib/tenancy/personalAccountResult.ts
 *
 * Phase 3, Batch 2-D1 (docs/engineering/SECURITY_EVIDENCE.md).
 *
 * Classifies the PostgREST response of `public.provision_personal_account()`
 * into the only outcomes the application acts on. Pure and dependency-free
 * so the classification — which decides whether a login succeeds — is
 * unit-tested directly.
 *
 * FAIL CLOSED. Success requires EXACTLY the function's contract:
 * `{ organization_id: uuid, workspace_id: uuid, created: boolean }`.
 * Anything else — an error, a null, an array, a missing, extra or
 * mistyped field — is a failure. A response that merely looks successful
 * must never let a caller in without a real organisation and workspace.
 */

export type PersonalAccountFailure =
  /* 42501: no verified identity, email not confirmed, or no EXECUTE. */
  | "FORBIDDEN"
  /* Anything else: function missing (PGRST202), network, 5xx, bad shape. */
  | "UNAVAILABLE";

export type PersonalAccountResult =
  | {
      ok: true;
      organizationId: string;
      workspaceId: string;
      created: boolean;
    }
  | {
      ok: false;
      reason: PersonalAccountFailure;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONTRACT_KEYS = "created,organization_id,workspace_id";

const UNAVAILABLE: PersonalAccountResult = { ok: false, reason: "UNAVAILABLE" };

/**
 * `error` is the PostgREST error object (or null); `data` is the body.
 * Only the error `code` is read — never its message, which can carry
 * request context.
 */
export function interpretProvisioning(
  data: unknown,
  error: { code?: unknown } | null | undefined,
): PersonalAccountResult {
  if (error !== null && error !== undefined) {
    return error.code === "42501"
      ? { ok: false, reason: "FORBIDDEN" }
      : UNAVAILABLE;
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return UNAVAILABLE;
  }

  const record = data as Record<string, unknown>;

  if (Object.keys(record).sort().join(",") !== CONTRACT_KEYS) {
    return UNAVAILABLE;
  }

  const { organization_id: organizationId, workspace_id: workspaceId, created } = record;

  if (
    typeof organizationId !== "string" ||
    typeof workspaceId !== "string" ||
    !UUID.test(organizationId) ||
    !UUID.test(workspaceId) ||
    typeof created !== "boolean"
  ) {
    return UNAVAILABLE;
  }

  return { ok: true, organizationId, workspaceId, created };
}
