/**
 * SYRAVEN — atomic personal-account provisioning migration
 * tests/schema/personal-account-provisioning-migration.test.ts
 *
 * Phase 3, Batch 2-B (docs/engineering/SECURITY_EVIDENCE.md).
 *
 * 20260917130000_syraven_personal_account_provisioning.sql creates
 * public.provision_personal_account(): the single authority that gives a
 * confirmed, signed-in user their organization, owner membership and
 * default workspace, atomically and idempotently, bound to auth.uid().
 *
 * Static checks on the migration files; no database is involved.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase", "migrations");

const FILE = "20260917130000_syraven_personal_account_provisioning.sql";
const PROFILE_PROVISIONING = "20260917120000_syraven_profile_provisioning.sql";
const FUNCTION = "provision_personal_account";

const files = readdirSync(DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

/** SQL with whole-line `--` comments removed, as migration-integrity does. */
function code(file: string): string {
  return readFileSync(join(DIR, file), "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

function flat(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Top-level statements; a `;` inside a dollar-quoted body is not a boundary. */
function statements(sql: string): string[] {
  const out: string[] = [];
  const dollar = /\$[A-Za-z_]*\$/y;
  let current = "";
  let open: string | null = null;
  let index = 0;

  while (index < sql.length) {
    dollar.lastIndex = index;
    const tag = dollar.exec(sql)?.[0];

    if (tag) {
      if (open === null) open = tag;
      else if (tag === open) open = null;
      current += tag;
      index += tag.length;
      continue;
    }

    const char = sql[index] ?? "";

    if (char === ";" && open === null) {
      if (current.trim().length > 0) out.push(current.trim());
      current = "";
    } else {
      current += char;
    }

    index += 1;
  }

  if (current.trim().length > 0) out.push(current.trim());

  return out;
}

const PRESENT = existsSync(join(DIR, FILE));
const SQL = PRESENT ? code(FILE) : "";
const STATEMENTS = statements(SQL);

const DEFINITION = new RegExp(
  String.raw`create\s+or\s+replace\s+function\s+public\.${FUNCTION}\s*\(([^)]*)\)([\s\S]*?)\$\$([\s\S]*?)\$\$`,
  "i",
).exec(SQL);
const ARGUMENTS = DEFINITION?.[1] ?? "<missing>";
const HEADER = DEFINITION?.[2] ?? "";
const BODY = DEFINITION?.[3] ?? "";
const FLAT = flat(BODY);

/** Position of a normalized fragment in the flattened body, -1 if absent. */
function at(fragment: string): number {
  return FLAT.indexOf(flat(fragment));
}

/** The flattened text of the insert into `table`, up to its closing `;`. */
function insertInto(table: string): string {
  const start = FLAT.indexOf(`insert into public.${table} (`);

  return start === -1 ? "" : FLAT.slice(start, FLAT.indexOf(";", start));
}

/** Column -> value pairs of a single-row insert, respecting nested parentheses. */
function pairs(insert: string): Map<string, string> {
  const match = /^insert into public\.[a-z_]+ \(([^)]*)\) values \(([\s\S]*)\)(?: returning [\s\S]*)?$/.exec(insert);
  const result = new Map<string, string>();

  if (!match) return result;

  const columns = (match[1] ?? "").split(",").map((column) => column.trim());
  const values: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of match[2] ?? "") {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (char === "," && depth === 0) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());

  columns.forEach((column, index) => result.set(column, values[index] ?? ""));

  return result;
}

/* -------------------------------------------------------------------------- */
/*                                ORDER AND SHAPE                             */
/* -------------------------------------------------------------------------- */

void describe("The migration exists and has exactly the intended statements", () => {
  void test("the migration exists", () => {
    assert.ok(PRESENT, `${FILE} is missing.`);
  });

  void test("it sorts after the profile provisioning migration", () => {
    assert.ok(files.indexOf(FILE) > files.indexOf(PROFILE_PROVISIONING));
  });

  void test("it is three statements: the function, a revoke and a grant", () => {
    assert.deepEqual(
      STATEMENTS.map((statement) => flat(statement).split(" ").slice(0, 2).join(" ")),
      ["create or", "revoke all", "grant execute"],
    );
  });

  void test("it creates exactly one function, and changes no table, policy or trigger", () => {
    assert.equal([...SQL.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\b/gi)].length, 1);
    assert.ok(!/\b(?:alter|drop|truncate|comment)\b/i.test(SQL));
    assert.ok(!/\bcreate\s+(?:or\s+replace\s+)?(?:table|index|policy|trigger|view)\b/i.test(SQL));
  });
});

