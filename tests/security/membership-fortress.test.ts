/**
 * SYRAVEN — Membership fortress (Phase 3, Batch 1)
 * tests/security/membership-fortress.test.ts
 *
 * P1-1: an organization admin could insert any user into their
 * organization and use that membership to capture and then destroy the
 * victim's workspace data. Evidence: docs/engineering/SECURITY_EVIDENCE.md.
 *
 * There is no database in this suite, so the database-side invariants are
 * checked against an EFFECTIVE model rebuilt by replaying every migration
 * in apply order: the policies left standing, the privileges
 * `authenticated` ends up holding, and the last definition of the delete
 * guard. The live behaviour is proven separately by the TEST-only probe
 * (scripts/security/probe-batch1.mjs), which has NOT been run.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

/** Every migration in apply (filename) order, `--` comments removed. */
const MIGRATIONS: ReadonlyArray<readonly [string, string]> = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => [file, read("supabase", "migrations", file).replace(/--.*$/gm, "")] as const);

/** Splits SQL on semicolons that are not inside a `$$` body. */
function statements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let inBody = false;

  for (let index = 0; index < sql.length; index += 1) {
    if (sql.startsWith("$$", index)) {
      inBody = !inBody;
      current += "$$";
      index += 1;
      continue;
    }

    const char = sql[index] ?? "";

    if (char === ";" && !inBody) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) out.push(current.trim());

  return out.filter((statement) => statement.length > 0);
}

const ALL_STATEMENTS = MIGRATIONS.flatMap(([, sql]) => statements(sql));

/* -------------------------------------------------------------------------- */
/*                         EFFECTIVE POLICY MODEL                             */
/* -------------------------------------------------------------------------- */

interface Policy {
  readonly name: string;
  readonly verb: string;
  readonly text: string;
}

function effectivePolicies(table: string): Policy[] {
  const policies = new Map<string, Policy>();

  const drop = new RegExp(
    `^drop\\s+policy\\s+(?:if\\s+exists\\s+)?"([^"]+)"\\s+on\\s+public\\.${table}\\b`,
    "i",
  );
  const create = new RegExp(
    `^create\\s+policy\\s+"([^"]+)"\\s+on\\s+public\\.${table}\\s+for\\s+(all|select|insert|update|delete)\\b`,
    "i",
  );

  for (const statement of ALL_STATEMENTS) {
    const dropped = drop.exec(statement);
    if (dropped?.[1]) {
      policies.delete(dropped[1]);
      continue;
    }

    const created = create.exec(statement);
    if (created?.[1] && created[2]) {
      policies.set(created[1], {
        name: created[1],
        verb: created[2].toLowerCase(),
        text: statement,
      });
    }
  }

  return [...policies.values()];
}

function usingClause(policy: Policy): string {
  const start = policy.text.search(/\busing\s*\(/i);
  if (start === -1) return "";
  const check = policy.text.search(/\bwith\s+check\s*\(/i);
  return check > start ? policy.text.slice(start, check) : policy.text.slice(start);
}

function withCheckClause(policy: Policy): string {
  const start = policy.text.search(/\bwith\s+check\s*\(/i);
  return start === -1 ? "" : policy.text.slice(start);
}

/* -------------------------------------------------------------------------- */
/*                        EFFECTIVE PRIVILEGE MODEL                           */
/* -------------------------------------------------------------------------- */

interface Privileges {
  readonly table: Set<string>;
  readonly columns: Map<string, Set<string>>;
}

function splitPrivileges(list: string): Array<{ verb: string; columns: string[] | null }> {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of list) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  parts.push(current);

  return parts
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = /^(\w+)\s*(?:\(([^)]*)\))?$/.exec(part);
      const columns = match?.[2]
        ? match[2].split(",").map((column) => column.trim()).filter(Boolean)
        : null;
      return { verb: match?.[1] ?? part, columns };
    });
}

/**
 * The privileges `authenticated` holds on a table after every migration,
 * in order. A table-level REVOKE also removes the column grants for that
 * privilege, as it does in Postgres. Default privileges are ignored: they
 * apply only to tables created later.
 */
