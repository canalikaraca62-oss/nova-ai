/**
 * SYRAVEN — profile provisioning and trial start migration
 * tests/schema/profile-provisioning-migration.test.ts
 *
 * Phase 3, Batch 2-A (docs/engineering/SECURITY_EVIDENCE.md).
 *
 * 20260917120000_syraven_profile_provisioning.sql creates a profile for
 * every new auth.users row and starts the 14-day trial only when email
 * confirmation succeeds, once. Founder decisions: D3a (trial clock starts
 * at confirmation), D6 (no trial from backfill), and user-editable
 * metadata never decides plan or trial.
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

const FILE = "20260917120000_syraven_profile_provisioning.sql";
const MEMBERSHIP_FORTRESS = "20260915120000_syraven_membership_fortress.sql";

const PROFILE_FUNCTION = "provision_profile_for_new_user";
const TRIAL_FUNCTION = "start_trial_on_email_confirmation";
const PROFILE_TRIGGER = "syraven_provision_profile";
const TRIAL_TRIGGER = "syraven_start_trial_on_email_confirmation";

const files = readdirSync(DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

function raw(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

/** SQL with whole-line `--` comments removed, as migration-integrity does. */
function code(file: string): string {
  return raw(join(DIR, file))
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

/** Lower-cased, whitespace-collapsed, so a statement compares as one string. */
function flat(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Top-level statements. A semicolon inside any dollar-quoted body — `$$`
 * or a tagged `$name$` — is not a statement boundary.
 */
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

interface FunctionDefinition {
  readonly header: string;
  readonly body: string;
}

function definition(name: string): FunctionDefinition | null {
  const match = new RegExp(
    String.raw`create\s+or\s+replace\s+function\s+public\.${name}\s*\(\s*\)([\s\S]*?)\$\$([\s\S]*?)\$\$`,
    "i",
  ).exec(SQL);

  return match ? { header: match[1] ?? "", body: match[2] ?? "" } : null;
}

const PROFILE = definition(PROFILE_FUNCTION);
const TRIAL = definition(TRIAL_FUNCTION);

function statementStarting(prefix: RegExp): string {
  return STATEMENTS.find((statement) => prefix.test(statement)) ?? "";
}

function trialDaysInPlans(): number | null {
  const plans = raw(join(process.cwd(), "lib", "plans.ts"));
  const match = /export\s+const\s+TRIAL_CONFIG\s*=\s*\{[\s\S]*?durationDays\s*:\s*(\d+)/.exec(plans);

  return match?.[1] ? Number(match[1]) : null;
}

/* -------------------------------------------------------------------------- */
/*                                ORDER AND SHAPE                             */
/* -------------------------------------------------------------------------- */

void describe("The migration exists and has exactly the intended statements", () => {
  void test("the migration exists", () => {
    assert.ok(PRESENT, `${FILE} is missing: new accounts would have no profile.`);
  });

  void test("it sorts after the membership fortress migration", () => {
    assert.ok(files.indexOf(FILE) > files.indexOf(MEMBERSHIP_FORTRESS));
  });

  void test("the parser keeps dollar-quoted bodies together", () => {
    assert.deepEqual(statements("create function f() as $$ begin x; y; end; $$; select 1;"), [
      "create function f() as $$ begin x; y; end; $$",
      "select 1",
    ]);
  });

  void test("it is eight statements: two functions, two revokes, two trigger pairs", () => {
    assert.deepEqual(
      STATEMENTS.map((statement) => flat(statement).split(" ").slice(0, 3).join(" ")),
      [
        "create or replace",
        "revoke all on",
        "drop trigger if",
        "create trigger syraven_provision_profile",
        "create or replace",
        "revoke all on",
        "drop trigger if",
        "create trigger syraven_start_trial_on_email_confirmation",
      ],
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                         T1 — PROFILE ON USER CREATION                      */
/* -------------------------------------------------------------------------- */

void describe("T1: every new auth.users row gets a profile, and nothing else", () => {
  void test("the function is defined", () => {
    assert.ok(PROFILE, `public.${PROFILE_FUNCTION}() is not defined.`);
  });

  void test("it is a SECURITY DEFINER plpgsql trigger function with an empty search_path", () => {
    const header = PROFILE?.header ?? "";

    assert.match(header, /\breturns\s+trigger\b/i);
    assert.match(header, /\blanguage\s+plpgsql\b/i);
    assert.match(header, /\bsecurity\s+definer\b/i, "supabase_auth_admin has no write on public.profiles.");
    assert.match(header, /\bset\s+search_path\s*=\s*''/i);
  });

  void test("the body is exactly: insert the id, skip an existing profile, return", () => {
    assert.equal(
      flat(PROFILE?.body ?? ""),
      "begin insert into public.profiles (id) values (new.id) on conflict (id) do nothing; return new; end;",
      "The insert path must write no trial, plan or billing column, and must never fail a signup on an existing profile.",
    );
  });

  void test("the trigger fires AFTER INSERT, per row, on auth.users", () => {
    assert.equal(
      flat(statementStarting(new RegExp(String.raw`^create\s+trigger\s+${PROFILE_TRIGGER}\b`, "i"))),
      `create trigger ${PROFILE_TRIGGER} after insert on auth.users for each row execute function public.${PROFILE_FUNCTION}()`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*               T2/T3/T4 — TRIAL STARTS ON CONFIRMATION, ONCE, 14 DAYS        */
/* -------------------------------------------------------------------------- */

void describe("T2-T4: the trial starts only when email confirmation succeeds, once, for 14 days", () => {
  void test("the function is defined", () => {
    assert.ok(TRIAL, `public.${TRIAL_FUNCTION}() is not defined.`);
  });

  void test("it is a SECURITY DEFINER plpgsql trigger function with an empty search_path", () => {
    const header = TRIAL?.header ?? "";

    assert.match(header, /\breturns\s+trigger\b/i);
    assert.match(header, /\blanguage\s+plpgsql\b/i);
    assert.match(header, /\bsecurity\s+definer\b/i);
    assert.match(header, /\bset\s+search_path\s*=\s*''/i);
  });

  void test("the body is exactly one guarded update of the caller's own profile", () => {
    assert.equal(
      flat(TRIAL?.body ?? ""),
      "begin update public.profiles set trial_started_at = now(), trial_ends_at = now() + interval '14 days', " +
        "updated_at = now() where id = new.id and trial_started_at is null and trial_ends_at is null; return new; end;",
      "The trial must be server-clock only, bound to the confirmed row, and never overwrite an existing trial.",
    );
  });

  void test("the trigger fires only on the NULL -> confirmed transition of email_confirmed_at", () => {
    assert.equal(
      flat(statementStarting(new RegExp(String.raw`^create\s+trigger\s+${TRIAL_TRIGGER}\b`, "i"))),
      `create trigger ${TRIAL_TRIGGER} after update of email_confirmed_at on auth.users for each row ` +
        `when (old.email_confirmed_at is null and new.email_confirmed_at is not null) ` +
        `execute function public.${TRIAL_FUNCTION}()`,
    );
  });

  void test("the insert path never starts a trial (D3a: unconfirmed accounts get none)", () => {
    assert.ok(!/\btrial_/i.test(PROFILE?.body ?? ""), "Only the confirmation transition may write trial columns.");
  });

  void test("the trial length equals TRIAL_CONFIG.durationDays in lib/plans.ts", () => {
    const sqlDays = /interval\s+'(\d+)\s+days?'/i.exec(TRIAL?.body ?? "")?.[1];
    const planDays = trialDaysInPlans();

    assert.ok(sqlDays, "No trial interval in the migration.");
    assert.ok(planDays !== null, "TRIAL_CONFIG.durationDays not found in lib/plans.ts.");
    assert.equal(Number(sqlDays), planDays, "The database and the plan configuration disagree on the trial length.");
  });
});

/* -------------------------------------------------------------------------- */
/*                      T5 — NO USER-EDITABLE INPUT, NO SIDE EFFECTS          */
/* -------------------------------------------------------------------------- */

void describe("T5: values come from the server clock and the row id only", () => {
  void test("no metadata column is read", () => {
    assert.ok(
      !/\b(?:raw_user_meta_data|raw_app_meta_data|user_metadata|app_metadata)\b/i.test(SQL),
      "User-editable metadata must never decide a profile, a plan or a trial.",
    );
  });

  void test("no plan, subscription or billing column is written", () => {
    assert.ok(!/\b(?:plan|subscription_status|stripe_customer_id|stripe_subscription_id)\b/i.test(SQL));
  });

  void test("the only relations touched are public.profiles and auth.users", () => {
    const relations = new Set(
      [...SQL.matchAll(/\b(?:into|update|on|from)\s+([a-z_]+\.[a-z_]+)\b/gi)].map((match) =>
        (match[1] ?? "").toLowerCase(),
      ),
    );

    assert.deepEqual([...relations].sort(), ["auth.users", "public.profiles"]);
  });

  void test("no table, column, policy or grant is changed", () => {
    assert.ok(!/\b(?:alter|grant|truncate|comment)\b/i.test(SQL));
    assert.ok(!/\bcreate\s+(?:or\s+replace\s+)?(?:table|index|policy|view)\b/i.test(SQL));
    assert.ok(!/\bdelete\b/i.test(SQL));
  });

  void test("no BEFORE trigger: the auth.users row is never modified", () => {
    assert.ok(!/\bbefore\s+(?:insert|update|delete)\b/i.test(SQL));
  });
});

/* -------------------------------------------------------------------------- */
/*                       T6 — NOT CLIENT-EXECUTABLE, IDEMPOTENT               */
/* -------------------------------------------------------------------------- */

void describe("T6: neither function is client-executable; the migration re-runs cleanly", () => {
  for (const name of [PROFILE_FUNCTION, TRIAL_FUNCTION]) {
    void test(`execute on public.${name}() is revoked from public, anon and authenticated`, () => {
      const revoke = statementStarting(new RegExp(String.raw`^revoke\s+all\s+on\s+function\s+public\.${name}\s*\(`, "i"));
      const roles = new Set(
        (/\bfrom\s+([\s\S]+)$/i.exec(revoke)?.[1] ?? "").split(",").map((role) => role.trim().toLowerCase()),
      );

      assert.ok(revoke.length > 0, `No revoke for public.${name}().`);

      for (const role of ["public", "anon", "authenticated"]) {
        assert.ok(roles.has(role), `public.${name}() is still executable by ${role}.`);
      }
    });
  }

  for (const name of [PROFILE_TRIGGER, TRIAL_TRIGGER]) {
    void test(`${name} is dropped if it exists before it is created`, () => {
      const dropAt = STATEMENTS.findIndex((statement) =>
        new RegExp(String.raw`^drop\s+trigger\s+if\s+exists\s+${name}\s+on\s+auth\.users$`, "i").test(flat(statement)),
      );
      const createAt = STATEMENTS.findIndex((statement) =>
        new RegExp(String.raw`^create\s+trigger\s+${name}\b`, "i").test(statement),
      );

      assert.ok(dropAt !== -1 && createAt > dropAt);
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                   EVERY auth.users TRIGGER, IN ANY MIGRATION               */
/* -------------------------------------------------------------------------- */

void describe("Every trigger on auth.users runs a hardened SECURITY DEFINER function", () => {
  const sites = files.flatMap((file) =>
    [...code(file).matchAll(/create\s+trigger\s+([a-z_0-9]+)[\s\S]*?\bon\s+auth\.users\b[\s\S]*?execute\s+(?:function|procedure)\s+public\.([a-z_0-9]+)\s*\(/gi)].map(
      (match) => ({ file, trigger: match[1] ?? "", fn: (match[2] ?? "").toLowerCase() }),
    ),
  );

  void test("the scan finds this migration's two triggers", () => {
    assert.deepEqual(
      sites.filter((site) => site.file === FILE).map((site) => site.trigger).sort(),
      [PROFILE_TRIGGER, TRIAL_TRIGGER].sort(),
    );
  });

  void test("each executes a function declared SECURITY DEFINER with search_path = '' and revoked from clients", () => {
    const problems = sites.flatMap(({ file, trigger, fn }) => {
      const sql = code(file);
      const header =
        new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+public\.${fn}\s*\(\s*\)([\s\S]*?)\$\$`, "i").exec(sql)?.[1] ?? "";
      const revoked = new RegExp(
        String.raw`revoke\s+all\s+on\s+function\s+public\.${fn}\s*\(\s*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated`,
        "i",
      ).test(sql);

      return [
        ...(/\bsecurity\s+definer\b/i.test(header) ? [] : [`${file}: ${trigger} -> ${fn} is not SECURITY DEFINER`]),
        ...(/\bset\s+search_path\s*=\s*''/i.test(header) ? [] : [`${file}: ${trigger} -> ${fn} lacks search_path = ''`]),
        ...(revoked ? [] : [`${file}: ${trigger} -> ${fn} is not revoked from clients`]),
      ];
    });

    assert.deepEqual(problems, []);
  });
});
