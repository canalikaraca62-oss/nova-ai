/**
 * SYRAVEN — integration_connections migration security tests
 *
 * Connector persistence. NOT YET APPLIED to any database.
 *
 * Static checks on the migration that would back OAuth connections to
 * Gmail, Calendar, GitHub, Slack and Notion. They do not connect to a
 * database, so they run today against a migration that is deliberately
 * pending human approval.
 *
 * WHY TEST A MIGRATION THAT HAS NOT RUN
 *
 * Because the review happens now and the application happens later,
 * possibly by someone else. A connector table is the highest-value
 * target in this schema: it points at the credentials that read a
 * user's mailbox. If the policies are wrong, the damage is not a broken
 * feature, it is one user reading another's mail.
 *
 * These assertions encode what the migration must still be true about
 * on the day someone runs it.
 *
 * THE CLAIMS UNDER TEST
 *
 *   1. No token is ever stored. The table holds an OPAQUE POINTER into
 *      a secret store, never the secret.
 *   2. Row level security is enabled BEFORE any policy exists, so there
 *      is no window in which the table is readable by anon.
 *   3. Every policy scopes to auth.uid() = user_id. A connection is
 *      personal; workspace_id must not widen it.
 *   4. anon is granted nothing.
 *   5. Disconnecting is always possible -- a user who cannot delete a
 *      connection cannot withdraw access to their own mailbox.
 *   6. Provider and status are constrained, so an unrecognised value
 *      cannot be written and then mishandled at read time.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = "20260909120000_syraven_integration_connections.sql";

const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", MIGRATION),
  "utf8",
);

/**
 * Strips line comments so assertions test statements, not prose.
 *
 * This migration explains at length why it stores no token. Reading raw
 * SQL, an assertion looking for the absence of "access_token" would
 * match that explanation and fail on a correct file -- or, worse, a
 * positive assertion would match the comment and pass on a broken one.
 * Three guards in this repository have already done exactly that.
 */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

const CODE = stripSqlComments(SQL);
const NORM = CODE.replace(/\s+/g, " ").toLowerCase();

/* -------------------------------------------------------------------------- */
/*                        NO CREDENTIAL IS EVER STORED                        */
/* -------------------------------------------------------------------------- */

