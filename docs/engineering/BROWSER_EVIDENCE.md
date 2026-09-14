# SYRAVEN — Browser Evidence

A browser claim ("the page works", "the flow is fixed") needs evidence a
reviewer can check. The suite of record is Playwright Test; exploration
through MCP is investigation until a test reproduces it.

## What a journey's evidence contains

| Evidence | Source | Required for |
|---|---|---|
| Command, exit code, pass/fail/skip counts | Playwright Test output | every claim |
| Final state assertion | the test itself (row visible, teardown asserted) | anything that writes |
| Console errors / page errors / failed requests | `problems` fixture (`watchForProblems`) | every page visited |
| Trace (`trace.zip`) | `trace: "retain-on-failure"` | every failure |
| Screenshot | `screenshot: "only-on-failure"`, or `toHaveScreenshot` for approved pages | failures; visual QA |
| Accessibility snapshot | `toMatchAriaSnapshot` or MCP `browser_snapshot` | structure claims |
| Environment proof | build-target check + config guard passed | every authenticated run |

A **skip is not a pass** and a **todo is not a pass**: report both.

## Where artifacts live (all gitignored)

| Directory | Written by |
|---|---|
| `test-results/` | Playwright Test (traces, failure screenshots, error context) |
| `playwright-report/`, `blob-report/` | reporters, if enabled |
| `.playwright-mcp/` | Playwright MCP (screenshots, snapshots) |
| `playwright/.auth/`, `.auth/` | any saved storage state |

Only **visual baselines** for deliberately approved pages are committed
(`tests/e2e/__screenshots__/`, see `VISUAL_QA.md`).

## Sensitive content in artifacts

Traces and MCP sessions record **request headers and cookies**, including
Supabase auth cookies of the test account. Therefore:

- never commit, upload or paste a trace or storage-state file;
- in reports, cite the artifact path and **extracted facts** (status codes,
  timings, cookie *names* — never values);
- delete `test-results/` and `.playwright-mcp/` when no longer needed.

## Reporting format

```text
JOURNEY: <name>
COMMAND: <exact command>
RESULT:  <n> passed / <n> failed / <n> skipped (exit <code>)
ENV:     test project <ref>; build target check: passed
FAILURES: <test> — <one-line cause> — trace: <path>
TEARDOWN: <tagged rows remaining: 0>
```
