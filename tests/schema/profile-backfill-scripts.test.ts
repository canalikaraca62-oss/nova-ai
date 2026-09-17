/**
 * SYRAVEN — profile backfill and production count scripts
 * tests/schema/profile-backfill-scripts.test.ts
 *
 * Phase 3, Batch 2-C (docs/engineering/SECURITY_EVIDENCE.md).
 *
 * scripts/sql/b2c-profile-backfill.sql creates the missing profile of
 * every existing account as restricted free with NO trial (founder
 * decision D6), never touching an existing profile, and aborts itself
 * unless that holds. scripts/sql/b2c-production-profile-counts.sql is
 * the SELECT-only measurement the founder runs on production first.
 *
 * Static checks on the script files; no database is involved.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SCRIPTS = join(process.cwd(), "scripts", "sql");
const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

const BACKFILL = "b2c-profile-backfill.sql";
const COUNTS = "b2c-production-profile-counts.sql";

/** SQL with whole-line `--` comments and trailing `--` comments removed. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .map((line) => line.replace(/\s--\s.*$/, ""))
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

const BACKFILL_PRESENT = existsSync(join(SCRIPTS, BACKFILL));
const COUNTS_PRESENT = existsSync(join(SCRIPTS, COUNTS));

const BACKFILL_SQL = BACKFILL_PRESENT ? code(join(SCRIPTS, BACKFILL)) : "";
const BACKFILL_FLAT = flat(BACKFILL_SQL);
const COUNTS_SQL = COUNTS_PRESENT ? code(join(SCRIPTS, COUNTS)) : "";
const COUNTS_STATEMENTS = statements(COUNTS_SQL);

function at(fragment: string): number {
  return BACKFILL_FLAT.indexOf(flat(fragment));
}

const INSERT =
  "insert into public.profiles (id) select u.id from auth.users u " +
  "where not exists (select 1 from public.profiles p where p.id = u.id) on conflict (id) do nothing;";

/* -------------------------------------------------------------------------- */
/*                                  BACKFILL                                  */
/* -------------------------------------------------------------------------- */

void describe("B2-C backfill: one self-verifying transaction", () => {
  void test("the script exists", () => {
    assert.ok(BACKFILL_PRESENT, `scripts/sql/${BACKFILL} is missing.`);
  });

  void test("it is exactly one DO block, so the backfill and its checks are one transaction", () => {
    const parsed = statements(BACKFILL_SQL);

    assert.equal(parsed.length, 1, `Expected one statement, found ${parsed.length}.`);
    assert.match(parsed[0] ?? "", /^do\s+\$backfill\$/i);
  });

  void test("it is a founder-applied script, not a migration a fresh database runs silently", () => {
    const leaked = readdirSync(MIGRATIONS).filter((file) => /backfill/i.test(file) || /\$backfill\$/.test(readFileSync(join(MIGRATIONS, file), "utf8")));

    assert.deepEqual(leaked, []);
  });

  void test("no exception handler: a failed check must roll the whole backfill back", () => {
    assert.ok(!/\bexception\s+when\b/.test(BACKFILL_FLAT));
  });
});

void describe("B2-C backfill: writes only the missing profile id (D6: restricted free, no trial)", () => {
  void test("the only write is the id-only insert of missing profiles, duplicate-proof", () => {
    assert.ok(at(INSERT) !== -1, "The insert must write only (id), from auth.users, skipping existing profiles, on conflict do nothing.");
    assert.deepEqual([...BACKFILL_FLAT.matchAll(/\binsert\s+into\s+([a-z_.]+)/g)].map((match) => match[1]), ["public.profiles"]);
  });

  void test("nothing else is written or changed", () => {
    assert.ok(!/\b(?:update|delete|truncate|merge|alter|drop|grant|revoke|copy|create)\b/.test(BACKFILL_FLAT));
  });

  void test("no trial, plan or billing value can be produced", () => {
    assert.ok(!/\b(?:now|clock_timestamp|current_timestamp|interval)\b/.test(BACKFILL_FLAT), "A clock or interval is how a trial date gets fabricated.");
    assert.ok(!/'(?:starter|pro|business|enterprise|active|trialing)'/.test(BACKFILL_FLAT), "The backfill must not write a paid plan or status.");
  });

  void test("nothing is read from user metadata", () => {
    assert.ok(!/\b(?:raw_user_meta_data|raw_app_meta_data|user_metadata|app_metadata)\b/.test(BACKFILL_FLAT));
  });

  void test("every relation is schema-qualified", () => {
    const relations = [...BACKFILL_FLAT.matchAll(/\b(?:from|into|join)\s+([a-z_]+)(?![a-z_.])/g)]
      .map((match) => match[1])
      .filter((name) => !["existing_ids", "existing_hash", "preserved_hash", "still_missing", "invalid_new"].includes(name ?? ""));

    assert.deepEqual(relations, []);
  });
});