function effectivePrivileges(table: string, role = "authenticated"): Privileges {
  const state: Privileges = { table: new Set(), columns: new Map() };

  const onTable = new RegExp(`\\bon\\s+(?:table\\s+)?public\\.${table}\\s+(?:to|from)\\b`, "i");
  const onAllTables = /\bon\s+all\s+tables\s+in\s+schema\s+public\b/i;

  for (const statement of ALL_STATEMENTS) {
    if (/^alter\s+default\s+privileges/i.test(statement)) continue;

    const head = /^(grant|revoke)\s+([\s\S]+?)\s+on\s+/i.exec(statement);
    if (!head?.[1] || !head[2]) continue;
    if (!onTable.test(statement) && !onAllTables.test(statement)) continue;

    const grantees = (/\b(?:to|from)\s+([\s\S]+)$/i.exec(statement)?.[1] ?? "").toLowerCase();
    if (!new RegExp(`\\b${role}\\b`).test(grantees)) continue;

    const granting = head[1].toLowerCase() === "grant";

    for (const { verb, columns } of splitPrivileges(head[2])) {
      const verbs =
        verb === "all"
          ? ["select", "insert", "update", "delete", "truncate", "references", "trigger"]
          : [verb];

      for (const privilege of verbs) {
        if (columns) {
          const set = state.columns.get(privilege) ?? new Set<string>();
          for (const column of columns) {
            if (granting) set.add(column);
            else set.delete(column);
          }
          state.columns.set(privilege, set);
        } else if (granting) {
          state.table.add(privilege);
        } else {
          state.table.delete(privilege);
          state.columns.delete(privilege);
        }
      }
    }
  }

  return state;
}

function sorted(set: Set<string> | undefined): string[] {
  return [...(set ?? new Set<string>())].sort();
}

/* -------------------------------------------------------------------------- */
/*                              A. MEMBERSHIP                                 */
/* -------------------------------------------------------------------------- */

