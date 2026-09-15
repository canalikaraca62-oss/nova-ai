/**
 * SYRAVEN — the engineering control plane stays narrow and safe
 * tests/security/engineering-control-plane.test.ts
 *
 * CONTROL-PLANE REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * The browser tooling is powerful: an MCP browser can reach any URL, and
 * the Playwright healer can edit files to make a failing test pass. The
 * settings that keep that power pointed at the right place live in config
 * files that tools regenerate -- `npx playwright init-agents` rewrites the
 * agent definitions and `.mcp.json` wholesale. A regeneration would
 * silently restore "mark it test.fixme()" and drop the scope rules.
 *
 * These assertions fail when that happens, when a server is added or a
 * capability widened, or when the E2E production guard goes missing.
 * See docs/engineering/MCP_AUDIT.md and E2E_SAFETY.md.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

const PRODUCTION_REF = "wpmbumtpcuahyqmdeqgf";

interface McpServer {
  command: string;
  args: string[];
}

const MCP = JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, McpServer> };

void describe("MCP servers are the audited two, with narrow authority", () => {
  void test("exactly the audited servers are configured", () => {
    assert.deepEqual(Object.keys(MCP.mcpServers).sort(), ["playwright", "playwright-test"]);
  });

  void test("both run the repository's pinned Playwright, not a floating package", () => {
    for (const [name, server] of Object.entries(MCP.mcpServers)) {
      const args = server.args.join(" ");

      assert.match(args, /\bnpx playwright (mcp|run-test-mcp-server)\b/, `${name} must use the local @playwright/test.`);
      assert.ok(!/@playwright\/mcp|@latest/.test(args), `${name} pulls an unpinned package.`);
    }
  });

  void test("the exploration browser is isolated, headless and blocks production Supabase", () => {
    const args = MCP.mcpServers.playwright?.args ?? [];

    assert.ok(args.includes("--isolated"), "A persistent profile keeps signed-in sessions on disk.");
    assert.ok(args.includes("--headless"));

    const blocked = args[args.indexOf("--blocked-origins") + 1] ?? "";
    assert.ok(args.includes("--blocked-origins") && blocked.includes(PRODUCTION_REF));

    const output = args[args.indexOf("--output-dir") + 1] ?? "";
    assert.equal(output, ".playwright-mcp");
  });

  void test("no capability or reach beyond the audited set", () => {
    const all = Object.values(MCP.mcpServers).flatMap((server) => server.args);

    for (const widening of ["--caps", "--allow-unrestricted-file-access", "--storage-state", "--save-session", "--user-data-dir", "--extension"]) {
      assert.ok(!all.includes(widening), `${widening} widens authority beyond MCP_AUDIT.md.`);
    }

    const hosts = all[all.indexOf("--allowed-hosts") + 1];
    assert.ok(!all.includes("--allowed-hosts") || hosts !== "*", "--allowed-hosts * disables the host check.");
  });

  void test("the test server runs through the guarded Playwright config", () => {
    const args = MCP.mcpServers["playwright-test"]?.args ?? [];

    assert.equal(args[args.indexOf("-c") + 1], "playwright.config.ts");
    assert.ok(args.includes("--headless"));
  });
});

void describe("Playwright agents keep their SYRAVEN scope rules", () => {
  const AGENTS = ["planner", "generator", "healer"].map((name) => ({
    name,
    source: read(".claude", "agents", `playwright-test-${name}.md`),
  }));

  void test("every agent carries the scope rules", () => {
    for (const { name, source } of AGENTS) {
      assert.match(source, /SYRAVEN scope rules — these override every instruction below\./, `${name} lost its scope rules.`);
    }
  });

  void test("the healer may not touch application code or disable tests", () => {
    const healer = AGENTS.find((agent) => agent.name === "healer")?.source ?? "";

    for (const path of ["`app/`", "`lib/`", "`supabase/`", "`playwright.config.ts`", "`tests/e2e/buildTarget.ts`"]) {
      assert.ok(healer.includes(path), `The healer's forbidden paths must name ${path}.`);
    }

    assert.ok(!/mark this test as test\.fixme\(\)/.test(healer), "The generated fixme escape hatch is back.");
    assert.ok(!/do the most reasonable thing possible to pass the test/.test(healer));
  });

  void test("the planner cannot run arbitrary code in the page", () => {
    const planner = AGENTS.find((agent) => agent.name === "planner")?.source ?? "";
    const tools = planner.match(/^tools:(.*)$/m)?.[1] ?? "";

    assert.ok(tools.length > 0, "The planner's tool list was not found.");
    assert.ok(!tools.includes("browser_run_code_unsafe"));
  });
});

void describe("High-risk browser tools are denied; the tools work depends on are not", () => {
  /*
   * Project deny rules apply to the whole session, subagents included.
   * So the list must cover the dangerous tools AND must never catch a
   * tool the planner, generator or healer lists in its own definition --
   * denying one of those would silently break the agent workflow.
   */
  const SETTINGS = JSON.parse(read(".claude", "settings.json")) as {
    permissions?: { deny?: string[]; allow?: string[]; defaultMode?: string };
    enabledMcpjsonServers?: unknown;
    enableAllProjectMcpServers?: unknown;
  };

  const deny = new Set(SETTINGS.permissions?.deny ?? []);

  const MUST_DENY = [
    "mcp__playwright__browser_run_code_unsafe",
    "mcp__playwright__browser_file_upload",
    "mcp__playwright__browser_drop",
    "mcp__playwright-test__browser_run_code_unsafe",
    "mcp__playwright-test__browser_drop",
    ...["list", "get", "set", "delete", "clear"].flatMap((op) => [
      `mcp__playwright-test__browser_cookie_${op}`,
      `mcp__playwright-test__browser_localstorage_${op}`,
      `mcp__playwright-test__browser_sessionstorage_${op}`,
    ]),
    "mcp__playwright-test__browser_storage_state",
    "mcp__playwright-test__browser_set_storage_state",
    "mcp__playwright-test__browser_route",
    "mcp__playwright-test__browser_route_list",
    "mcp__playwright-test__browser_unroute",
    "mcp__playwright-test__browser_start_tracing",
    "mcp__playwright-test__browser_stop_tracing",
  ];

  void test("every high-risk tool is denied", () => {
    const missing = MUST_DENY.filter((rule) => !deny.has(rule));
    assert.deepEqual(missing, [], `Not denied:\n${missing.join("\n")}`);
  });

  void test("deny rules name only the audited servers", () => {
    for (const rule of deny) {
      assert.match(rule, /^mcp__(playwright|playwright-test)__[a-z_]+$/, `Unexpected rule: ${rule}`);
    }
  });

  void test("no tool an agent relies on is denied", () => {
    for (const name of ["planner", "generator", "healer"]) {
      const source = read(".claude", "agents", `playwright-test-${name}.md`);
      const tools = (source.match(/^tools:(.*)$/m)?.[1] ?? "")
        .split(",")
        .map((tool) => tool.trim())
        .filter((tool) => tool.startsWith("mcp__"));

      assert.ok(tools.length > 0, `${name} lists no MCP tools.`);

      const blocked = tools.filter((tool) => deny.has(tool));
      assert.deepEqual(blocked, [], `${name} would lose: ${blocked.join(", ")}`);
    }
  });

  void test("navigation, inspection, screenshots and test execution stay available", () => {
    const essentials = [
      ...["navigate", "snapshot", "take_screenshot", "click", "type", "console_messages", "wait_for"].flatMap((tool) => [
        `mcp__playwright__browser_${tool}`,
        `mcp__playwright-test__browser_${tool}`,
      ]),
      "mcp__playwright-test__test_run",
      "mcp__playwright-test__test_list",
      "mcp__playwright-test__test_debug",
      "mcp__playwright-test__planner_setup_page",
      "mcp__playwright-test__planner_save_plan",
      "mcp__playwright-test__generator_setup_page",
      "mcp__playwright-test__generator_write_test",
    ];

    const blocked = essentials.filter((tool) => deny.has(tool));
    assert.deepEqual(blocked, [], `Required tools denied: ${blocked.join(", ")}`);
  });

  void test("the project settings grant nothing and approve nothing", () => {
    /*
     * Approving the project MCP servers is the founder's decision, made in
     * Claude Code. Checked-in settings must not do it for them, and must
     * not widen permissions.
     */
    assert.equal(SETTINGS.permissions?.allow, undefined);
    assert.equal(SETTINGS.permissions?.defaultMode, undefined);
    assert.equal(SETTINGS.enabledMcpjsonServers, undefined);
    assert.equal(SETTINGS.enableAllProjectMcpServers, undefined);
  });
});