/* -------------------------------------------------------------------------- */
/*                         P1 — NO PARAMETERS, ONE IDENTITY                    */
/* -------------------------------------------------------------------------- */

void describe("P1: the function takes no parameters and its only identity is auth.uid()", () => {
  void test("the function is defined with an empty parameter list", () => {
    assert.ok(DEFINITION, `public.${FUNCTION}() is not defined.`);
    assert.equal(ARGUMENTS.trim(), "", "A parameter is a client-supplied identity or target.");
  });

  void test("it is a volatile SECURITY DEFINER plpgsql function returning jsonb with an empty search_path", () => {
    assert.match(HEADER, /\breturns\s+jsonb\b/i);
    assert.match(HEADER, /\blanguage\s+plpgsql\b/i);
    assert.match(HEADER, /\bvolatile\b/i);
    assert.match(HEADER, /\bsecurity\s+definer\b/i);
    assert.match(HEADER, /\bset\s+search_path\s*=\s*''/i);
  });

  void test("identity is read exactly once, from auth.uid()", () => {
    assert.equal([...FLAT.matchAll(/auth\.uid\(\)/g)].length, 1);
    assert.ok(at("caller uuid := auth.uid();") !== -1);
  });

  void test("no other identity source is consulted", () => {
    assert.ok(
      !/\b(?:current_setting|request\.jwt|auth\.jwt|auth\.email|raw_user_meta_data|raw_app_meta_data|user_metadata|app_metadata|session_user|current_user)\b/.test(FLAT),
      "Only auth.uid() may identify the caller.",
    );
  });

  void test("no dynamic SQL", () => {
    assert.ok(!/\bexecute\b/.test(FLAT), "Dynamic SQL defeats every static guard on this function.");
  });
});

/* -------------------------------------------------------------------------- */
/*                 P2/P3/P4 — REFUSALS FIRST, THEN THE LOCK                    */
/* -------------------------------------------------------------------------- */

