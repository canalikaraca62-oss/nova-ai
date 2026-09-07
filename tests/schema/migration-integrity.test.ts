/**
 * SYRAVEN — Migration integrity tests
 *
 * Phase 2 (see IMPLEMENTATION_PLAN.md).
 *
 * These are offline, static checks on the migration files themselves.
 * They do not connect to a database, so they run anywhere — including CI
 * without Docker — and they guard the invariants Phase 2 established:
 *
 *   - every table the application queries has a migration
 *   - migrations stay additive and non-destructive
 *   - object creation is idempotent
 *   - foreign keys are declared after their target tables
 *   - RLS policies are re-appliable
 *   - the hardened handle_updated_at() is not silently regressed
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sources = new Map<string, string>(
  files.map((f) => [f, readFileSync(join(MIGRATIONS_DIR, f), "utf8")]),
);

const allSql = [...sources.values()].join("\n");

/** Strips SQL line comments so assertions test statements, not prose. */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

const allCode = stripSqlComments(allSql);

/* -------------------------------------------------------------------------- */
/*                          NON-DESTRUCTIVE INVARIANT                         */
/* -------------------------------------------------------------------------- */

void describe("Migrations are non-destructive", () => {
  /**
   * `drop policy if exists` is permitted: it is the idempotency idiom for
   * policies and destroys no data. Everything else that drops or deletes
   * is forbidden.
   *
   * TRUNCATE — COMMAND vs PRIVILEGE NAME
   *
   * `truncate` is two different things in SQL, and only one is
   * destructive:
   *
   *   TRUNCATE TABLE users;                     -- a COMMAND. Destroys rows.
   *   REVOKE TRUNCATE ON ... FROM anon;         -- a PRIVILEGE NAME. Removes
   *                                                the ability to truncate.
   *
   * The original `/\btruncate\b/i` could not tell them apart, so it
   * flagged 20260906120000_syraven_privilege_repair.sql — a migration
   * whose `REVOKE TRUNCATE` statements HARDEN the database by taking
   * that privilege away from anon, authenticated and service_role. The
   * rule was firing on the exact opposite of what it exists to catch.
   *
   * The command form always begins a statement, so it is anchored to the
   * start of input or to a preceding `;`. A privilege name never appears
   * there: it is always preceded by GRANT, REVOKE, or a comma in a
   * privilege list. Anchoring is what separates the two, and it keeps
   * every genuinely destructive form caught — `TRUNCATE TABLE`,
   * `TRUNCATE ONLY`, `TRUNCATE public.t`, bare `TRUNCATE t`, and
   * multi-table `TRUNCATE t1, t2 CASCADE`.
   */
  const FORBIDDEN = [
    /\bdrop\s+table\b/i,
    /\bdrop\s+database\b/i,
    /\bdrop\s+schema\b/i,
    /(^|;)\s*truncate\b/im,
    /\bdelete\s+from\b/i,
    /\balter\s+table\s+\S+\s+drop\s+column\b/i,
  ];

  for (const [name, sql] of sources) {
    void test(`${name} contains no destructive statement`, () => {
      const code = stripSqlComments(sql);

      for (const pattern of FORBIDDEN) {
        assert.equal(
          pattern.test(code),
          false,
          `${name} contains a destructive statement matching ${pattern}. ` +
            `Migrations must be additive; destructive changes require ` +
            `explicit human approval.`,
        );
      }
    });
  }

  /*
   * Narrowing a security rule is only safe if the narrowing is itself
   * tested. These hold the TRUNCATE pattern to both halves of its
   * contract against synthetic SQL, so a future "simplification" that
   * silently stops catching real truncations fails here rather than in
   * production.
   */
  /*
   * Selected by matching, not by index: a positional reference would
   * silently start testing a different rule if FORBIDDEN is reordered.
   */
  const TRUNCATE_RULE = FORBIDDEN.find((pattern) =>
    pattern.source.includes("truncate"),
  );

  void test("the TRUNCATE rule still catches every destructive form", () => {
    assert.ok(TRUNCATE_RULE, "The TRUNCATE pattern is missing from FORBIDDEN.");

    const destructive = [
      "truncate table public.users;",
      "truncate only public.users;",
      "truncate public.projects;",
      "truncate users;",
      "select 1; truncate table t;",
      "TRUNCATE TABLE Public.Users;",
      "\n   truncate table t;",
      "truncate t1, t2 cascade;",
    ];

    for (const sql of destructive) {
      assert.equal(
        TRUNCATE_RULE.test(sql),
        true,
        `A destructive TRUNCATE was not caught: ${JSON.stringify(sql)}`,
      );
    }
  });

  void test("the TRUNCATE rule permits privilege statements", () => {
    assert.ok(TRUNCATE_RULE);

    const hardening = [
      "revoke truncate on all tables in schema public from anon;",
      "revoke truncate on public.t from anon;",
      "alter default privileges for role postgres in schema public " +
        "revoke truncate on tables from anon;",
      "grant truncate on all tables in schema public to service_role;",
      "revoke select, insert, truncate on public.t from anon;",
      "alter default privileges\n  for role postgres\n" +
        "  revoke truncate on tables from anon;",
    ];

    for (const sql of hardening) {
      assert.equal(
        TRUNCATE_RULE.test(sql),
        false,
        `A privilege statement was wrongly flagged as destructive: ` +
          `${JSON.stringify(sql)}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                                IDEMPOTENCY                                 */
/* -------------------------------------------------------------------------- */

void describe("Object creation is idempotent", () => {
  for (const [name, sql] of sources) {
    const code = stripSqlComments(sql);

    void test(`${name} guards every create table`, () => {
      const creates = code.match(/create\s+table\s+(?!if not exists)/gi);

      assert.equal(
        creates,
        null,
        `${name} has a "create table" without "if not exists".`,
      );
    });

    void test(`${name} guards every create index`, () => {
      const creates = code.match(
        /create\s+(unique\s+)?index\s+(?!if not exists|concurrently)/gi,
      );

      assert.equal(
        creates,
        null,
        `${name} has a "create index" without "if not exists".`,
      );
    });

    void test(`${name} pairs every create policy with a drop`, () => {
      /*
       * 20260901154222 creates 29 policies with no "drop policy if
       * exists" guard, so re-applying it fails with "policy already
       * exists". That migration is ALREADY APPLIED to the hosted
       * project; editing it now would change its checksum and desync
       * the migration history, so it is not modified here.
       *
       * 20260904123000 repairs it additively instead, and DATABASE.md
       * records the defect. This exemption is deliberate and scoped to
       * that one historical file — every other migration, including all
       * new ones, must be idempotent.
       */
      const KNOWN_UNGUARDED = "20260901154222_syraven_enterprise_core.sql";

      if (name === KNOWN_UNGUARDED) {
        return;
      }

      const created = [
        ...code.matchAll(/create policy\s+"([^"]+)"/gi),
      ].flatMap((m) => (m[1] ? [m[1]] : []));

      const dropped = new Set(
        [...code.matchAll(/drop policy if exists\s+"([^"]+)"/gi)].flatMap(
          (m) => (m[1] ? [m[1]] : []),
        ),
      );

      const unpaired = created.filter((p) => !dropped.has(p));

      assert.deepEqual(
        unpaired,
        [],
        `${name} creates policies without a preceding ` +
          `"drop policy if exists", so re-applying the migration fails.`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                     APPLICATION TABLES ARE IN MIGRATIONS                   */
/* -------------------------------------------------------------------------- */

void describe("Every table the application queries has a migration", () => {
  /**
   * Tables read or written by application code. Before Phase 2, three of
   * these (profiles, usage, agents) existed only in the hosted project —
   * the schema drift recorded in ARCHITECTURE_AUDIT.md §9.1.
   */
  const APP_TABLES = [
    "profiles",
    "usage",
    "agents",
    "knowledge",
    "notifications",
    "projects",
    "tasks",
  ];

  const created = new Set(
    [
      ...allCode.matchAll(
        /create table if not exists public\.([a-z_0-9]+)/gi,
      ),
    ].flatMap((m) => (m[1] ? [m[1].toLowerCase()] : [])),
  );

  for (const table of APP_TABLES) {
    void test(`public.${table} is created by a migration`, () => {
      assert.ok(
        created.has(table),
        `The application queries "${table}" but no migration creates it. ` +
          `The database would not be reproducible from this repository.`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                          FOREIGN KEY ORDERING                              */
/* -------------------------------------------------------------------------- */

void describe("Foreign keys resolve in application order", () => {
  void test("every referenced public table is created before it is referenced", () => {
    // Position of each table's creation across the concatenated migrations,
    // in file order.
    const ordered: string[] = [];
    const createdAt = new Map<string, number>();

    for (const name of files) {
      const code = stripSqlComments(sources.get(name) ?? "");
      const lines = code.split("\n");

      lines.forEach((line) => {
        const c = line.match(
          /create table if not exists public\.([a-z_0-9]+)/i,
        );
        if (c?.[1]) {
          const t = c[1].toLowerCase();
          if (!createdAt.has(t)) createdAt.set(t, ordered.length);
          ordered.push(t);
        }
      });
    }

    // Walk again, tracking the current table, and check each FK target.
    const problems: string[] = [];
    let cursor = -1;
    let current = "";

    for (const name of files) {
      const code = stripSqlComments(sources.get(name) ?? "");

      for (const line of code.split("\n")) {
        const c = line.match(
          /create table if not exists public\.([a-z_0-9]+)/i,
        );
        if (c?.[1]) {
          current = c[1].toLowerCase();
          cursor = createdAt.get(current) ?? cursor;
          continue;
        }

        const r = line.match(/references\s+public\.([a-z_0-9]+)/i);
        if (!r?.[1]) continue;

        const target = r[1].toLowerCase();
        const targetPos = createdAt.get(target);

        if (targetPos === undefined) {
          problems.push(
            `${current} references public.${target}, which no migration creates`,
          );
        } else if (targetPos > cursor) {
          problems.push(
            `${current} references public.${target} before it is created`,
          );
        }
      }
    }

    assert.deepEqual(
      problems,
      [],
      `Foreign key targets must exist before they are referenced:\n${problems.join("\n")}`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                       handle_updated_at() HARDENING                        */
/* -------------------------------------------------------------------------- */

void describe("handle_updated_at() stays hardened", () => {
  /**
   * ARCHITECTURE_AUDIT.md §9.3: the function is defined more than once,
   * and an earlier migration's definition omitted `set search_path`.
   * Whichever definition sorts LAST wins at apply time, so that one must
   * carry the guard.
   */
  void test("the last definition sets an explicit search_path", () => {
    const defining = files.filter((f) =>
      /create or replace function public\.handle_updated_at/i.test(
        sources.get(f) ?? "",
      ),
    );

    assert.ok(
      defining.length > 0,
      "handle_updated_at() is not defined by any migration.",
    );

    const last = defining[defining.length - 1] ?? "";
    const sql = sources.get(last) ?? "";

    const body = sql.slice(
      sql.search(
        /create or replace function public\.handle_updated_at/i,
      ),
    );

    const definition = body.slice(0, body.indexOf("$$;") + 3);

    assert.match(
      definition,
      /set\s+search_path\s*=/i,
      `The winning definition of handle_updated_at() (in ${last}) does not ` +
        `set search_path. A trigger function with a mutable search_path can ` +
        `be redirected by a caller-controlled search_path.`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                              RLS COVERAGE                                  */
/* -------------------------------------------------------------------------- */

void describe("RLS coverage", () => {
  const rlsEnabled = new Set(
    [
      ...allCode.matchAll(
        /alter table public\.([a-z_0-9]+)\s+enable row level security/gi,
      ),
    ].flatMap((m) => (m[1] ? [m[1].toLowerCase()] : [])),
  );

  /**
   * Tables holding per-user data. Each must have RLS enabled so that the
   * anon and authenticated roles are constrained, independently of the
   * service-role client the routes currently use.
   */
  const USER_DATA_TABLES = [
    "profiles",
    "usage",
    "usage_events",
    "user_settings",
    "agents",
    "agent_conversations",
    "agent_messages",
    "agent_tasks",
    "agent_runs",
    "chats",
    "conversations",
    "messages",
    "files",
    "memories",
    "teams",
    "knowledge",
    "notifications",
    "tasks",
  ];

  for (const table of USER_DATA_TABLES) {
    void test(`public.${table} has RLS enabled`, () => {
      assert.ok(
        rlsEnabled.has(table),
        `public.${table} holds per-user data but no migration enables Row ` +
          `Level Security on it.`,
      );
    });
  }

  void test("metering tables grant no client write policy", () => {
    /**
     * A client that could insert or update its own usage rows could forge
     * metering and defeat the limits Phase 5 will enforce. Only SELECT is
     * allowed for these tables.
     */
    for (const table of ["usage", "usage_events"]) {
      const writePolicy = new RegExp(
        `create policy[^;]*?on public\\.${table}\\s*\\n\\s*for (insert|update|delete)`,
        "i",
      );

      assert.equal(
        writePolicy.test(allCode),
        false,
        `public.${table} has a client-facing write policy. Usage records ` +
          `must only be written by trusted server code.`,
      );
    }
  });
});
