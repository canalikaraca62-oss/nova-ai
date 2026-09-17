/**
 * SYRAVEN — one profile provisioning authority
 * tests/schema/single-profile-authority-migration.test.ts
 *
 * Phase 3, Batch 2-A2 (docs/engineering/SECURITY_EVIDENCE.md).
 *
 * Production provisions profiles through on_auth_user_created ->
 * public.handle_new_user(), created outside the repository.
 * 20260917120000 added a second insert authority. 20260918120000 brings
 * production's function into the repository byte-for-byte, revokes its
 * client EXECUTE, and retires the duplicate, so that after every migration
 * exactly ONE trigger provisions profiles, and the confirmation -> trial
 * trigger remains.
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

const FILE = "20260918120000_syraven_single_profile_authority.sql";
const PERSONAL_ACCOUNT = "20260917130000_syraven_personal_account_provisioning.sql";

/** Production's function body, normalized (founder read-only, 2026-09-17). */
const PRODUCTION_BODY =
  "begin insert into public.profiles ( id, plan, subscription_status ) values ( new.id, 'free', 'inactive' ) " +
  "on conflict (id) do nothing; return new; end;";

const files = readdirSync(DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

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
const STATEMENTS = statements(SQL).map(flat);

const HANDLE_NEW_USER = /create or replace function public\.handle_new_user\(\) (.*?) as \$\$ (.*?) \$\$$/.exec(
  STATEMENTS.find((statement) => statement.startsWith("create or replace function public.handle_new_user()")) ?? "",
);
const HEADER = HANDLE_NEW_USER?.[1] ?? "";
const BODY = HANDLE_NEW_USER?.[2] ?? "";

/* -------------------------------------------------------------------------- */
/*                                ORDER AND SHAPE                             */
/* -------------------------------------------------------------------------- */

void describe("The consolidation migration exists and has exactly the intended statements", () => {
  void test("the migration exists", () => {
    assert.ok(PRESENT, `${FILE} is missing.`);
  });

  void test("it sorts after the personal-account provisioning migration", () => {
    assert.ok(files.indexOf(FILE) > files.indexOf(PERSONAL_ACCOUNT));
  });

  void test("it is seven statements in the audited order", () => {
    assert.deepEqual(
      STATEMENTS.map((statement) => statement.split(" ").slice(0, 4).join(" ")),
      [
        "do $guard$ declare existing",
        "create or replace function",
        "revoke all on function",
        "drop trigger if exists",
        "create trigger on_auth_user_created after",
        "drop trigger if exists",
        "drop function if exists",
      ],
    );
  });

  void test("20260917120000 is not edited (fix forward, D9)", () => {
    const profileProvisioning = code("20260917120000_syraven_profile_provisioning.sql");

    assert.ok(profileProvisioning.includes("create trigger syraven_provision_profile"), "The applied B2-A migration was edited.");
    assert.ok(profileProvisioning.includes("create trigger syraven_start_trial_on_email_confirmation"));
  });
});

/* -------------------------------------------------------------------------- */
/*                          THE GUARD AND THE DEFINITION                      */
/* -------------------------------------------------------------------------- */

void describe("handle_new_user() is production's definition, guarded against drift", () => {
  const guard = STATEMENTS[0] ?? "";

  void test("the guard aborts when an existing definition differs", () => {
    assert.match(guard, /where p\.oid = pg_catalog\.to_regprocedure\('public\.handle_new_user\(\)'\)/);
    assert.match(guard, /if existing is not null and existing <> expected then raise exception/);
    assert.ok(!/\bexception when\b/.test(guard), "A handler would let a drifted function be replaced.");
  });

  void test("the guard normalizes whitespace and case before comparing", () => {
    assert.match(guard, /pg_catalog\.btrim\(pg_catalog\.regexp_replace\(pg_catalog\.lower\(p\.prosrc\), '\\s\+', ' ', 'g'\)\)/);
  });

  void test("the guard's expected body is the body this migration defines", () => {
    /* Anchored on the statement that follows: the literal itself contains `;`. */
    const expected = /expected constant text := (.*?); begin select/.exec(guard)?.[1] ?? "";
    const literal = [...expected.matchAll(/'((?:[^']|'')*)'/g)].map((match) => (match[1] ?? "").replace(/''/g, "'")).join("");

    assert.equal(literal, PRODUCTION_BODY, "The guard compares against something other than production's body.");
    assert.equal(BODY.replace(/^begin /, "begin "), PRODUCTION_BODY, "The defined body is not production's body.");
  });

  void test("it is a SECURITY DEFINER plpgsql trigger function with an empty search_path", () => {
    assert.match(HEADER, /\breturns trigger\b/);
    assert.match(HEADER, /\blanguage plpgsql\b/);
    assert.match(HEADER, /\bsecurity definer\b/);
    assert.match(HEADER, /\bset search_path = ''/);
  });

  void test("it writes only id, plan 'free' and status 'inactive': no trial, no metadata", () => {
    assert.ok(!/\btrial_|raw_user_meta_data|raw_app_meta_data|user_metadata|now\(\)|interval\b/.test(BODY));
  });
});

