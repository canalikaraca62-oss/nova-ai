/**
 * SYRAVEN — agent_approvals migration security tests
 *
 * Phase 9 approval persistence.
 *
 * Static checks on the migration that backs human-in-the-loop approval
 * for high-risk agent actions. They do not connect to a database.
 *
 * The claim under test: an approval is a statement a specific human made
 * about a specific action, and the SCHEMA — not only the application —
 * enforces that. A row saying "approved" that nobody decided, a grant
 * for someone else, or a second live grant for the same action must all
 * be unrepresentable.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = "20260905120000_syraven_agent_approvals.sql";

const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", MIGRATION),
  "utf8",
);

/** Strips line comments so assertions test statements, not prose. */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

const CODE = stripSqlComments(SQL);
const NORM = CODE.replace(/\s+/g, " ").toLowerCase();

/* Extracts one `create policy "<name>" ... ;` statement. */
function policy(name: string): string {
  const start = NORM.indexOf(`create policy "${name}"`);
  assert.ok(start > 0, `policy ${name} must exist`);

  const end = NORM.indexOf(";", start);
  assert.ok(end > start, `policy ${name} must terminate`);

  return NORM.slice(start, end);
}

/* -------------------------------------------------------------------------- */
/*                            SAFETY OF THE FILE                              */
/* -------------------------------------------------------------------------- */