void describe("A. organization_members: no admin can capture another user", () => {
  const policies = effectivePolicies("organization_members");

  void test("the model sees the membership policies", () => {
    assert.ok(policies.length >= 3, `Only ${policies.length} policies parsed; the model is broken.`);
  });

  void test("no FOR ALL policy remains", () => {
    assert.deepEqual(
      policies.filter((policy) => policy.verb === "all").map((policy) => policy.name),
      [],
      "CRITICAL: a FOR ALL policy lets an admin insert and rewrite any membership.",
    );
  });

  void test("the only INSERT path is the caller's own membership in an organization they own", () => {
    const inserts = policies.filter((policy) => policy.verb === "insert");

    assert.deepEqual(inserts.map((policy) => policy.name), ["owners can create their own membership"]);

    const check = withCheckClause(inserts[0]!);
    assert.match(check, /user_id\s*=\s*auth\.uid\(\)/, "An insert must be for the caller only.");
    assert.match(check, /o\.owner_id\s*=\s*auth\.uid\(\)/, "The caller must own the organization.");
  });

  void test("an UPDATE can never reach an owner row", () => {
    const updates = policies.filter((policy) => policy.verb === "update");
    assert.ok(updates.length > 0, "Expected the non-owner UPDATE policy.");

    for (const policy of updates) {
      assert.match(
        usingClause(policy),
        /role\s*<>\s*'owner'/,
        `${policy.name} lets an UPDATE touch an owner membership.`,
      );
    }
  });

  void test("an UPDATE can never grant owner, and keeps role and status in range", () => {
    for (const policy of policies.filter((candidate) => candidate.verb === "update")) {
      const check = withCheckClause(policy);

      assert.ok(check.length > 0, `${policy.name} has no WITH CHECK.`);
      assert.match(check, /is_organization_admin\(\s*organization_id\s*\)/);

      const roles = /role\s+in\s*\(([^)]*)\)/i.exec(check)?.[1] ?? "";
      assert.deepEqual(
        roles.split(",").map((role) => role.trim()).sort(),
        ["'admin'", "'manager'", "'member'", "'viewer'"],
        `${policy.name} allows an unexpected role (owner must never be grantable).`,
      );

      const statuses = /status\s+in\s*\(([^)]*)\)/i.exec(check)?.[1] ?? "";
      assert.deepEqual(statuses.split(",").map((status) => status.trim()).sort(), ["'active'", "'suspended'"]);
    }
  });

  void test("no client DELETE can remove an owner membership", () => {
    const deletes = policies.filter((policy) => policy.verb === "delete");
    assert.ok(deletes.length > 0, "Expected a DELETE policy (members leave, admins remove non-owners).");

    for (const policy of deletes) {
      assert.match(usingClause(policy), /role\s*<>\s*'owner'/, `${policy.name} lets a client delete an owner row.`);
    }
  });

  void test("a non-owner member can leave, and an admin can remove non-owners", () => {
    const using = policies
      .filter((policy) => policy.verb === "delete")
      .map(usingClause)
      .join("\n");

    assert.match(using, /user_id\s*=\s*auth\.uid\(\)/);
    assert.match(using, /is_organization_admin\(\s*organization_id\s*\)/);
  });

  void test("SELECT stays member-scoped", () => {
    for (const policy of policies.filter((candidate) => candidate.verb === "select")) {
      assert.match(usingClause(policy), /is_organization_member\(\s*organization_id\s*\)/);
    }
  });

  void test("a client cannot change a membership's user_id or organization_id", () => {
    const privileges = effectivePrivileges("organization_members");

    assert.ok(!privileges.table.has("update"), "CRITICAL: table-level UPDATE lets a client move a membership.");
    assert.deepEqual(sorted(privileges.columns.get("update")), ["role", "status"]);
  });

  void test("a client INSERT names only the membership columns", () => {
    const privileges = effectivePrivileges("organization_members");

    assert.ok(!privileges.table.has("insert"), "Table-level INSERT reopens invited_by and id.");
    assert.deepEqual(sorted(privileges.columns.get("insert")), [
      "joined_at",
      "organization_id",
      "role",
      "status",
      "user_id",
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/*                         B. ORGANIZATION OWNERSHIP                          */
/* -------------------------------------------------------------------------- */

void describe("B. organizations: no client owner transfer", () => {
  const privileges = effectivePrivileges("organizations");

  void test("clients hold no table-level UPDATE on organizations", () => {
    assert.ok(!privileges.table.has("update"), "CRITICAL: table-level UPDATE lets an admin reassign owner_id.");
  });

  void test("owner_id is not client-updatable", () => {
    assert.ok(
      !sorted(privileges.columns.get("update")).includes("owner_id"),
      "CRITICAL: a client can transfer organization ownership.",
    );
  });

  void test("every other column keeps its UPDATE (plan and status are Batch 4)", () => {
    assert.deepEqual(sorted(privileges.columns.get("update")), [
      "avatar_url",
      "created_at",
      "description",
      "id",
      "metadata",
      "name",
      "plan",
      "slug",
      "status",
      "updated_at",
      "website",
    ]);
  });

  void test("a new organization is still owned by its creator", () => {
    const inserts = effectivePolicies("organizations").filter((policy) => policy.verb === "insert");
    assert.ok(inserts.length > 0);
    for (const policy of inserts) {
      assert.match(withCheckClause(policy), /owner_id\s*=\s*auth\.uid\(\)/);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                         C. WORKSPACE RESOLUTION                            */
/* -------------------------------------------------------------------------- */

void describe("C. a workspace lands only in an organization the caller owns", () => {
  /*
   * Batch 2-D1: the route no longer resolves the organisation with its own
   * membership lookup. It delegates to provision_personal_account()
   * (20260917130000) through lib/tenancy/personalAccount, and the Batch 1
   * ownership rule is enforced there, in SQL. These tests pin both halves:
   * the route has no second lookup, and the function's lookup is owner-only,
   * owner-bound, deterministic and without fallback.
   */
  const route = read("app", "api", "workspaces", "route.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const resolver = route.slice(
    route.indexOf("async function resolveOrganizationId"),
    route.indexOf("export const GET"),
  );

  const fn = read("supabase", "migrations", "20260917130000_syraven_personal_account_provisioning.sql")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .replace(/\s+/g, " ")
    .toLowerCase();

  const lookupStart = fn.indexOf("select m.organization_id into org_id");
  const lookup = lookupStart === -1 ? "" : fn.slice(lookupStart, fn.indexOf("limit 1;", lookupStart) + "limit 1;".length);

  void test("the resolver delegates to the single provisioning authority", () => {
    assert.ok(resolver.length > 0 && lookup.length > 0);
    assert.match(resolver, /ensurePersonalAccount\(\s*session\.supabase as unknown as PersonalAccountClient,?\s*\)/);
    assert.ok(!/\.from\(/.test(resolver), "The resolver must not query tables itself.");
  });

  void test("only an active OWNER membership of the caller qualifies", () => {
    assert.match(lookup, /m\.user_id = caller/);
    assert.match(lookup, /m\.status = 'active'/);
    assert.match(lookup, /m\.role = 'owner'/, "A non-owner membership can redirect workspace creation.");
  });

  void test("the membership is bound to the organization's server-side owner", () => {
    assert.match(lookup, /join public\.organizations o on o\.id = m\.organization_id/, "Without the join the owner filter does not constrain the row.");
    assert.match(lookup, /o\.owner_id = caller/, "A membership whose organization the caller does not own can redirect workspace creation.");
  });

  void test("the selection is deterministic: ordered, then limited", () => {
    const orderAt = lookup.indexOf("order by m.created_at asc");
    const limitAt = lookup.indexOf("limit 1;");

    assert.ok(orderAt !== -1, "CRITICAL: an unordered limit 1 picks an arbitrary organization.");
    assert.ok(limitAt > orderAt, "The order must be applied before the limit.");
  });

  void test("there is no fallback to any other membership", () => {
    assert.equal([...fn.matchAll(/from public\.organization_members/g)].length, 1, "A second membership lookup is a fallback to an arbitrary organization.");
    assert.ok(!/\.from\("organization_members"\)/.test(route), "The route must not add its own membership lookup.");
  });

  void test("a resolution failure fails closed before any workspace insert", () => {
    const post = route.slice(route.indexOf("export const POST"));
    const failAt = post.search(/if \(!organization\.ok\) \{[\s\S]*?return fail\(/);
    const insertAt = post.indexOf('.from("workspaces")');

    assert.match(resolver, /if \(!account\.ok\) \{\s*return \{ ok: false, status: account\.reason === "FORBIDDEN" \? 403 : 503 \};/);
    assert.ok(failAt !== -1 && insertAt > failAt, "A resolution failure must stop before a workspace is inserted.");
  });
});

/* -------------------------------------------------------------------------- */
/*                         D. DESTRUCTIVE DELETE GUARD                        */
/* -------------------------------------------------------------------------- */

const GUARD = "refuse_workspace_delete_with_foreign_data";
const TRIGGER = "workspaces_refuse_foreign_data_delete";

/** Every child table and the ownership column(s) the guard must check. */
const GUARDED: Readonly<Record<string, readonly string[]>> = {
  tasks: ["user_id"],
  teams: ["owner_id"],
  knowledge: ["user_id"],
  canvases: ["user_id"],
  projects: ["user_id", "owner_id"],
  agent_approvals: ["requested_for_user_id"],
};

/** Tables that reference workspaces but are deliberately not guarded. */
const EXCLUDED: Readonly<Record<string, string>> = {
  audit_logs: "an organization audit record, not user-owned data",
  workflows: "an organization-level definition, not user-owned data",
  integration_connections:
    "migration NOT APPLIED; Batch 9 must extend the guard before the table exists",
};

function lastGuardDefinition(): string {
  const pattern = new RegExp(`^create\\s+or\\s+replace\\s+function\\s+public\\.${GUARD}\\s*\\(`, "i");
  return ALL_STATEMENTS.filter((statement) => pattern.test(statement)).at(-1) ?? "";
}

function segmentFor(body: string, table: string): string {
  const start = body.search(new RegExp(`from\\s+public\\.${table}\\b`, "i"));
  if (start === -1) return "";
  const rest = body.slice(start + 1);
  const next = rest.search(/from\s+public\.|\bthen\b/i);
  return next === -1 ? body.slice(start) : body.slice(start, start + 1 + next);
}

void describe("D. a workspace delete never destroys or detaches another user's data", () => {
  const guard = lastGuardDefinition();

  void test("the guard function exists", () => {
    assert.ok(guard.length > 0, `No definition of public.${GUARD}().`);
  });

  void test("it is SECURITY DEFINER with a pinned search_path", () => {
    assert.match(guard, /\bsecurity\s+definer\b/i, "As invoker, RLS would hide other users' rows and the guard would pass.");
    assert.match(guard, /\bset\s+search_path\s*=\s*public\b/i);
  });

  void test("the actor comes from the verified session, never from input", () => {
    assert.match(guard, /actor\s+uuid\s*:=\s*auth\.uid\(\)/);
    assert.match(guard, /returns\s+trigger/i);
    assert.match(guard, /function\s+public\.\w+\s*\(\s*\)/i, "The guard takes no arguments.");
  });

  for (const [table, columns] of Object.entries(GUARDED)) {
    void test(`another user's ${table} row blocks the delete, and so does ambiguous ownership`, () => {
      const segment = segmentFor(guard, table);

      assert.ok(segment.length > 0, `CRITICAL: the guard does not check public.${table}.`);
      assert.match(segment, /workspace_id\s*=\s*old\.id/);
      assert.match(segment, /actor\s+is\s+null\s+or/, `${table}: a delete with no signed-in actor must be refused.`);

      for (const column of columns) {
        assert.match(
          segment,
          new RegExp(`\\b${column}\\s+is\\s+distinct\\s+from\\s+actor\\b`),
          `${table}.${column}: a NULL or foreign owner must block the delete ("<>" lets NULL through).`,
        );
      }
    });
  }

  void test("a blocked delete raises; it never silently skips or succeeds", () => {
    assert.match(guard, /\braise\s+exception\b/i);
    assert.match(guard, /errcode\s*=\s*'42501'/);
    assert.ok(!/return\s+null/i.test(guard), "Returning NULL skips the delete silently: failure disguised as success.");
    assert.match(guard, /return\s+old\s*;/i);
  });

  void test("the refusal names no other user", () => {
    const message = /raise\s+exception\s+'([^']*)'/i.exec(guard)?.[1] ?? "";
    assert.ok(message.length > 0);
    assert.ok(!/%|user_id|owner_id|actor/.test(message), "The message must not disclose whose data blocked the delete.");
  });

  void test("the guard only refuses: it deletes, detaches and modifies nothing", () => {
    assert.ok(!/\b(?:insert\s+into|update\s+public\.|delete\s+from)\b/i.test(guard));
  });

  void test("the guard is not directly executable by clients", () => {
    const revoke = ALL_STATEMENTS.filter((statement) =>
      new RegExp(`^revoke\\s+all\\s+on\\s+function\\s+public\\.${GUARD}\\(\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`, "i").test(statement),
    );
    assert.ok(revoke.length > 0);
  });

  void test("it runs BEFORE DELETE on every workspace row, so organization cascades are covered too", () => {
    const lastIndexOf = (pattern: RegExp): number => {
      let found = -1;
      ALL_STATEMENTS.forEach((statement, index) => {
        if (pattern.test(statement)) found = index;
      });
      return found;
    };

    const createAt = lastIndexOf(new RegExp(`^create\\s+trigger\\s+${TRIGGER}\\b`, "i"));
    const dropAt = lastIndexOf(new RegExp(`^drop\\s+trigger\\s+(?:if\\s+exists\\s+)?${TRIGGER}\\b`, "i"));

    assert.ok(createAt !== -1 && createAt > dropAt, "The trigger is not in force.");

    const trigger = ALL_STATEMENTS[createAt] ?? "";
    assert.match(trigger, /before\s+delete\s+on\s+public\.workspaces/i);
    assert.match(trigger, /for\s+each\s+row/i, "A statement-level trigger does not see which workspace is removed.");
    assert.match(trigger, new RegExp(`execute\\s+function\\s+public\\.${GUARD}\\(\\)`, "i"));

    /*
     * Row-level triggers fire for rows removed by a foreign-key cascade,
     * so deleting an organization reaches this guard through its
     * workspaces.
     */
    const workspaces = MIGRATIONS.map(([, sql]) => sql).join("\n");
    assert.match(
      workspaces,
      /create table if not exists public\.workspaces \([\s\S]*?organization_id uuid not null\s+references public\.organizations\(id\)\s+on delete cascade/,
    );
  });

  void test("every table that references workspaces is guarded or excluded with a reason", () => {
    const referencing = new Set<string>();

    for (const [, sql] of MIGRATIONS) {
      for (const match of sql.matchAll(/create table if not exists public\.([a-z_0-9]+)\s*\(([\s\S]*?)\n\);/gi)) {
        if (match[1] && /references\s+public\.workspaces\b/i.test(match[2] ?? "")) referencing.add(match[1]);
      }
      for (const match of sql.matchAll(/alter table (?:if exists )?public\.([a-z_0-9]+)[^;]*?references\s+public\.workspaces\b/gi)) {
        if (match[1]) referencing.add(match[1]);
      }
    }

    const unaccounted = [...referencing].filter((table) => !(table in GUARDED) && !(table in EXCLUDED)).sort();
    assert.deepEqual(unaccounted, [], "A table references workspaces but the delete guard does not account for it.");

    for (const table of Object.keys(GUARDED)) {
      assert.ok(referencing.has(table), `${table} no longer references workspaces; update the guard and this list.`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                              E. REGRESSION                                 */
/* -------------------------------------------------------------------------- */

void describe("E. legitimate paths keep working", () => {
  void test("registration writes no membership at all (Batch 2-D2)", () => {
    /*
     * Batch 1 pinned the opposite: registration created the owner
     * membership itself, with the service role. Batch 2-D2 removed that
     * whole path. Registration now only asks GoTrue for an unconfirmed
     * user; the owner membership is created by provision_personal_account(),
     * atomically, bound to auth.uid(), after the address is proven.
     *
     * The question this test asks is unchanged — does the owner membership
     * come from one trusted authority? — but the answer moved into SQL.
     */
    const register = read("app", "api", "auth", "register", "route.ts");

    assert.ok(
      !/\.from\(\s*"organization_members",?\s*\)/.test(register),
      "Registration must not write memberships.",
    );

    assert.ok(
      !/supabaseAdmin|getSupabaseAdminClient/.test(register),
      "Registration must not hold the RLS-bypassing client.",
    );

    assert.match(register, /supabase\.auth\.signUp\(/);
  });

  void test("the owner self-membership policy is still in force", () => {
    const names = effectivePolicies("organization_members").map((policy) => policy.name);
    assert.ok(names.includes("owners can create their own membership"));
  });

  void test("the route writes no membership itself; the owner membership comes from the provisioning authority", () => {
    /*
     * Batch 2-D1 removed the route's own owner-membership insert (and its
     * compensating delete). The membership is created atomically by
     * provision_personal_account(), SECURITY DEFINER, bound to auth.uid().
     * The client column grants still apply to any direct PostgREST insert.
     */
    const route = read("app", "api", "workspaces", "route.ts");
    const granted = sorted(effectivePrivileges("organization_members").columns.get("insert"));

    assert.ok(!/\.from\("organization_members"\)/.test(route), "The route must not insert memberships itself.");
    assert.deepEqual(granted, ["joined_at", "organization_id", "role", "status", "user_id"]);
  });
});

/* -------------------------------------------------------------------------- */
/*                         TEST-ONLY PROBE IS GUARDED                          */
/* -------------------------------------------------------------------------- */

void describe("The Batch 1 probe can never reach production", () => {
  const PROBE = join(ROOT, "scripts", "security", "probe-batch1.mjs");

  void test("the probe exists", () => {
    assert.ok(existsSync(PROBE));
  });

  const probe = existsSync(PROBE) ? readFileSync(PROBE, "utf8") : "";

  void test("it pins the same production project ref as the E2E guard", () => {
    const e2eRef = /PRODUCTION_PROJECT_REF\s*=\s*"([a-z0-9]+)"/.exec(read("tests", "e2e", "buildTarget.ts"))?.[1];
    const probeRef = /PRODUCTION_PROJECT_REF\s*=\s*"([a-z0-9]+)"/.exec(probe)?.[1];

    assert.ok(e2eRef && probeRef);
    assert.equal(probeRef, e2eRef);
  });

  void test("it refuses production, an unknown target and a missing flag before any request", () => {
    const firstRequest = probe.indexOf("fetch(");
    const refusesProduction = probe.search(/ref\s*===\s*PRODUCTION_PROJECT_REF/);
    const refusesUnknown = probe.search(/if\s*\(\s*!ref\s*\)/);
    const requiresFlag = probe.search(/--i-understand-this-writes-to-the-test-project/);

    assert.ok(firstRequest !== -1);
    for (const at of [refusesProduction, refusesUnknown, requiresFlag]) {
      assert.ok(at !== -1 && at < firstRequest, "The probe must refuse before its first request.");
    }
  });

  void test("it reads only the TEST environment file, never .env.local", () => {
    assert.ok(!/["'`]\.env\.local["'`]/.test(probe), "The probe must never read production secrets.");
    assert.match(probe, /\.env\.e2e\.local/);
    assert.ok(!/SERVICE_ROLE|service_role|SECRET_KEY/.test(probe), "The probe must act only as ordinary signed-in users.");
  });
});
