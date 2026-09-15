/**
 * SYRAVEN — the North Star invariants, checked against the code
 * tests/security/architecture-invariants.test.ts
 *
 * ARCHITECTURE REGRESSION SUITE.
 *
 * ARCHITECTURE_NORTH_STAR.md §12 lists sixteen invariants that make the
 * work loop one system instead of a pile of features. Each is asserted
 * here against the current source -- comments stripped, so prose that
 * names a forbidden pattern cannot satisfy or trip a check.
 *
 * Where an invariant cannot hold yet because a substrate is missing
 * (no scheduler, no outcome store), the gap is recorded as a `todo`
 * test with the exact reason. A todo is reported, not passed: it keeps
 * the blocked invariant visible in every test run instead of letting a
 * green suite imply it holds.
 *
 * Several invariants also have deep dedicated suites (approval-*,
 * semantic-*, graph-edges-are-real, usage-*). This file does not repeat
 * them; it pins the CROSS-CUTTING property -- usually "exactly one
 * place may do X" -- that no single-subsystem suite can see.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

/** Executable code only: JSX, block and line comments removed. */
function strip(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function code(...parts: string[]): string {
  return strip(read(...parts));
}

/** Every source file under a directory, as repo-relative forward-slash paths. */
function sources(dir: string, pattern: RegExp): string[] {
  const base = join(ROOT, dir);
  if (!existsSync(base)) return [];

  return (readdirSync(base, { recursive: true }) as string[])
    .map((entry) => join(base, entry))
    .filter((full) => pattern.test(full))
    .map((full) => relative(ROOT, full).replace(/\\/g, "/"))
    .sort();
}

const ROUTES = sources("app/api", /route\.ts$/);
const APP_AND_LIB = [...sources("app", /\.(ts|tsx)$/), ...sources("lib", /\.ts$/)];

function filesMatching(files: readonly string[], pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(strip(read(file))));
}

/** Every migration, in filename (= apply) order, with `--` comments removed. */
const MIGRATIONS_SQL = sources("supabase/migrations", /\.sql$/)
  .map((file) => read(file).replace(/--.*$/gm, ""))
  .join("\n");

/** The last definition of a policy, up to its terminating semicolon. */
function lastPolicy(sql: string, name: string): string {
  const start = sql.lastIndexOf(`create policy "${name}"`);
  assert.ok(start !== -1, `No policy named ${name}.`);
  return sql.slice(start, sql.indexOf(";", start));
}

/* -------------------------------------------------------------------------- */
/*  1. THE CLIENT CANNOT DEFINE AUTHORIZATION TRUTH                           */
/* -------------------------------------------------------------------------- */

void describe("1. The client cannot define authorization truth", () => {
  void test("no route reads identity, role, approval or entitlement from the request", () => {
    /*
     * `status` is deliberately absent: task, project and knowledge status
     * are resource fields a user edits, not authority. `plan` is handled
     * below -- one route may read it, as a purchase choice.
     */
    const authority =
      /\b(?:body|payload|json)\s*\??\.\s*(userId|user_id|ownerId|owner_id|role|isAdmin|approved|decidedBy|decided_by_user_id|priceId|price_id|organizationId|organization_id|tenantId|tenant_id|entitlement|effectivePlan|risk|executionKey)\b/;

    const offenders = ROUTES.filter((file) => authority.test(code(file)));

    assert.deepEqual(offenders, [], `Authority read from a request in:\n${offenders.join("\n")}`);
  });

  void test("only checkout reads a plan from the request, and only as a choice", () => {
    const readers = filesMatching(ROUTES, /\bbody\s*\??\.\s*plan\b/);

    assert.deepEqual(readers, ["app/api/billing/checkout/route.ts"]);

    /*
     * The plan names what to buy. The price is resolved server-side and
     * the entitlement is written only by the verified webhook (see 12).
     */
    assert.ok(!/\bbody\s*\??\.\s*(priceId|price_id|amount)\b/.test(code("app/api/billing/checkout/route.ts")));
  });
});

/* -------------------------------------------------------------------------- */
/*  2. THE CLIENT CANNOT DEFINE TENANT TRUTH                                  */
/* -------------------------------------------------------------------------- */