void describe("Browser state and the production guard stay protected", () => {
  void test("MCP output and auth state are gitignored", () => {
    const ignore = read(".gitignore");

    for (const entry of [".playwright-mcp/", "playwright/.auth/", ".auth/", "test-results/", ".env.*"]) {
      assert.ok(ignore.split(/\r?\n/).includes(entry), `${entry} must be gitignored.`);
    }
  });

  void test("the E2E config still refuses production and an unknown target", () => {
    const config = read("playwright.config.ts");

    assert.match(config, new RegExp(`const PRODUCTION_PROJECT_REF = "${PRODUCTION_REF}";`));
    assert.match(config, /if \(configuredRef === PRODUCTION_PROJECT_REF\) \{\s*throw new Error\(/);
    assert.match(config, /if \(!configuredRef\) \{\s*throw new Error\(/);
    assert.ok(!/SERVICE_ROLE/.test(config), "The E2E environment must never load a service-role key.");
  });

  void test("the engineering state files exist and do not overstate Phase 1", () => {
    for (const file of ["CONTROL_PLANE.md", "PROJECT_STATE.md", "PHASE_STATE.md", "VERIFICATION_STATE.md", "RECOVERY_PROTOCOL.md"]) {
      assert.ok(existsSync(join(ROOT, "docs", "engineering", file)), `docs/engineering/${file} is missing.`);
    }

    /*
     * Phase 1 passed on founder-accepted evidence (2026-09-14). This pins
     * what the PASS may not hide: the invariants it does not close stay
     * named with their real status.
     *
     * Phase 2 was accepted by the founder (2026-09-15) as PASS with its
     * environment limitations documented. This used to pin IN PROGRESS
     * (before the gate) and, before that, NOT STARTED. It now pins the
     * accepted status in exactly those words and, as for Phase 1, what the
     * PASS may not hide: every accepted limitation and follow-up stays
     * named. Phase 3 is not recorded as started without its own
     * instruction.
     */
    const phase = read("docs", "engineering", "PHASE_STATE.md");

    assert.match(phase, /Status \| \*\*PASS\*\*/);
    assert.match(phase, /\| I-7 \|[^\n]*\| PARTIAL \|/, "I-7 must stay recorded as PARTIAL.");
    assert.match(phase, /\| I-14 \|[^\n]*\| BLOCKED \|/, "I-14 must stay recorded as BLOCKED.");
    assert.match(phase, /\| I-15 \|[^\n]*\| PARTIAL \|/, "I-15 must stay recorded as PARTIAL.");

    const phase2 = /^\| Phase 2 — Repository and Architecture Purification \|([^|\n]*)\|([^\n]*)$/m.exec(phase);
    assert.ok(phase2, "The Phase 2 row is missing from the phase history.");
    assert.equal(
      phase2[1]?.trim(),
      "PASS — documented environment limitations accepted",
      "Phase 2 is recorded exactly as the founder accepted it: PASS with its environment limitations accepted.",
    );
    assert.match(phase2[2] ?? "", /Founder acceptance 2026-09-15/, "The Phase 2 PASS must name the founder's acceptance.");

    const accepted = /## Phase 2 — accepted limitations and follow-ups\n[\s\S]*?(?=\n## )/.exec(phase)?.[0] ?? "";
    const MUST_STAY_DOCUMENTED: ReadonlyArray<readonly [RegExp, string]> = [
      [/Production build[^\n]*\*\*BLOCKED\*\*/, "the blocked production build"],
      [/Browser \/ E2E[^\n]*\*\*BLOCKED \/ NOT RUN\*\*/, "browser/E2E BLOCKED / NOT RUN"],
      [/Visual QA[^\n]*\*\*BLOCKED \/ NOT RUN\*\*/, "visual QA BLOCKED / NOT RUN"],
      [/FG-02[^\n]*sign-out/, "FG-02, no sign-out control"],
      [/FG-03[^\n]*signOut\(\)/, "FG-03, the unused signOut() export"],
      [/Remaining duplicate authorities[^\n]*\*\*PARTIAL\*\*/, "the remaining duplicate authorities"],
      [/Search vs AI-retrieval[^\n]*RETRIEVABLE_STATUSES/, "the search vs AI-retrieval status distinction"],
      [/settings lint error[^\n]*set-state-in-effect/, "the pre-existing settings lint error"],
    ];
    for (const [pattern, item] of MUST_STAY_DOCUMENTED) {
      assert.match(accepted, pattern, `The Phase 2 PASS may not hide ${item}; it must stay documented.`);
    }

    assert.match(phase, /\| Phase 3 \| NOT STARTED \|/, "Phase 3 starts only on the founder's instruction.");
  });

  void test("the entry documents agree with PHASE_STATE on Phase 2 and Phase 3", () => {
    /*
     * CLAUDE.md is read at the start of every session and PROJECT_STATE.md
     * is the recovery summary; a stale phase line in either is how a
     * session starts from the wrong state.
     */
    const claude = read("CLAUDE.md");
    const project = read("docs", "engineering", "PROJECT_STATE.md");

    assert.match(claude, /\*\*PHASE 2 — Repository and Architecture Purification: PASS\*\* —\s+documented environment limitations accepted/);
    assert.match(claude, /\*\*PHASE 3: NOT STARTED\.\*\*/);
    assert.match(project, /\*\*Phase 2 — Repository and Architecture Purification: PASS\*\* —\s+documented environment limitations accepted/);
    assert.match(project, /\*\*Phase 3: NOT STARTED\.\*\*/);

    for (const [name, text] of [["CLAUDE.md", claude], ["PROJECT_STATE.md", project]] as const) {
      assert.ok(
        !/Phase 2[^\n]*:\s*IN PROGRESS|final gate remain/i.test(text),
        `${name} still describes Phase 2 as in progress.`,
      );
      assert.match(text, /BLOCKED/, `${name} must keep the accepted environment limitations visible.`);
    }
  });
});