void describe("P2-P4: refusals come before the lock, and the lock before any read or write", () => {
  const nullCheck = at("if caller is null then raise exception");
  const confirmedRead = at("select u.email_confirmed_at into confirmed_at from auth.users u where u.id = caller;");
  const confirmedCheck = at("if confirmed_at is null then raise exception");
  const lock = at(
    "perform pg_catalog.pg_advisory_xact_lock( pg_catalog.hashtextextended('syraven.provision_personal_account:' || caller::text, 0) );",
  );
  const firstOwnershipRead = FLAT.indexOf("from public.organization_members");
  const firstWrite = FLAT.search(/\binsert\s+into\b/);

  void test("P2: a NULL auth.uid() is refused with 42501", () => {
    assert.ok(nullCheck !== -1, "No NULL auth.uid() refusal.");
    assert.match(FLAT.slice(nullCheck, FLAT.indexOf("end if;", nullCheck)), /using errcode = '42501'/);
  });

  void test("P3: the caller's own auth.users row must have a confirmed email, refused with 42501", () => {
    assert.ok(confirmedRead !== -1, "The confirmation read is not bound to the caller's row.");
    assert.ok(confirmedCheck !== -1, "No unconfirmed-email refusal.");
    assert.match(FLAT.slice(confirmedCheck, FLAT.indexOf("end if;", confirmedCheck)), /using errcode = '42501'/);
  });

  void test("P4: a per-user TRANSACTION advisory lock, never a session lock", () => {
    assert.ok(lock !== -1, "No per-user pg_advisory_xact_lock keyed by the caller.");
    assert.ok(!/pg_advisory_lock\s*\(|pg_try_advisory/.test(FLAT), "A session lock outlives the transaction; a try-lock can skip serialization.");
  });

  void test("the order is: NULL refusal, confirmation refusal, lock, ownership read, writes", () => {
    assert.ok(nullCheck !== -1 && confirmedRead !== -1 && confirmedCheck !== -1 && lock !== -1);
    assert.ok(nullCheck < confirmedRead, "The NULL refusal must come first.");
    assert.ok(confirmedRead < confirmedCheck && confirmedCheck < lock, "The confirmation refusal must come before the lock.");
    assert.ok(lock < firstOwnershipRead, "The existence check must run under the lock, or two calls can both create.");
    assert.ok(firstOwnershipRead < firstWrite, "Nothing may be written before the existence check.");
  });
});

/* -------------------------------------------------------------------------- */
/*                       P5 — THE BATCH 1 OWNERSHIP RULE                       */
/* -------------------------------------------------------------------------- */

void describe("P5: an existing organization is recognised only by the Batch 1 ownership rule", () => {
  const lookupStart = FLAT.indexOf("select m.organization_id into org_id");
  const lookup = lookupStart === -1 ? "" : FLAT.slice(lookupStart, FLAT.indexOf("limit 1;", lookupStart)).trim();

  void test("the lookup joins memberships to organizations", () => {
    assert.match(lookup, /from public\.organization_members m join public\.organizations o on o\.id = m\.organization_id/);
  });

  for (const condition of ["m.user_id = caller", "m.role = 'owner'", "m.status = 'active'", "o.owner_id = caller"]) {
    void test(`the lookup requires ${condition}`, () => {
      assert.ok(lookup.includes(condition), `Without ${condition} another account's organization can be returned.`);
    });
  }

  void test("the oldest owner membership wins, deterministically", () => {
    assert.match(lookup, /order by m\.created_at asc, m\.organization_id asc$/);
  });

  void test("the application has no second copy of the rule: /api/workspaces delegates to this function", () => {
    /*
     * Until Batch 2-D1 the route re-implemented this lookup and the test
     * cross-checked the two copies. The route now resolves the organisation
     * through lib/tenancy/personalAccount, which calls this function, so
     * the Batch 1 rule exists only in the SQL pinned above.
     */
    const route = readFileSync(join(process.cwd(), "app", "api", "workspaces", "route.ts"), "utf8");
    const helper = readFileSync(join(process.cwd(), "lib", "tenancy", "personalAccount.ts"), "utf8");

    assert.match(route, /ensurePersonalAccount\(\s*session\.supabase as unknown as PersonalAccountClient,?\s*\)/);
    assert.ok(!/\.from\("organization_members"\)|\.from\("organizations"\)/.test(route), "The route must not look up or create organisations itself.");
    assert.match(helper, /\.rpc\("provision_personal_account"\)/);
  });
});

/* -------------------------------------------------------------------------- */
/*                   P6 — EVERY WRITTEN IDENTITY IS THE CALLER                 */
/* -------------------------------------------------------------------------- */

void describe("P6: owner_id, membership user_id and created_by are server-bound to the caller", () => {
  void test("the organization is owned by the caller", () => {
    const organization = pairs(insertInto("organizations"));

    assert.equal(organization.get("owner_id"), "caller");
    assert.deepEqual([...organization.keys()].sort(), ["name", "owner_id", "slug"]);
  });

  void test("the organization slug is random, not derived from the user id", () => {
    const slug = pairs(insertInto("organizations")).get("slug") ?? "";

    assert.match(slug, /pg_catalog\.gen_random_uuid\(\)/);
    assert.ok(!slug.includes("caller"), "A slug derived from the user id can be pre-claimed by another account.");
  });

  void test("the membership is the caller, as active owner, in the new organization", () => {
    const membership = pairs(insertInto("organization_members"));

    assert.equal(membership.get("user_id"), "caller");
    assert.equal(membership.get("organization_id"), "org_id");
    assert.equal(membership.get("role"), "'owner'");
    assert.equal(membership.get("status"), "'active'");
  });

  void test("the default workspace is created by the caller in the caller's organization", () => {
    const workspace = pairs(insertInto("workspaces"));

    assert.equal(workspace.get("created_by"), "caller");
    assert.equal(workspace.get("organization_id"), "org_id");
  });

  void test("the audit row is attributed to the caller and the provisioned resources", () => {
    const audit = pairs(insertInto("audit_logs"));

    assert.equal(audit.get("user_id"), "caller");
    assert.equal(audit.get("organization_id"), "org_id");
    assert.equal(audit.get("workspace_id"), "ws_id");
    assert.equal(audit.get("action"), "'account.provisioned'");
  });

  void test("exactly four inserts and no update or delete", () => {
    assert.deepEqual(
      [...FLAT.matchAll(/insert into public\.([a-z_]+)/g)].map((match) => match[1]),
      ["organizations", "organization_members", "workspaces", "audit_logs"],
    );
    assert.ok(!/\b(?:update|delete|truncate|merge)\b/.test(FLAT), "Provisioning must never modify existing rows.");
  });

  void test("the membership is created only together with a new organization", () => {
    const newOrganization = at("if org_id is null then insert into public.organizations");
    const membership = FLAT.indexOf("insert into public.organization_members");
    const endIf = FLAT.indexOf("end if;", newOrganization);

    assert.ok(newOrganization !== -1 && newOrganization < membership && membership < endIf,
      "A membership inserted outside the new-organization branch would add the caller to an existing organization.");
  });
});

/* -------------------------------------------------------------------------- */
/*                          P7/P8 — IDEMPOTENT, ATOMIC                         */
/* -------------------------------------------------------------------------- */

void describe("P7/P8: repeated calls write nothing; everything is one transaction", () => {
  void test("the workspace is created only when the organization has none", () => {
    const newWorkspace = at("if ws_id is null then insert into public.workspaces");
    const lookup = at("select w.id into ws_id from public.workspaces w where w.organization_id = org_id order by w.created_at asc, w.id asc limit 1;");

    assert.ok(lookup !== -1 && newWorkspace !== -1 && lookup < newWorkspace);
  });

  void test("the audit row is written only when something was created", () => {
    const guard = at("if created_org or created_ws then insert into public.audit_logs");

    assert.ok(guard !== -1, "An unconditional audit insert breaks idempotency.");
  });

  void test("the function never commits, rolls back or swallows an error mid-way", () => {
    assert.ok(!/\b(?:commit|rollback|savepoint)\b/.test(FLAT));
    assert.ok(!/\bexception\s+when\b/.test(FLAT), "An exception handler would let a partial provisioning commit.");
  });

  void test("it returns organization_id, workspace_id and created", () => {
    assert.ok(
      at("return pg_catalog.jsonb_build_object( 'organization_id', org_id, 'workspace_id', ws_id, 'created', created_org or created_ws );") !== -1,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      SCHEMA QUALIFICATION (search_path = '')                */
/* -------------------------------------------------------------------------- */

void describe("Every relation and built-in is schema-qualified", () => {
  void test("no unqualified relation", () => {
    const unqualified = [...FLAT.matchAll(/\b(?:from|join|into|update)\s+([a-z_]+)(?![a-z_.])/g)]
      .map((match) => match[1])
      .filter((name) => !["org_id", "ws_id", "confirmed_at"].includes(name ?? ""));

    assert.deepEqual(unqualified, []);
  });

  void test("no unqualified built-in call", () => {
    const builtins = /(?<!pg_catalog\.)\b(?:now|md5|gen_random_uuid|substr|jsonb_build_object|hashtextextended|pg_advisory_xact_lock)\s*\(/g;

    assert.deepEqual([...FLAT.matchAll(builtins)].map((match) => match[0]), []);
  });
});

/* -------------------------------------------------------------------------- */
/*                             P9 — WHO MAY EXECUTE                            */
/* -------------------------------------------------------------------------- */

void describe("P9: only authenticated may execute", () => {
  const revoke = STATEMENTS.find((statement) => /^revoke\s+all\s+on\s+function\s+public\.provision_personal_account\s*\(\s*\)/i.test(statement)) ?? "";
  const grants = STATEMENTS.filter((statement) => /^grant\b/i.test(statement));

  void test("execute is revoked from public, anon and service_role", () => {
    const roles = new Set((/\bfrom\s+([\s\S]+)$/i.exec(revoke)?.[1] ?? "").split(",").map((role) => role.trim().toLowerCase()));

    for (const role of ["public", "anon", "service_role"]) {
      assert.ok(roles.has(role), `${role} can still execute public.${FUNCTION}().`);
    }
  });

  void test("the single grant is execute to authenticated", () => {
    assert.deepEqual(grants.map(flat), [`grant execute on function public.${FUNCTION}() to authenticated`]);
  });

  void test("the revoke precedes the grant", () => {
    assert.ok(STATEMENTS.indexOf(revoke) !== -1 && STATEMENTS.indexOf(revoke) < STATEMENTS.indexOf(grants[0] ?? ""));
  });
});

/* -------------------------------------------------------------------------- */
/*                         ONE PROVISIONING AUTHORITY                          */
/* -------------------------------------------------------------------------- */

void describe("The database has one provisioning authority", () => {
  void test("no other migration inserts organizations, memberships or workspaces", () => {
    const others = files
      .filter((file) => file !== FILE)
      .filter((file) => /\binsert\s+into\s+(?:public\.)?(?:organizations|organization_members|workspaces)\b/i.test(code(file)));

    assert.deepEqual(others, []);
  });

  void test("no other function named provision_* is defined", () => {
    const definitions = files.flatMap((file) =>
      [...code(file).matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(provision_[a-z_0-9]*)\s*\(/gi)].map(
        (match) => `${file}:${(match[1] ?? "").toLowerCase()}`,
      ),
    );

    assert.deepEqual(definitions.sort(), [
      `${FILE}:provision_personal_account`,
      `${PROFILE_PROVISIONING}:provision_profile_for_new_user`,
    ].sort());
  });
});