void describe("2. The client cannot define tenant truth", () => {
  /*
   * A route may accept a workspace or project id -- to NARROW -- only if it
   * proves access to it. The one exception echoes the caller's own id back
   * in a response and touches no data, so the id scopes nothing.
   */
  const ECHO_ONLY: Readonly<Record<string, string>> = {
    "app/api/files/analyze/route.ts":
      "echoes body.workspaceId/projectId in response metadata; runs no query",
  };

  const readsTenantId =
    /\b(?:body|payload|searchParams|params)[^;\n]*\b(workspaceId|workspace_id|projectId|project_id)\b/;
  const provesTenant =
    /require(?:Optional)?(?:Workspace|Project)Access\(|authorize(?:Workspace|Project)\(/;

  void test("every route taking a tenant id proves access to it", () => {
    const unguarded = ROUTES.filter((file) => {
      const source = code(file);
      return readsTenantId.test(source) && !provesTenant.test(source);
    });

    assert.deepEqual(
      unguarded,
      Object.keys(ECHO_ONLY),
      `Routes accepting a tenant id without proving access:\n${unguarded.join("\n")}`,
    );
  });

  void test("the database refuses a write into another tenant's conversation or organization", () => {
    /*
     * RLS is the only boundary for a signed-in user calling PostgREST
     * directly. messages_insert_own OR'd its ownership paths (user_id
     * alone admitted a row into anyone's conversation) and the projects
     * policies never checked organization_id. Replayed in order, the
     * migrations must end with both closed. Repository state only: the
     * production state of 20260913130000 is in MIGRATION_APPROVAL_REQUIRED.md.
     */
    const sql = MIGRATIONS_SQL;

    /*
     * The privilege is the operative control: messages is a drifted table,
     * and an untracked permissive INSERT policy in production would OR past
     * any policy written here. The corrected policy is defense in depth.
     */
    const revokeMessages = sql.lastIndexOf("revoke insert on table public.messages from authenticated;");
    assert.ok(revokeMessages !== -1, "INSERT on messages must be revoked from authenticated.");

    const regrant = /grant [^;]*\binsert\b[^;]*\bon (?:all tables in schema public|table public\.messages|public\.messages)\b[^;]*\bto\b[^;]*\bauthenticated\b/;
    assert.ok(!regrant.test(sql.slice(revokeMessages)), "INSERT on messages must not be re-granted.");

    const messages = lastPolicy(sql, "messages_insert_own");
    assert.match(messages, /auth\.uid\(\) = user_id\s+and\s+\(\s*conversation_id is null/, "Every ownership path on a message must hold, not any one.");
    assert.ok(!/auth\.uid\(\) = user_id\s+or\b/.test(messages), "user_id alone must not admit a message.");

    for (const name of ["users can create projects", "owners and admins can update projects"]) {
      const check = lastPolicy(sql, name).split(/with check/)[1] ?? "";
      assert.match(check, /organization_id is null\s+or public\.is_organization_member\(organization_id\)/, `${name} must prove membership of the organization it names.`);
    }
  });

  void test("no code treats a client-writable table as an authority", () => {
    /*
     * These tables accept writes from the signed-in user through PostgREST
     * (North Star §9): api_keys (un-revoke, any organization, any
     * permissions), ai_budgets (own limit and usage), ai_agent_executions
     * and their steps (own token/cost records). Harmless only while nothing
     * reads them. The first reader needs the closing migration first.
     */
    const readers = filesMatching(
      APP_AND_LIB,
      /\.from\(["'](?:api_keys|ai_budgets|ai_agent_executions|ai_execution_steps|ai_tool_executions)["']\)/,
    );

    assert.deepEqual(readers, [], "A client-writable table became an input; close its write path (migration) first.");
  });

  void test("no route trusts an organization role while an admin can take ownership", () => {
    /*
     * The organizations/organization_members policies let an org admin set
     * owner_id to themselves and give any member the owner role (North
     * Star §9). No route passes a minimum role today, so no decision rests
     * on it. The first one must wait for the migration that closes that.
     */
    const trusting = filesMatching(sources("app", /\.(ts|tsx)$/), /minimumRole:\s*["'](?:owner|admin)["']/);

    assert.deepEqual(trusting, [], "A route trusts an organization role that an admin can still forge.");
  });

  void test("an unguarded echo cannot reach data", () => {
    for (const file of Object.keys(ECHO_ONLY)) {
      assert.ok(
        !/\.from\(|\.rpc\(/.test(code(file)),
        `${file} is allowed an unproven tenant id only because it runs no query.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  3. AI CANNOT BYPASS POLICY                                                */
/* -------------------------------------------------------------------------- */

void describe("3. AI cannot bypass policy", () => {
  /*
   * PROVIDER_ENDPOINTS[ is a paid call site too: /api/chat takes its base
   * URL from the registry (P2-F08). Without it that route would match
   * nothing here and silently leave the metering check below.
   */
  const PAID_CALL =
    /api\.openai\.com|api\.groq\.com|PROVIDER_ENDPOINTS\[|chatCompletion(?:Stream|WithFailover)?\(|runOrchestration\(|embedText\(|createOpenAiEmbeddingClient\(/;

  /** The first step inside a handler that leads to a paid provider. */
  const PAID_STEP =
    /resolveAiPolicy\(|selectModel\(|chatCompletion(?:Stream|WithFailover)?\(|runOrchestration\(|embedText\(|createOpenAiEmbeddingClient\(|\bfetch\(/;

  void test("every route that reaches a paid model is metered before the call", () => {
    /*
     * Measured INSIDE each mutating handler. Provider URLs are usually
     * module constants declared above it, so a file-wide comparison finds
     * the URL "before" a guard that in fact runs first on every request.
     */
    const missing: string[] = [];

    for (const file of ROUTES) {
      const source = code(file);
      if (!PAID_CALL.test(source)) continue;

      const starts = [...source.matchAll(/export\s+(?:const|async\s+function)\s+(?:POST|PUT|PATCH)\b/g)]
        .map((match) => match.index ?? 0);

      assert.ok(starts.length > 0, `${file} reaches a paid provider but has no mutating handler.`);

      for (const start of starts) {
        const rest = source.slice(start + 1);
        const next = rest.search(/\nexport\s/);
        const body = next === -1 ? rest : rest.slice(0, next);

        const step = body.search(PAID_STEP);
        if (step === -1) continue;

        const guard = body.search(/enforceUsage\(|checkRateLimit\(/);

        if (guard === -1 || guard > step) missing.push(file);
      }
    }

    assert.deepEqual(missing, [], `Paid AI calls without a prior usage or rate control:\n${missing.join("\n")}`);
  });

  void test("no key falls back across providers, and no endpoint is env-overridable", () => {
    /*
     * /api/agents/execute chose AI_API_KEY || GROQ_API_KEY || OPENAI_API_KEY
     * and AI_BASE_URL || api.groq.com: with only an OpenAI key set, it sent
     * that key to Groq. A key must travel only to its own provider, which
     * lib/ai/provider.ts guarantees by deriving both from the model.
     */
    /*
     * Only a fallback that is ASSIGNED -- i.e. becomes the credential -- is
     * a defect. `OPENAI_API_KEY || GROQ_API_KEY ? "operational" : ...` in a
     * status endpoint is a boolean about configuration and sends nothing.
     */
    const crossProvider =
      /=\s*process\.env\.(?:AI|GROQ|OPENAI)_API_KEY\s*\|\|\s*process\.env\.(?:GROQ|OPENAI)_API_KEY|process\.env\.AI_(?:BASE_URL|API_KEY)\b|process\.env\.GROQ_BASE_URL\b/;

    const offenders = filesMatching(APP_AND_LIB, crossProvider);

    assert.deepEqual(offenders, [], `Cross-provider key or endpoint override in:\n${offenders.join("\n")}`);
  });

  void test("no route builds its own provider SDK client", () => {
    /*
     * /api/canvas imported the OpenAI SDK and sent whatever
     * OPENAI_CANVAS_MODEL named: a model no plan check approved, on a
     * transport the AI policy never saw. Generation goes through
     * lib/ai/provider.ts after lib/ai/registry.ts chooses the model.
     */
    assert.deepEqual(filesMatching(ROUTES, /from\s+["']openai["']|new OpenAI\(/), []);
  });

  void test("a model chosen by the caller is resolved by the registry first", () => {
    for (const file of ROUTES) {
      const source = code(file);
      if (!/chatCompletion(?:Stream)?\(/.test(source)) continue;

      assert.match(
        source,
        /resolveAiPolicy\(|selectModel\(/,
        `${file} calls the provider adapter without resolving a model.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  4. AN AGENT CANNOT BYPASS THE ACTION ENGINE                               */
/* -------------------------------------------------------------------------- */

void describe("4. An agent cannot bypass the action engine", () => {
  void test("tools run in exactly one place", () => {
    const callers = filesMatching(APP_AND_LIB, /\bexecuteTool\(/);

    assert.deepEqual(callers, ["lib/orchestration/orchestrator.ts", "lib/orchestration/tools.ts"]);
  });

  void test("the tool executors are imported only by the orchestrator", () => {
    const importers = filesMatching(APP_AND_LIB, /from\s+["'](?:\.\/tools|@\/lib\/orchestration\/tools)["']/);

    assert.deepEqual(importers, ["lib/orchestration/orchestrator.ts"]);
  });

  void test("/api/action classifies; it neither runs work nor claims it ran", () => {
    const source = code("app/api/action/route.ts");

    assert.ok(!/executeTool\(|\.from\(|\.rpc\(/.test(source), "/api/action must not execute or write.");
    assert.ok(!/message:\s*"Done\."/.test(source), "\"Done.\" for an action nothing ran is fabricated success.");
  });

  void test("/api/tasks/execute cannot mark a task done", () => {
    const source = code("app/api/tasks/execute/route.ts");

    assert.ok(!/\.from\(|\.update\(|"completed"/.test(source), "A task may not be completed by an endpoint that did no work.");
    assert.match(source, /status:\s*410/);
  });
});

/* -------------------------------------------------------------------------- */
/*  5-7. APPROVAL AND EXECUTION CANNOT BE BYPASSED, REPLAYED OR DUPLICATED    */
/* -------------------------------------------------------------------------- */

void describe("5. An action cannot bypass approval when required", () => {
  void test("verify, then claim, then execute -- in that order", () => {
    const orchestrator = code("lib/orchestration/orchestrator.ts");

    const verify = orchestrator.indexOf("verifyApproval(record");
    const claim = orchestrator.indexOf("await request.claimApproval(step.tool.id)");
    const execute = orchestrator.indexOf("await executeTool(");

    assert.ok(verify !== -1 && claim !== -1 && execute !== -1);
    assert.ok(verify < claim && claim < execute, "A high-risk step must be verified and claimed before it runs.");
  });

  void test("the whole plan waits unless every high-risk step already holds a grant", () => {
    /*
     * The loop used to mark an unapproved step awaiting_approval and
     * carry on: later steps ran, and a run that executed anything settled
     * as completed without ever requesting the approval. The gate now
     * closes before the execution loop, and returns.
     */
    const orchestrator = code("lib/orchestration/orchestrator.ts");

    const gate = orchestrator.indexOf("approvalGate(");
    const closed = orchestrator.indexOf("if (!gate.open) {");
    const budget = orchestrator.indexOf("checkBudget(");
    const execute = orchestrator.indexOf("await executeTool(");

    assert.ok(gate !== -1 && closed !== -1 && budget !== -1 && execute !== -1);
    assert.ok(gate < closed && closed < budget && budget < execute, "The approval gate must close before any step can run.");
    assert.match(orchestrator.slice(closed, budget), /advance\("awaiting_approval"\);[\s\S]*?return \{/, "A closed gate must return without executing.");
  });

  void test("the execution loop never passes over a step it did not run", () => {
    const orchestrator = code("lib/orchestration/orchestrator.ts");

    const loop = orchestrator.lastIndexOf("for (const step of validation.plan.steps)", orchestrator.indexOf("checkBudget("));
    const settle = orchestrator.indexOf("settleRun(");

    assert.ok(loop !== -1 && settle > loop);
    assert.ok(!/\bcontinue\b/.test(orchestrator.slice(loop, settle)), "A refused step must stop the run, not be skipped over.");
  });
});

void describe("6. An approval cannot be replayed", () => {
  const migration = read("supabase/migrations/20260905120000_syraven_agent_approvals.sql");

  void test("at most one live approval per action, enforced by the database", () => {
    assert.match(migration, /create unique index if not exists agent_approvals_live_unique_idx/);
    assert.match(migration, /where status in \('pending', 'approved'\)/);
  });

  void test("an approval is born pending and can never be deleted", () => {
    assert.match(migration, /with check \(\s*auth\.uid\(\) = requested_for_user_id\s*and status = 'pending'/);
    assert.ok(!/on public\.agent_approvals\s+for delete/i.test(migration));
  });

  void test("the approval record cannot be rewritten or outlive its TTL", () => {
    /*
     * The update policy let a pending or approved row be rewritten --
     * expires_at, tool_id, effect, scope -- and the insert let the client
     * pick expires_at: a self-issued standing grant. Replayed in order,
     * the migrations must end with column privileges limited to what
     * approvalStore writes, a bounded expiry, and decisions that only
     * move forward. Repository state only (see MIGRATION_APPROVAL_REQUIRED.md).
     */
    const sql = MIGRATIONS_SQL;

    const revoke = sql.lastIndexOf("revoke insert, update on table public.agent_approvals from authenticated;");
    assert.ok(revoke !== -1, "Table-wide insert/update on agent_approvals must be revoked.");

    const after = sql.slice(revoke);
    assert.match(after, /grant update \(status, decided_by_user_id, decided_at\)\s+on public\.agent_approvals to authenticated;/);
    assert.ok(!/grant insert \([^)]*\bcreated_at\b/.test(after), "created_at must stay the database's clock.");
    assert.ok(!/grant (?:insert|update)[^;(]*on (?:table )?public\.agent_approvals/.test(after), "No table-wide write may be re-granted.");
    assert.match(after, /add constraint agent_approvals_ttl_bounded\s+check \(expires_at <= created_at \+ interval '16 minutes'\)/);

    const update = lastPolicy(sql, "agent_approvals_update_own").split(/with check/)[1] ?? "";
    assert.match(update, /decided_by_user_id = auth\.uid\(\)/);
    assert.match(update, /status in \('approved', 'rejected', 'used'\)/, "A decision may not revert a row to pending or expired.");
  });

  void test("an approval request is recorded, or the person is told it was not", () => {
    /*
     * requestApprovals upserted against the columns of a PARTIAL unique
     * index -- a conflict target Postgres cannot infer without the index
     * predicate -- and discarded the result. The route then said "needs
     * your approval" with nothing to approve.
     */
    const store = code("lib/orchestration/approvalStore.ts");
    const request = store.slice(store.indexOf("export async function requestApprovals"), store.indexOf("export async function decideApproval"));

    assert.ok(!/\.upsert\(/.test(request), "An approval request must be a plain insert.");
    assert.match(request, /const \{ error \} = await session\.supabase\s*\.from\("agent_approvals"\)\s*\.insert\(row\)/);
    assert.match(request, /error\.code !== UNIQUE_VIOLATION/, "Only 'already requested' may be treated as success.");

    const route = code("app/api/agents/run/route.ts");
    assert.match(route, /const recorded = await requestApprovals\(/);
    assert.match(route, /if \(!recorded\) \{[\s\S]{0,400}?503/, "An unrecorded request must not read as awaiting approval.");
  });

  void test("spending a grant is a compare-and-set, not a blind update", () => {
    const store = code("lib/orchestration/approvalStore.ts");

    assert.ok(!/export async function consumeApproval/.test(store), "The consume-after-run path must stay gone.");
    assert.match(store, /\.update\(\{ status: "used" \}\)[\s\S]{0,300}?\.eq\("status", "approved"\)[\s\S]{0,120}?\.gt\("expires_at"/);
  });
});

void describe("7. Execution cannot be duplicated", () => {
  void test("terminal execution states accept no transition", () => {
    const execution = code("lib/orchestration/execution.ts");

    for (const terminal of ["completed", "failed", "cancelled", "expired"]) {
      assert.match(execution, new RegExp(`\\b${terminal}: \\[\\],`), `${terminal} must be terminal.`);
    }
  });

  void test("a durable job is completed only by the runner that holds its lease", () => {
    const queue = code("lib/autopilot/queue.ts");
    const complete = queue.slice(queue.indexOf("export async function completeJob"));

    assert.match(complete, /\.eq\("status", "running"\)/);
    assert.match(complete, /\.eq\("locked_by", runnerId\)/);
  });
});

/* -------------------------------------------------------------------------- */
/*  8. AUTOPILOT HAS NO EXECUTION MODEL OF ITS OWN                            */
/* -------------------------------------------------------------------------- */

void describe("8. Autopilot cannot create a parallel execution model", () => {
  const AUTOPILOT = sources("lib/autopilot", /\.ts$/);

  void test("autopilot never runs tools or models directly", () => {
    for (const file of AUTOPILOT) {
      assert.ok(
        !/executeTool\(|chatCompletion|embedText\(|\bfetch\(|lib\/orchestration\/tools/.test(code(file)),
        `${file} reaches an executor directly; it must go through the orchestrator.`,
      );
    }
  });

  void test("autopilot declares no state machine of its own", () => {
    for (const file of AUTOPILOT) {
      assert.ok(!/\bTRANSITIONS\b|\bcanTransition\(/.test(code(file)), `${file} defines its own transitions.`);
    }
  });

  void test("one module owns the jobs table", () => {
    assert.deepEqual(filesMatching(APP_AND_LIB, /\.from\("jobs"\)/), ["lib/autopilot/queue.ts"]);
  });

  void test("no in-memory scheduler stands in for durability", () => {
    for (const file of AUTOPILOT) {
      assert.ok(!/setInterval\(|new Map<[^>]*Job/.test(code(file)), `${file} keeps job state in memory.`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  9-11. BRAIN, SEARCH AND GRAPH STAY INSIDE THE CALLER'S TENANT             */
/* -------------------------------------------------------------------------- */

void describe("9-11. Brain, Search and Graph respect authorization", () => {
  const SERVICE_ROLE = /supabaseAdmin|service_role|SERVICE_ROLE/;

  void test("Brain and Search modules never use the service role", () => {
    for (const file of [...sources("lib/search", /\.ts$/), ...sources("app/api/knowledge", /route\.ts$/), "app/api/search/route.ts"]) {
      assert.ok(!SERVICE_ROLE.test(code(file)), `${file} bypasses RLS.`);
    }
  });

  void test("every Brain and Search route is authenticated", () => {
    for (const file of [...sources("app/api/knowledge", /route\.ts$/), "app/api/search/route.ts", "app/api/activity/route.ts"]) {
      assert.match(code(file), /withAuth\(/, `${file} is not behind withAuth.`);
    }
  });

  void test("the Graph reads only authenticated APIs and holds no database client", () => {
    for (const file of sources("app/graph", /\.tsx?$/)) {
      const source = code(file);

      assert.ok(!/@supabase\/|lib\/supabase|SERVICE_ROLE/.test(source), `${file} talks to the database directly.`);

      for (const [, path] of source.matchAll(/fetch\("(\/[^"?]+)/g)) {
        assert.ok(path?.startsWith("/api/"), `${file} fetches ${path}, which is not an API route.`);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  12. BILLING ENTITLEMENT IS SERVER-AUTHORITATIVE                           */
/* -------------------------------------------------------------------------- */

void describe("12. Billing entitlements are server-authoritative", () => {
  void test("only the verified webhook writes a plan", () => {
    const writers = APP_AND_LIB.filter((file) =>
      /\.from\("profiles"\)\s*\.(?:update|upsert|insert)\(/.test(code(file)),
    );

    assert.deepEqual(writers, ["app/api/billing/webhook/route.ts"]);
    assert.match(code("app/api/billing/webhook/route.ts"), /constructEvent\(/, "The webhook must verify Stripe's signature.");
  });

  void test("the entitlement is read from the database, never the request", () => {
    const entitlements = code("lib/usage/entitlements.ts");

    assert.match(entitlements, /\.from\("profiles"\)/);
    assert.ok(!/\brequest\b|\bbody\b/.test(entitlements), "Entitlement resolution must not see the request.");
  });

  void test("the database gives the client no write path to billing state", () => {
    /*
     * The code-level check above held while the database did not:
     * 20260904122000's profiles_update_own policy plus 20260906120000's
     * blanket grant let a signed-in user PATCH their own plan through
     * PostgREST, around every route. Replayed in order, the migrations
     * must end with that path closed.
     *
     * This checks the REPOSITORY. Whether production has the lockdown
     * (20260913120000) applied is recorded in MIGRATION_APPROVAL_REQUIRED.md.
     */
    const sql = sources("supabase/migrations", /\.sql$/)
      .map((file) => read(file).replace(/--.*$/gm, ""))
      .join("\n");

    const lastCreate = sql.lastIndexOf('create policy "profiles_update_own"');
    const lastDrop = sql.lastIndexOf('drop policy if exists "profiles_update_own" on public.profiles;');

    assert.ok(lastDrop > lastCreate, "profiles_update_own must end dropped.");

    const grants = [...sql.matchAll(/grant [^;]*\bupdate\b[^;]*\bon (?:all tables in schema public|table public\.profiles|public\.profiles)\b[^;]*\bto\b[^;]*\bauthenticated\b[^;]*;/g)];
    const lastGrant = grants.at(-1)?.index ?? -1;
    const revoke = sql.lastIndexOf("revoke insert, update, delete on table public.profiles from authenticated;");

    assert.ok(revoke > lastGrant, "Client write privileges on profiles must end revoked.");

    const reopened = /create policy "[^"]+"\s+on public\.profiles\s+for (?:insert|update|delete|all)\b/i;
    assert.ok(!reopened.test(sql.slice(revoke)), "No policy may reopen a client write to profiles.");
  });
});

/* -------------------------------------------------------------------------- */
/*  13. CONNECTOR ACTIONS USE CONTROLLED EXECUTION                            */
/* -------------------------------------------------------------------------- */

void describe("13. Connector actions use controlled execution", () => {
  void test("the connector layer declares capability and calls nothing", () => {
    for (const file of sources("lib/integrations", /\.ts$/)) {
      assert.ok(!/\bfetch\(|access_token|refresh_token|client_secret/.test(code(file)), `${file} reaches a provider directly.`);
    }
  });

  void test("connector availability gates the one executor", () => {
    assert.match(code("lib/orchestration/tools.ts"), /resolveAvailability\(capabilityId, connection\)/);
  });

  void test("no OAuth or connect route exists yet", () => {
    /*
     * OAuth needs credentials and founder approval (North Star §17). Until
     * then there must be no route that could half-complete a connection.
     */
    const oauth = ROUTES.filter((file) => /\/(oauth|connect|callback)\//i.test(file));
    assert.deepEqual(oauth, []);
  });
});

/* -------------------------------------------------------------------------- */
/*  14. DURABLE WORK OUTLIVES THE REQUEST                                      */
/* -------------------------------------------------------------------------- */

void describe("14. Durable jobs survive request and browser lifetime", () => {
  void test("the queue is a database table with a lease, claimed by compare-and-set", () => {
    const queue = code("lib/autopilot/queue.ts");

    assert.match(queue, /export const LEASE_MS = /);
    assert.match(queue, /\.is\("locked_at", null\)|\.eq\("locked_at", candidate\.locked_at\)/);
  });

  void test(
    "a scheduler drives the queue",
    { todo: "BLOCKED: no scheduler or cron is configured and lib/autopilot/queue.ts has no caller; the lease policy migration 20260910120000 is unapplied" },
    () => {
      assert.ok(filesMatching(APP_AND_LIB, /from\s+["']@\/lib\/autopilot\/queue["']/).length > 0);
    },
  );
});

/* -------------------------------------------------------------------------- */
/*  15. SUCCESSFUL EXECUTION IS NOT A VERIFIED OUTCOME                         */
/* -------------------------------------------------------------------------- */

void describe("15. Success is not assumed", () => {
  void test("a step is completed only when its executor reported success", () => {
    assert.match(code("lib/orchestration/orchestrator.ts"), /status: outcome\.ok \? "completed" : "failed"/);
  });

  void test("a run reaches completed only through the settlement rule", () => {
    /*
     * Three settle branches each reported undone work as completed once:
     * a refused claim, a budget stop, and a step left awaiting approval.
     * The rule now lives in settleRun (behaviour: run-settlement.test.ts),
     * and no other path may walk a run to completed.
     */
    const orchestrator = code("lib/orchestration/orchestrator.ts");

    assert.match(orchestrator, /const settlement = settleRun\(results\.map\(/);
    assert.match(orchestrator, /advance\(settlement\.state\)/);
    assert.ok(!/advance\("completed"\)/.test(orchestrator), "Only the settlement may complete a run.");
  });

  void test("an AI route never presents a template as a generation", () => {
    /*
     * /api/canvas answered success: true with a template built from the
     * caller's own text when no key was configured, and again when the
     * model returned nothing (unmetered). A missing capability is a 503.
     */
    const canvas = code("app/api/canvas/route.ts");

    assert.ok(!/source:\s*"fallback"|createFallbackCanvas/.test(canvas), "A canvas no model wrote must not be returned as one.");
    assert.match(canvas, /status:\s*503/);
  });

  void test("the studio hub claims only what this deployment can do", () => {
    /*
     * The hub marked every tool "Ready" -- including three whose pages
     * render CapabilityUnavailable -- and listed four hardcoded titles,
     * dated "Today"/"Yesterday", as the user's recent work.
     */
    const hub = code("app/studio/page.tsx");
    const start = hub.indexOf("const studioTools");
    const tools = hub.slice(start, hub.indexOf("];", start));
    const entries = [...tools.matchAll(/id: "(\w+)",[\s\S]*?status: "(\w+)"/g)];

    assert.ok(entries.length >= 4, "The studio tool list moved; re-point this check.");

    for (const [, id = "", status] of entries) {
      if (status !== "Ready") continue;
      assert.ok(!/CapabilityUnavailable/.test(code("app", "studio", id, "page.tsx")), `${id} is marked Ready but its page says it is unavailable.`);
    }

    assert.ok(!/recentProjects|createdAt: "(?:Today|Yesterday)"/.test(hub), "The hub must not present sample work as the user's.");
  });

  void test("every write a tool makes returns the row the database stored", () => {
    /*
     * The authoritative source confirms the write -- not an HTTP 200, not
     * the model's claim. An insert without a returning select would report
     * an effect nobody read back.
     */
    const tools = code("lib/orchestration/tools.ts");
    const writes = [...tools.matchAll(/\.(insert|update|upsert)\(/g)];

    for (const write of writes) {
      const after = tools.slice(write.index ?? 0, (write.index ?? 0) + 400);
      assert.match(after, /\.select\(/, `A tool ${write[1]} does not read back what it wrote.`);
    }
  });

  void test(
    "business outcomes are recorded separately from action results",
    { todo: "PLANNED: no outcome store exists; a run reports step results only (North Star §5.12)" },
    () => {
      assert.ok(existsSync(join(ROOT, "lib", "outcomes")));
    },
  );
});

/* -------------------------------------------------------------------------- */
/*  DEFERRED BOUNDARIES -- each needs a migration or a later phase             */
/* -------------------------------------------------------------------------- */

/*
 * Recorded as `todo` so every run reports them: a green suite must never
 * imply these hold. Each reason names what closes it.
 */
void describe("Deferred boundaries (not closed in Phase 1)", () => {
  void test(
    "job creation is server-only",
    { todo: "MIGRATION: `jobs` INSERT is open to authenticated with client-chosen priority/status/payload, and claimNextJob claims across tenants by priority; revoke insert from authenticated + drop \"users can create own jobs\" before any runner ships" },
    () => {
      assert.ok(/revoke insert on (?:table )?public\.jobs from authenticated/.test(MIGRATIONS_SQL));
    },
  );

  void test(
    "an organization admin cannot take ownership or grant the owner role",
    { todo: "MIGRATION: organizations UPDATE lets an admin set owner_id; organization_members ALL lets an admin set role = 'owner'" },
    () => {
      assert.ok(false);
    },
  );

  void test(
    "api_keys, ai_budgets and ai_agent_executions accept no client write",
    { todo: "MIGRATION: owner-scoped ALL/INSERT/UPDATE policies accept un-revoked keys, self-set budgets, forged cost records; latent while nothing reads them (guarded above)" },
    () => {
      assert.ok(false);
    },
  );

  void test(
    "an approval binds the exact arguments of the step it authorizes",
    { todo: "ACTION ENGINE: approvals bind tool + goal + scope; the post-approval re-run re-plans. Needs a persisted plan/action record (migration). Latent: no high-risk tool has an executor" },
    () => {
      assert.ok(false);
    },
  );

  void test(
    "concurrent identical requests cannot both run a low/medium-risk step",
    { todo: "ACTION ENGINE (I-7): the execution key is a key, not a lock; needs a persisted run record (migration). An in-memory lock would not hold across serverless instances" },
    () => {
      assert.ok(false);
    },
  );
});

/* -------------------------------------------------------------------------- */
/*  16. MEMORY IS NOT AN UNCONTROLLED STORE OF MODEL OUTPUT                    */
/* -------------------------------------------------------------------------- */

void describe("16. Memory does not persist unverified model output", () => {
  void test("nothing writes to the memory tables", () => {
    /*
     * Memory is downstream of verified outcomes (North Star §5.13). Until
     * that path exists, no code path may write model output into memory.
     */
    const writers = APP_AND_LIB.filter((file) =>
      /\.from\("(?:ai_memories|memories|ai_memory_relations)"\)\s*\.(?:insert|upsert|update)\(/.test(code(file)),
    );

    assert.deepEqual(writers, []);
  });
});
