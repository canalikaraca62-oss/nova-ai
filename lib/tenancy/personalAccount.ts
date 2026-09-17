/**
 * SYRAVEN — personal account provisioning
 * lib/tenancy/personalAccount.ts
 *
 * Phase 3, Batch 2-D1 (docs/engineering/SECURITY_EVIDENCE.md).
 *
 * THE ONLY APPLICATION CALLER of `public.provision_personal_account()`,
 * the single provisioning authority (20260917130000). It gives a
 * confirmed, signed-in user their organisation, owner membership and
 * default workspace — atomically, idempotently, under a per-user
 * transaction lock, and returns the existing ones without writing when
 * they already exist.
 *
 * IDENTITY
 *
 * The function takes no arguments and derives identity from auth.uid()
 * on the JWT carried by `client`. This helper therefore accepts a CLIENT,
 * never a user id, organisation id or anything from a request. It must be
 * called with the caller's own RLS client — never the service role, which
 * has no auth.uid() and no EXECUTE on the function.
 *
 * FAILURE
 *
 * Every non-success is returned as a failure, never thrown past this
 * boundary and never softened into success (see personalAccountResult).
 */

import "server-only";

import {
  interpretProvisioning,
  type PersonalAccountResult,
} from "./personalAccountResult";

export type { PersonalAccountFailure, PersonalAccountResult } from "./personalAccountResult";

/**
 * The narrow surface this helper needs. Callers pass their RLS client
 * through `as unknown as PersonalAccountClient`, the same pattern
 * lib/search/semantic.ts uses for its RPC.
 */
export interface PersonalAccountClient {
  rpc(name: "provision_personal_account"): PromiseLike<{
    data: unknown;
    error: { code?: unknown } | null;
  }>;
}

export async function ensurePersonalAccount(
  client: PersonalAccountClient,
): Promise<PersonalAccountResult> {
  try {
    const { data, error } = await client.rpc("provision_personal_account");

    const result = interpretProvisioning(data, error);

    if (!result.ok) {
      /* Code and classification only: no identity, no message, no body. */
      console.error("SYRAVEN TENANCY: personal account provisioning failed.", {
        reason: result.reason,
        code: typeof error?.code === "string" ? error.code : null,
      });
    }

    return result;
  } catch {
    console.error("SYRAVEN TENANCY: personal account provisioning failed.", {
      reason: "UNAVAILABLE",
      code: null,
    });

    return { ok: false, reason: "UNAVAILABLE" };
  }
}