void describe("The table holds a pointer, never a secret", () => {
  void test("no column could hold a token", () => {
    /*
     * The whole point of credential_ref. A column named for a token
     * invites one to be written there, and a refresh token in a
     * Postgres row is a standing compromise of the user's mailbox.
     *
     * ANCHORED ON COLUMN DEFINITIONS, NOT THE WHOLE FILE.
     *
     * Searching the file for "access_token" fails on a CORRECT
     * migration: 'personal_access_token' is a legitimate auth_type
     * value, and 'api_key' is another. Both describe what KIND of
     * credential lives in the secret store -- they are not columns
     * holding one. The first version of this assertion matched those
     * enum values and reported a defect that does not exist, which is
     * the same substring hole this repository has hit before.
     */
    const table = /create table if not exists public\.integration_connections \(([\s\S]*?)\n\);/.exec(
      CODE,
    )?.[1];

    assert.ok(
      table,
      "The table definition could not be located, so this assertion " +
        "would pass vacuously.",
    );

    /* Column names only: the identifier at the start of each line. */
    const columns = table
      .split("\n")
      .map((line) => /^\s*([a-z_]+)\s+(uuid|text|jsonb|timestamptz|integer|boolean|text\[\])/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name));

    assert.ok(
      columns.length > 5,
      `Only ${columns.length} columns parsed; the assertion below would ` +
        `check almost nothing.`,
    );

    for (const forbidden of [
      "access_token",
      "refresh_token",
      "client_secret",
      "api_key",
      "password",
      "private_key",
      "token",
      "secret",
    ]) {
      assert.ok(
        !columns.includes(forbidden),
        `Column "${forbidden}" would invite a real credential into the ` +
          `database. The table stores an opaque credential_ref into a ` +
          `secret store instead. Columns found: ${columns.join(", ")}`,
      );
    }
  });

  void test("credential_ref exists as the indirection", () => {
    assert.match(
      NORM,
      /credential_ref text/,
      "Without the pointer column there is nowhere to record WHICH " +
        "secret a connection uses, and the next change adds a token " +
        "column instead.",
    );
  });

  void test("the error column is not a provider response body", () => {
    /*
     * last_error is shown in connection health. A provider error body
     * can echo the request, including Authorization headers, so the
     * column must be plain text the application composes -- never a
     * jsonb dump of whatever came back.
     */
    assert.match(
      NORM,
      /last_error text/,
      "last_error must be application-composed text, not a jsonb " +
        "provider payload that can echo request headers.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    RLS IS ON BEFORE ANY POLICY EXISTS                      */
/* -------------------------------------------------------------------------- */

void describe("There is no window where the table is unprotected", () => {
  void test("row level security is enabled", () => {
    assert.match(
      NORM,
      /alter table public\.integration_connections enable row level security/,
      "Without RLS the policies below are decoration and the table is " +
        "readable by anyone with the anon key.",
    );
  });

  void test("RLS is enabled BEFORE the first policy is created", () => {
    const rlsAt = NORM.indexOf("enable row level security");
    const firstPolicyAt = NORM.indexOf("create policy");

    assert.ok(rlsAt > 0, "RLS must be enabled.");
    assert.ok(firstPolicyAt > 0, "Policies must exist.");
    assert.ok(
      rlsAt < firstPolicyAt,
      "Creating a policy before enabling RLS leaves the table fully " +
        "readable for the interval between the two statements.",
    );
  });

  void test("every policy is paired with a drop, so re-running is safe", () => {
    const creates = (CODE.match(/create policy/gi) ?? []).length;
    const drops = (CODE.match(/drop policy if exists/gi) ?? []).length;

    assert.ok(creates > 0, "The migration must create policies.");
    assert.equal(
      drops,
      creates,
      `${creates} policies created but ${drops} dropped. An unpaired ` +
        `create fails on re-run, which turns an idempotent migration ` +
        `into one that cannot be applied twice.`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      EVERY POLICY SCOPES TO THE OWNER                      */
/* -------------------------------------------------------------------------- */

void describe("A connection is personal, and stays personal", () => {
  const OPERATIONS = ["select", "insert", "update", "delete"] as const;

  for (const operation of OPERATIONS) {
    void test(`the ${operation} policy exists`, () => {
      assert.match(
        NORM,
        new RegExp(`create policy "integration_connections_${operation}_own"`),
        `Without a ${operation} policy, RLS denies the operation ` +
          `entirely -- which for delete means a user cannot withdraw ` +
          `access to their own mailbox.`,
      );
    });
  }

  void test("every policy is scoped by auth.uid() = user_id", () => {
    /*
     * Counted rather than merely present. Four policies need four
     * scopes; update needs two (USING and WITH CHECK), so five is the
     * floor. A policy without one would expose every row in the table.
     */
    const scopes = (NORM.match(/auth\.uid\(\) = user_id/g) ?? []).length;

    assert.ok(
      scopes >= 5,
      `Only ${scopes} owner scopes found. select, insert and delete ` +
        `need one each and update needs both USING and WITH CHECK, or ` +
        `a caller can read or alter another user's connection.`,
    );
  });

  void test("workspace_id does not appear in any policy", () => {
    /*
     * The subtle failure. Scoping by workspace would let any member of
     * a shared workspace act as the connection's owner -- reading the
     * mailbox of whoever connected it. Membership is not consent.
     */
    const policyText = NORM.slice(NORM.indexOf("create policy"));

    assert.ok(
      !/using \([^)]*workspace_id/.test(policyText) &&
        !/with check \([^)]*workspace_id/.test(policyText),
      "A workspace-scoped policy would let a co-member use somebody " +
        "else's mailbox credential. Membership is not consent.",
    );
  });

  void test("the update policy carries WITH CHECK, not only USING", () => {
    /*
     * USING decides which rows may be updated; WITH CHECK decides what
     * they may become. Without the second, a caller can update their
     * own row and set user_id to someone else -- handing their
     * connection away, or claiming one.
     */
    const update = /create policy "integration_connections_update_own"[\s\S]*?;/.exec(
      NORM,
    )?.[0];

    assert.ok(update, "The update policy must exist.");
    assert.match(
      update,
      /using \(auth\.uid\(\) = user_id\)[\s\S]*with check \(auth\.uid\(\) = user_id\)/,
      "Without WITH CHECK, an update can move a row to another user_id.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                         THE ANON ROLE GETS NOTHING                         */
/* -------------------------------------------------------------------------- */

void describe("An unauthenticated caller learns nothing", () => {
  void test("anon is revoked explicitly", () => {
    assert.match(
      NORM,
      /revoke all on public\.integration_connections from anon/,
      "An unauthenticated caller has no business knowing that a " +
        "connection exists, let alone for whom.",
    );
  });

  void test("grants go to authenticated only", () => {
    const grant = /grant [\s\S]*?on public\.integration_connections to (\w+)/.exec(
      NORM,
    );

    assert.ok(grant, "The table must grant something to somebody.");
    assert.equal(
      grant[1],
      "authenticated",
      `Privileges were granted to "${grant[1]}" rather than ` +
        `authenticated.`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    UNRECOGNISED VALUES CANNOT BE WRITTEN                   */
/* -------------------------------------------------------------------------- */

void describe("Provider and status are constrained at the schema", () => {
  void test("provider is a closed set", () => {
    assert.match(
      NORM,
      /provider text not null\s+check\s*\(\s*provider in \(/,
      "Free-text provider lets an unrecognised value be written and " +
        "then silently mishandled at read time.",
    );

    for (const provider of ["gmail", "calendar", "github", "slack", "notion"]) {
      assert.ok(
        NORM.includes(`'${provider}'`),
        `${provider} must be in the provider allowlist, or connecting ` +
          `it is impossible.`,
      );
    }
  });

  void test("status defaults to pending, not active", () => {
    /*
     * Fail closed at birth. A row that defaults to 'active' grants a
     * capability the moment it is inserted, before any credential has
     * been verified.
     */
    assert.match(
      NORM,
      /status text not null default 'pending'/,
      "A connection must not be usable before its credential is " +
        "verified. Only 'active' permits a capability.",
    );
  });

  void test("one row per account per provider per user", () => {
    assert.match(
      NORM,
      /unique \(user_id, provider, external_account_id\)/,
      "Without this, reconnecting leaves duplicate rows and revocation " +
        "targets an arbitrary one of them.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                       THE MIGRATION IS RE-RUNNABLE                         */
/* -------------------------------------------------------------------------- */

void describe("Applying it twice is safe", () => {
  void test("the table creation is guarded", () => {
    assert.match(
      NORM,
      /create table if not exists public\.integration_connections/,
      "An unguarded create table fails the second time it is applied.",
    );
  });

  void test("every index is guarded", () => {
    const indexes = CODE.match(/create index/gi) ?? [];
    const guarded = CODE.match(/create index if not exists/gi) ?? [];

    assert.equal(
      guarded.length,
      indexes.length,
      `${indexes.length} indexes but only ${guarded.length} guarded.`,
    );
  });

  void test("it contains no destructive statement", () => {
    /*
     * The rule migration-integrity applies to every migration: a
     * connector migration must never drop or truncate a table. Applied
     * here too, because this one is reviewed in isolation and may be
     * applied by hand.
     */
    for (const destructive of ["drop table", "truncate", "delete from"]) {
      assert.ok(
        !NORM.includes(destructive),
        `"${destructive}" has no place in a migration that creates a ` +
          `connector table.`,
      );
    }
  });
});
