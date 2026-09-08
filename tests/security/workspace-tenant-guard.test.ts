/**
 * SYRAVEN — body-supplied workspace ids must be authorized
 *
 * WHY THIS FILE EXISTS
 *
 * `workspaceId` arrives in the REQUEST BODY on three write paths. RLS
 * does not compensate: the insert policies test the OWNER column only
 * (`auth.uid() = user_id`), so a row carrying someone else's workspace
 * id is still "the caller's row" and is accepted.
 *
 * Verified against production before the fix -- user B, a member of no
 * workspace of A's, sent A's workspace id and received:
 *
 *   POST  /api/projects    201  planted
 *   POST  /api/knowledge   201  planted
 *   PATCH /api/projects    200  moved
 *
 * Nothing leaked on the day, because every read path also filters by
 * owner. That is the whole danger: the guarantee lived in the readers
 * rather than in the write, so any future query scoped by workspace
 * alone -- AI context assembly is the obvious one -- would have
 * surfaced attacker-controlled rows inside another tenant.
 *
 * The same guard was already applied correctly on the GET paths of the
 * very same files, which is what made the omission easy to miss.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

const PROJECTS = read("app", "api", "projects", "route.ts");
const KNOWLEDGE = read("app", "api", "knowledge", "route.ts");
const AGENTS = read("app", "api", "agents", "route.ts");

/** Slices one exported handler out of a route module. */
function handler(source: string, method: string): string {
  const start = source.indexOf(`export const ${method}`);

  assert.ok(start > 0, `${method} handler not found.`);

  const rest = source.slice(start + 10);
  const nextExport = rest.search(/export\s+(const|async function)\s+(GET|POST|PATCH|PUT|DELETE)/);

  return nextExport < 0 ? rest : rest.slice(0, nextExport);
}

void describe("Project writes authorize the target workspace", () => {
  void test("POST guards the body-supplied workspaceId", () => {
    const post = handler(PROJECTS, "POST");

    assert.match(
      post,
      /requireOptionalWorkspaceAccess/,
      "CRITICAL: a caller can create a project inside a workspace they " +
        "are not a member of.",
    );
  });

  void test("PATCH guards a move between workspaces", () => {
    const patch = handler(PROJECTS, "PATCH");

    assert.match(
      patch,
      /requireOptionalWorkspaceAccess/,
      "CRITICAL: a caller can relocate a project into another tenant's " +
        "workspace.",
    );
  });

  void test("the guard runs before the write, not after", () => {
    const post = handler(PROJECTS, "POST");

    const guard = post.indexOf("requireOptionalWorkspaceAccess");
    const write = post.indexOf(".insert(");

    assert.ok(guard > 0 && write > 0, "Expected both a guard and an insert.");
    assert.ok(
      guard < write,
      "A guard that runs after the insert authorizes nothing.",
    );
  });

  void test("a denied guard returns instead of continuing", () => {
    const post = handler(PROJECTS, "POST");

    assert.match(
      post,
      /if\s*\(\s*workspaceGuard\?\.denied\s*\)\s*\{\s*\n?\s*return/,
      "The denial must short-circuit the handler.",
    );
  });
});

void describe("Knowledge writes authorize the target workspace", () => {
  void test("POST guards the body-supplied workspaceId", () => {
    const post = handler(KNOWLEDGE, "POST");

    assert.match(
      post,
      /requireOptionalWorkspaceAccess/,
      "CRITICAL: a caller can plant a knowledge record inside another " +
        "tenant's workspace, where AI context assembly would read it.",
    );
  });

  void test("the guard runs before the insert", () => {
    const post = handler(KNOWLEDGE, "POST");

    const guard = post.indexOf("requireOptionalWorkspaceAccess");
    const write = post.indexOf(".insert(");

    assert.ok(guard > 0 && write > 0);
    assert.ok(guard < write);
  });
});

void describe("The agents route runs under RLS", () => {
  void test("it never builds a service-role client", () => {
    /*
     * Both handlers previously used the service-role key, so RLS never
     * executed on public.agents for ordinary traffic. Isolation rested
     * entirely on a hand-built `.or()` filter -- exactly the shape the
     * architecture notes name as the cause of a past breach.
     */
    assert.ok(
      !/SUPABASE_SERVICE_ROLE|supabaseAdmin|getSupabaseAdmin/.test(AGENTS),
      "CRITICAL: the agents route bypasses RLS.",
    );
  });

  void test("it does not import a raw supabase client", () => {
    /* Removing the constant but keeping the import invites its return. */
    assert.ok(
      !/from\s+"@supabase\/supabase-js"/.test(AGENTS),
      "The route must not be able to construct its own client.",
    );
  });

  void test("both handlers use the caller's client", () => {
    const uses = AGENTS.match(/session\.supabase/g) ?? [];

    assert.ok(
      uses.length >= 2,
      "Both GET and POST must run on the session client.",
    );
  });
});