void describe("B2-C backfill: it aborts unless its three guarantees hold", () => {
  const snapshot = at("into existing_ids, existing_hash from public.profiles p;");
  const insert = at(INSERT);
  const missingCheck = at("if still_missing <> 0 then raise exception");
  const preservedCheck = at("if preserved_hash is distinct from existing_hash then raise exception");
  const newRowCheck = at("if invalid_new <> 0 then raise exception");

  void test("the existing profiles are snapshotted (ids and a row hash) BEFORE the insert", () => {
    assert.ok(snapshot !== -1 && insert !== -1 && snapshot < insert);
    assert.ok(at("coalesce(md5(string_agg(p::text, '|' order by p.id)), '') into existing_ids, existing_hash") !== -1 ||
      at("coalesce(array_agg(p.id order by p.id), '{}'::uuid[]), coalesce(md5(string_agg(p::text, '|' order by p.id)), '') into existing_ids, existing_hash") !== -1);
  });

  void test("B1: no account may be left without a profile", () => {
    assert.ok(at("select count(*) into still_missing from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id);") > insert);
    assert.ok(missingCheck > insert);
  });

  void test("B2: every existing profile must be byte-identical after", () => {
    assert.ok(at("select coalesce(md5(string_agg(p::text, '|' order by p.id)), '') into preserved_hash from public.profiles p where p.id = any (existing_ids);") > insert);
    assert.ok(preservedCheck > insert);
  });

  void test("B3: every new profile must be free, inactive, without Stripe ids or trial dates", () => {
    const check = BACKFILL_FLAT.slice(at("into invalid_new"), newRowCheck);

    for (const condition of [
      "p.plan <> 'free'",
      "p.subscription_status <> 'inactive'",
      "p.stripe_customer_id is not null",
      "p.stripe_subscription_id is not null",
      "p.trial_started_at is not null",
      "p.trial_ends_at is not null",
    ]) {
      assert.ok(check.includes(condition), `B3 no longer rejects ${condition}.`);
    }

    assert.ok(check.includes("not (p.id = any (existing_ids))"), "B3 must examine only the profiles this run created.");
    assert.ok(newRowCheck > insert);
  });
});

/* -------------------------------------------------------------------------- */
/*                            PRODUCTION COUNTS                               */
/* -------------------------------------------------------------------------- */

void describe("B2-C production counts: SELECT-only inside a read-only transaction", () => {
  void test("the script exists", () => {
    assert.ok(COUNTS_PRESENT, `scripts/sql/${COUNTS} is missing.`);
  });

  void test("it is exactly: begin transaction read only; one select; rollback", () => {
    assert.equal(COUNTS_STATEMENTS.length, 3);
    assert.equal(flat(COUNTS_STATEMENTS[0] ?? ""), "begin transaction read only");
    assert.match(flat(COUNTS_STATEMENTS[1] ?? ""), /^select\b/);
    assert.equal(flat(COUNTS_STATEMENTS[2] ?? ""), "rollback");
  });

  void test("no write, DDL, privilege or session statement anywhere", () => {
    const body = flat(COUNTS_STATEMENTS[1] ?? "");

    assert.ok(!/\b(?:insert|update|delete|merge|truncate|alter|create|drop|grant|revoke|copy|call|do|commit|set|lock|vacuum|refresh|notify)\b/.test(body));
  });

  void test("it returns counts and booleans only, never personal data", () => {
    const body = flat(COUNTS_STATEMENTS[1] ?? "");

    assert.ok(!/\b(?:email|phone|raw_user_meta_data|raw_app_meta_data|user_metadata|string_agg|array_agg|json_agg|jsonb_agg)\b/.test(body),
      "The result row is pasted into chat; it must hold no identifier.");
    assert.ok(!/select\s+(?:u|p)\.\*|select\s+\*/.test(body));
  });

  void test("it measures everything the backfill decision needs", () => {
    const aliases = new Set([...flat(COUNTS_STATEMENTS[1] ?? "").matchAll(/\bas\s+([a-z_0-9]+)/g)].map((match) => match[1]));

    for (const required of [
      "auth_users",
      "unconfirmed_users",
      "profiles",
      "users_without_profile",
      "orphan_profiles",
      "profiles_with_trial_dates",
      "profiles_with_active_trial",
      "profiles_non_free_plan",
      "profiles_unknown_plan",
      "profiles_with_subscription",
      "users_without_owner_membership",
      "b2a_profile_function_present",
      "b2b_function_present",
      "auth_users_triggers",
    ]) {
      assert.ok(aliases.has(required), `The production counts no longer report ${required}.`);
    }
  });

  void test("users_without_profile is measured against auth.users", () => {
    assert.match(
      flat(COUNTS_STATEMENTS[1] ?? ""),
      /\(select count\(\*\) from auth\.users u where not exists \(select 1 from public\.profiles p where p\.id = u\.id\)\) as users_without_profile/,
    );
  });
});