void describe("Migration is additive and idempotent", () => {
  void test("the table is created idempotently", () => {
    assert.match(
      NORM,
      /create table if not exists public\.agent_approvals/,
      "must be create table if not exists",
    );
  });

  void test("every index is created idempotently", () => {
    const creates = NORM.match(/create (unique )?index/g) ?? [];
    const guarded = NORM.match(/create (unique )?index if not exists/g) ?? [];

    assert.ok(creates.length > 0, "the migration must create indexes");
    assert.equal(
      creates.length,
      guarded.length,
      "every index must use if not exists",
    );
  });

  void test("policies are re-appliable", () => {
    const drops = NORM.match(/drop policy if exists/g) ?? [];
    const creates = NORM.match(/create policy/g) ?? [];

    assert.equal(
      drops.length,
      creates.length,
      "each create policy needs a matching drop policy if exists",
    );
  });

  void test("nothing destructive is present", () => {
    for (const forbidden of [
      /\bdrop\s+table\b/,
      /\bdrop\s+column\b/,
      /\btruncate\b/,
      /\bdelete\s+from\b/,
      /\bdrop\s+database\b/,
      /\bdrop\s+schema\b/,
      /\bdrop\s+function\b/,
    ]) {
      assert.doesNotMatch(NORM, forbidden, `forbidden: ${forbidden}`);
    }
  });

  void test("no existing table is altered except to enable RLS", () => {
    const alters = NORM.match(/alter table [a-z_.]+/g) ?? [];

    for (const a of alters) {
      assert.ok(
        a.includes("public.agent_approvals"),
        `must not alter another table: ${a}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                        THE RECORD CANNOT BE FORGED                         */
/* -------------------------------------------------------------------------- */

void describe("Schema constraints make bad approvals unrepresentable", () => {
  void test("an approved row must name who decided it, and when", () => {
    /*
     * The whole point of a server-side approval: a row reading
     * "approved" with a null decider is an approval nobody made.
     */
    assert.match(NORM, /constraint agent_approvals_decided_fields_present/);
    assert.match(NORM, /decided_by_user_id is not null/);
    assert.match(NORM, /decided_at is not null/);
  });

  void test("the requested user is required and real", () => {
    assert.match(
      NORM,
      /requested_for_user_id uuid not null references auth\.users\(id\)/,
      "the approver must be a real authenticated user",
    );
  });

  void test("who was asked and who decided are separate columns", () => {
    /*
     * Kept distinct so verifyApproval() can COMPARE them. Collapsing
     * them into one column would make "a colleague approved it" and
     * "you approved it" indistinguishable.
     */
    assert.match(NORM, /requested_for_user_id/);
    assert.match(NORM, /decided_by_user_id/);
  });

  void test("risk is constrained to the registry's levels", () => {
    assert.match(NORM, /check \(risk in \('low', 'medium', 'high'\)\)/);
  });

  void test("status is constrained to the known lifecycle", () => {
    assert.match(
      NORM,
      /status in \('pending', 'approved', 'rejected', 'expired', 'used'\)/,
    );
  });

  void test("a new approval starts pending, never approved", () => {
    assert.match(NORM, /status text not null default 'pending'/);
  });

  void test("every approval has a hard expiry", () => {
    /*
     * An approval is a statement about a moment. One that never expires
     * is a standing grant nobody remembers issuing.
     */
    assert.match(NORM, /expires_at timestamptz not null/);
    assert.match(NORM, /constraint agent_approvals_expires_after_created/);
    assert.match(NORM, /check \(expires_at > created_at\)/);
  });

  void test("the effect shown to the human is bounded", () => {
    assert.match(NORM, /char_length\(effect\) <= 1000/);
  });
});

/* -------------------------------------------------------------------------- */
/*                             REPLAY PREVENTION                              */
/* -------------------------------------------------------------------------- */

void describe("Replay and duplicate grants", () => {
  void test("only one live approval per execution, tool and user", () => {
    const idx = NORM.slice(
      NORM.indexOf("create unique index if not exists agent_approvals_live"),
      NORM.indexOf("create index if not exists agent_approvals_lookup_idx"),
    );

    assert.ok(idx.length > 0, "the live-uniqueness index must exist");

    for (const col of [
      "execution_key",
      "tool_id",
      "requested_for_user_id",
    ]) {
      assert.ok(idx.includes(col), `uniqueness must include ${col}`);
    }
  });

  void test("uniqueness applies only to non-terminal states", () => {
    /*
     * Partial, so the audit trail accumulates: rejected/expired/used
     * rows stay, while a second live grant cannot be created.
     */
    const idx = NORM.slice(
      NORM.indexOf("agent_approvals_live_unique_idx"),
    );

    const where = idx.slice(idx.indexOf("where"), idx.indexOf(";"));

    assert.ok(
      where.includes("'pending'") && where.includes("'approved'"),
      "the partial index must cover pending and approved",
    );
    assert.ok(
      !where.includes("'used'") && !where.includes("'rejected'"),
      "terminal states must be excluded so history is retained",
    );
  });

  void test("the execution key is stored, binding an approval to one run", () => {
    assert.match(NORM, /execution_key text not null/);
  });
});

/* -------------------------------------------------------------------------- */
/*                          ROW LEVEL SECURITY                                */
/* -------------------------------------------------------------------------- */

void describe("RLS prevents cross-tenant and forged approvals", () => {
  void test("RLS is enabled", () => {
    assert.match(
      NORM,
      /alter table public\.agent_approvals enable row level security/,
    );
  });

  void test("select is limited to your own approvals in your org", () => {
    const p = policy("agent_approvals_select_own");

    assert.ok(
      p.includes("auth.uid() = requested_for_user_id"),
      "must scope to the acting user",
    );
    assert.ok(
      p.includes("is_organization_member(organization_id)"),
      "must scope to the caller's organization",
    );
  });

  void test("insert cannot self-grant an already-approved row", () => {
    /*
     * The critical half. Without the status restriction a caller could
     * insert `status = 'approved'` and authorize their own high-risk
     * action — reintroducing exactly the Phase 9 vulnerability.
     */
    const p = policy("agent_approvals_insert_own");

    assert.ok(
      p.includes("status = 'pending'"),
      "an inserted approval must start pending",
    );
    assert.ok(
      p.includes("decided_by_user_id is null"),
      "an inserted approval must name no decider",
    );
    assert.ok(
      p.includes("auth.uid() = requested_for_user_id"),
      "you may only request an approval for yourself",
    );
  });

  void test("insert is tenant-scoped", () => {
    const p = policy("agent_approvals_insert_own");

    assert.ok(
      p.includes("is_organization_member(organization_id)"),
      "cannot create an approval inside another org",
    );
  });

  void test("update restricts both which rows and what they become", () => {
    /*
     * `using` alone would let a user rewrite their own row to name
     * someone else as the decider. Both clauses are required.
     */
    const p = policy("agent_approvals_update_own");

    assert.ok(p.includes("using"), "must have a using clause");
    assert.ok(p.includes("with check"), "must have a with check clause");

    const using = p.slice(p.indexOf("using"), p.indexOf("with check"));
    const check = p.slice(p.indexOf("with check"));

    assert.ok(
      using.includes("auth.uid() = requested_for_user_id"),
      "only your own approvals may be updated",
    );
    assert.ok(
      check.includes("decided_by_user_id = auth.uid()"),
      "you can only record YOURSELF as the decider",
    );
  });

  void test("a terminal approval cannot be revived into a grant", () => {
    const p = policy("agent_approvals_update_own");
    const using = p.slice(p.indexOf("using"), p.indexOf("with check"));

    assert.ok(
      using.includes("'pending'") || using.includes("'approved'"),
      "only non-terminal rows may be updated",
    );
    assert.ok(
      !using.includes("'rejected'") && !using.includes("'used'"),
      "rejected or used approvals must not be updatable",
    );
  });

  void test("no delete policy exists — approvals are an audit trail", () => {
    /*
     * A user who could delete approvals could erase the evidence of the
     * grant they used for a destructive action.
     */
    assert.ok(
      !NORM.includes("for delete"),
      "no authenticated caller may delete an approval record",
    );
  });

  void test("every policy targets authenticated, never public or anon", () => {
    const targets = NORM.match(/to (authenticated|anon|public)/g) ?? [];

    assert.ok(targets.length > 0, "policies must declare a role");

    for (const t of targets) {
      assert.equal(t, "to authenticated", `unexpected policy target: ${t}`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                    ALIGNMENT WITH THE APPLICATION                          */
/* -------------------------------------------------------------------------- */

void describe("Schema matches the Phase 9 approval contract", () => {
  const EXECUTION = readFileSync(
    join(process.cwd(), "lib", "orchestration", "execution.ts"),
    "utf8",
  );

  void test("every field verifyApproval() checks is persisted", () => {
    /*
     * If a dimension the code compares had no column, the check would
     * silently pass on undefined for every row.
     */
    for (const column of [
      "execution_key",
      "requested_for_user_id",
      "decided_by_user_id",
      "tool_id",
      "workspace_id",
      "project_id",
      "status",
      "expires_at",
    ]) {
      assert.ok(
        NORM.includes(column),
        `verifyApproval depends on ${column}`,
      );
    }
  });

  void test("the lifecycle states match ApprovalRecord", () => {
    for (const state of [
      "pending",
      "approved",
      "rejected",
      "expired",
      "used",
    ]) {
      assert.ok(
        EXECUTION.includes(`"${state}"`),
        `execution.ts must know the ${state} state`,
      );
      assert.ok(
        NORM.includes(`'${state}'`),
        `the schema must know the ${state} state`,
      );
    }
  });

  void test("tenant columns reuse the existing tables", () => {
    assert.match(NORM, /references public\.organizations\(id\)/);
    assert.match(NORM, /references public\.workspaces\(id\)/);
    assert.match(NORM, /references public\.projects\(id\)/);
  });

  void test("it reuses the existing membership helper", () => {
    /* No new access-control mechanism is introduced. */
    assert.match(NORM, /public\.is_organization_member\(/);
  });
});