/* -------------------------------------------------------------------------- */
/*                     D10 — CLIENT EXECUTE REVOKED, NOTHING GRANTED           */
/* -------------------------------------------------------------------------- */

void describe("D10: client EXECUTE on handle_new_user() is revoked; service_role is kept", () => {
  void test("execute is revoked from public, anon and authenticated", () => {
    assert.equal(STATEMENTS[2], "revoke all on function public.handle_new_user() from public, anon, authenticated");
  });

  void test("no grant, and service_role is not revoked", () => {
    assert.ok(!STATEMENTS.some((statement) => statement.startsWith("grant")));
    assert.ok(!/service_role/.test(STATEMENTS[2] ?? ""));
  });
});

/* -------------------------------------------------------------------------- */
/*                         TRIGGER AND RETIREMENT                             */
/* -------------------------------------------------------------------------- */

void describe("on_auth_user_created is ensured and the duplicate authority is retired", () => {
  void test("on_auth_user_created fires AFTER INSERT per row and executes handle_new_user()", () => {
    assert.equal(STATEMENTS[3], "drop trigger if exists on_auth_user_created on auth.users");
    assert.equal(
      STATEMENTS[4],
      "create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()",
    );
  });

  void test("syraven_provision_profile and provision_profile_for_new_user() are dropped", () => {
    assert.equal(STATEMENTS[5], "drop trigger if exists syraven_provision_profile on auth.users");
    assert.equal(STATEMENTS[6], "drop function if exists public.provision_profile_for_new_user()");
  });

  void test("the confirmation -> trial trigger and its function are not touched", () => {
    assert.ok(!/start_trial_on_email_confirmation/.test(SQL));
  });

  void test("no table, column, policy, row or grant is changed", () => {
    assert.ok(!/\b(?:alter|truncate|update|delete|insert into public\.(?!profiles))\b/.test(SQL.replace(/\$\$[\s\S]*?\$\$/g, "")));
    assert.ok(!/\bcreate\s+(?:or\s+replace\s+)?(?:table|index|policy|view)\b/i.test(SQL));
    assert.ok(!/\bdrop\s+(?:table|column|policy|schema)\b/i.test(SQL));
  });
});

/* -------------------------------------------------------------------------- */
/*           EFFECTIVE STATE AFTER EVERY MIGRATION, IN FILENAME ORDER          */
/* -------------------------------------------------------------------------- */

void describe("After all migrations, exactly one trigger provisions profiles", () => {
  const triggers = new Map<string, string>();
  const functions = new Map<string, string>();

  for (const file of files) {
    for (const statement of statements(code(file)).map(flat)) {
      const created = /^create (?:or replace )?trigger ([a-z_0-9]+) .*? on auth\.users .*? execute (?:function|procedure) public\.([a-z_0-9]+)\(/.exec(statement);
      const dropped = /^drop trigger (?:if exists )?([a-z_0-9]+) on auth\.users$/.exec(statement);
      const defined = /^create (?:or replace )?function public\.([a-z_0-9]+)\(\)[\s\S]*? as \$\$ ([\s\S]*) \$\$$/.exec(statement);
      const removed = /^drop function (?:if exists )?public\.([a-z_0-9]+)\(\)$/.exec(statement);

      if (created?.[1] && created[2]) triggers.set(created[1], created[2]);
      if (dropped?.[1]) triggers.delete(dropped[1]);
      if (defined?.[1] && defined[2] !== undefined) functions.set(defined[1], defined[2]);
      if (removed?.[1]) functions.delete(removed[1]);
    }
  }

  void test("the final triggers on auth.users are exactly the audited two", () => {
    assert.deepEqual([...triggers.keys()].sort(), ["on_auth_user_created", "syraven_start_trial_on_email_confirmation"]);
  });

  void test("every final trigger executes a function that still exists", () => {
    for (const [trigger, fn] of triggers) {
      assert.ok(functions.has(fn), `${trigger} executes public.${fn}(), which a later migration dropped.`);
    }
  });

  void test("exactly one final trigger inserts into public.profiles, and it is on_auth_user_created", () => {
    const provisioning = [...triggers].filter(([, fn]) => /insert into public\.profiles/.test(functions.get(fn) ?? ""));

    assert.deepEqual(provisioning.map(([trigger]) => trigger), ["on_auth_user_created"]);
  });

  void test("the trial trigger's function only updates profiles and never inserts", () => {
    const body = functions.get(triggers.get("syraven_start_trial_on_email_confirmation") ?? "") ?? "";

    assert.match(body, /update public\.profiles set trial_started_at/);
    assert.ok(!/insert into/.test(body));
  });

  void test("provision_profile_for_new_user() no longer exists", () => {
    assert.ok(!functions.has("provision_profile_for_new_user"));
  });
});
