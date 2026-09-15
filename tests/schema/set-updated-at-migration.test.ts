/**
 * SYRAVEN — public.set_updated_at() migration
 * tests/schema/set-updated-at-migration.test.ts
 *
 * Batch 1 TEST prerequisite (docs/engineering/SECURITY_EVIDENCE.md).
 *
 * 20260908120000_syraven_canvases.sql creates a trigger that executes
 * public.set_updated_at(), which no migration defined. Production has the
 * function (created outside the repository); TEST and any database built
 * from these files do not, so the canvases migration fails and rolls back
 * there. 20260908110000_syraven_set_updated_at.sql defines the function,
 * exactly as production has it, only where it is missing.
 *
 * Static checks on the migration files; no database is involved.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase", "migrations");

const FILE = "20260908110000_syraven_set_updated_at.sql";
const PREVIOUS = "20260907120000_syraven_owner_self_membership.sql";
const CANVASES = "20260908120000_syraven_canvases.sql";

/**
 * The applied canvases migration, LF-normalized (`*.sql text eol=lf`).
 * It is applied in production; editing it would desync migration history.
 */
const CANVASES_SHA256 = "a0db540dcfb68ee0c29b8be374f1e17102f69964a0ec746a3bfb68b6c62a5de2";

const files = readdirSync(DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

function raw(file: string): string {
  return readFileSync(join(DIR, file), "utf8").replace(/\r\n/g, "\n");
}

/** SQL with whole-line `--` comments removed, as migration-integrity does. */
function code(file: string): string {
  return raw(file)
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

/**
 * Top-level statements. A semicolon inside any dollar-quoted body — `$$`
 * or a tagged `$name$` — is not a statement boundary, and an inner quote
 * with a different tag does not close the outer one.
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

const BLOCK = /do\s+\$migration\$([\s\S]*?)\$migration\$\s*;/i.exec(SQL)?.[1] ?? "";
const DEFINITION = /create\s+function\s+public\.set_updated_at\s*\(\s*\)([\s\S]*?)\$function\$([\s\S]*?)\$function\$\s*;/i.exec(BLOCK);
const HEADER = DEFINITION?.[1] ?? "";
const BODY = DEFINITION?.[2] ?? "";

/* -------------------------------------------------------------------------- */
/*                                   ORDER                                    */
/* -------------------------------------------------------------------------- */

void describe("set_updated_at() is defined where the canvases migration needs it", () => {
  void test("the migration exists", () => {
    assert.ok(PRESENT, `${FILE} is missing: the canvases migration cannot be applied from this repository.`);
  });

  void test("it sorts after the previous migration and before the canvases migration", () => {
    const at = files.indexOf(FILE);

    assert.ok(at !== -1, `${FILE} is not among the migrations.`);
    assert.ok(at > files.indexOf(PREVIOUS));
    assert.ok(
      at < files.indexOf(CANVASES),
      "The function must exist before 20260908120000 creates the trigger that executes it.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                   EVERY TRIGGER FUNCTION IS DEFINED FIRST                  */
/* -------------------------------------------------------------------------- */

void describe("Every trigger function is defined before a trigger executes it", () => {
  interface Site {
    readonly name: string;
    readonly file: number;
    readonly at: number;
  }

  const defined: Site[] = [];
  const executed: Site[] = [];

  files.forEach((file, index) => {
    const sql = code(file);

    for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_0-9]+)\s*\(/gi)) {
      if (match[1]) defined.push({ name: match[1].toLowerCase(), file: index, at: match.index ?? 0 });
    }

    for (const match of sql.matchAll(/execute\s+(?:function|procedure)\s+public\.([a-z_0-9]+)\s*\(/gi)) {
      if (match[1]) executed.push({ name: match[1].toLowerCase(), file: index, at: match.index ?? 0 });
    }
  });

  void test("the scan finds the triggers", () => {
    assert.ok(executed.length > 0, "No trigger was found; the scan is broken.");
  });

  void test("no migration executes a function that an earlier point in migration order does not define", () => {
    const problems = executed
      .filter(
        (site) =>
          !defined.some(
            (definition) =>
              definition.name === site.name &&
              (definition.file < site.file || (definition.file === site.file && definition.at < site.at)),
          ),
      )
      .map((site) => `${files[site.file]} executes public.${site.name}() before any migration defines it`);

    assert.deepEqual(problems, [], "A database built from these migrations would fail at CREATE TRIGGER.");
  });

  void test("the canvases trigger's function is defined by this repository", () => {
    const canvases = files.indexOf(CANVASES);

    assert.ok(
      defined.some((definition) => definition.name === "set_updated_at" && definition.file < canvases),
      "public.set_updated_at() exists only in production.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                         THE DEFINITION IS PRODUCTION'S                     */
/* -------------------------------------------------------------------------- */

void describe("The definition matches production (founder read-only, 2026-09-15)", () => {
  void test("the definition is found inside the migration block", () => {
    assert.ok(BLOCK.length > 0, "No do $migration$ … $migration$ block.");
    assert.ok(DEFINITION, "No create function public.set_updated_at() inside the block.");
  });

  void test("it returns trigger and is written in plpgsql", () => {
    assert.match(HEADER, /\breturns\s+trigger\b/i);
    assert.match(HEADER, /\blanguage\s+plpgsql\b/i);
  });

  void test("it is SECURITY INVOKER, never SECURITY DEFINER", () => {
    assert.match(HEADER, /\bsecurity\s+invoker\b/i);
    assert.ok(!/\bsecurity\s+definer\b/i.test(SQL), "Production's function runs as invoker.");
  });

  void test("it pins the empty search_path production uses", () => {
    assert.match(HEADER, /\bset\s+search_path\s*=\s*''/i, "Production's search_path is empty.");
    assert.ok(!/search_path\s*=\s*public/i.test(SQL), "search_path = public is not production's definition.");
  });

  void test("the body is exactly production's", () => {
    assert.equal(
      BODY.replace(/\s+/g, " ").trim().toLowerCase(),
      "begin new.updated_at = now(); return new; end;",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                   PRODUCTION'S EXISTING FUNCTION IS UNTOUCHED              */
/* -------------------------------------------------------------------------- */

void describe("An existing set_updated_at() is never touched", () => {
  void test("the create runs only when the function does not exist", () => {
    const guardAt = BLOCK.search(/if\s+to_regprocedure\(\s*'public\.set_updated_at\(\)'\s*\)\s+is\s+null\s+then/i);
    const createAt = BLOCK.search(/create\s+function\s+public\.set_updated_at/i);
    const endIfAt = BLOCK.search(/end\s+if\s*;/i);

    assert.ok(guardAt !== -1, "The create must be conditional: production already has the function.");
    assert.ok(createAt > guardAt && endIfAt > createAt, "The create must sit inside the guard.");
  });

  void test("it never replaces the function", () => {
    assert.ok(
      !/create\s+or\s+replace\s+function\s+public\.set_updated_at/i.test(SQL),
      "create or replace would rewrite production's function.",
    );
  });

  void test("it has no other effect: no alter, grant, revoke, drop or data change", () => {
    assert.ok(!/\b(?:alter|grant|revoke|drop|truncate|insert|delete|comment)\b/i.test(SQL));
    assert.ok(!/\bcreate\s+(?:or\s+replace\s+)?(?:table|index|policy|trigger|view)\b/i.test(SQL));
  });
});

/* -------------------------------------------------------------------------- */
/*                          THE FILE PARSES AS INTENDED                       */
/* -------------------------------------------------------------------------- */

void describe("The migration parses as one dollar-quoted statement", () => {
  void test("the parser keeps tagged dollar quotes and their inner semicolons together", () => {
    assert.deepEqual(statements("do $a$ begin x; $b$ y; $b$; end $a$; select 1;"), [
      "do $a$ begin x; $b$ y; $b$; end $a$",
      "select 1",
    ]);
  });

  void test("the file is exactly one statement: the conditional block", () => {
    const parsed = statements(SQL);

    assert.equal(parsed.length, 1, `Expected one statement, found ${parsed.length}.`);
    assert.match(parsed[0] ?? "", /^do\s+\$migration\$/i);
  });
});

/* -------------------------------------------------------------------------- */
/*                       THE APPLIED CANVASES FILE IS UNCHANGED               */
/* -------------------------------------------------------------------------- */

void describe("The applied canvases migration is unchanged", () => {
  void test("its content matches the applied version", () => {
    assert.equal(
      createHash("sha256").update(raw(CANVASES)).digest("hex"),
      CANVASES_SHA256,
      "20260908120000 is applied in production; fix forward with a new migration instead.",
    );
  });
});
