/**
 * SYRAVEN — a second provider is not a second chance to escape the rules
 * tests/security/provider-failover.test.ts
 *
 * SECURITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * Two providers serve chat models here. When one is rate-limited or
 * unreachable, failover asks the other. That is a genuine reliability
 * win and it opens four ways to get something wrong, every one of
 * which is invisible to typecheck:
 *
 *   1. A free-tier caller whose primary fails is handed a model their
 *      plan does not include, because the fallback skipped the
 *      entitlement check that selectModel enforces.
 *
 *   2. Failover fires on INVALID_REQUEST, spending money at a second
 *      provider to be refused identically -- a malformed request is
 *      malformed everywhere.
 *
 *   3. The fallback inherits the primary's token budget.
 *      gpt-4o-mini allows 16k; llama-3.1-8b-instant allows 8k. Carrying
 *      the ceiling across sends an over-limit request that fails for a
 *      brand new reason.
 *
 *   4. The result names the model originally selected rather than the
 *      one that answered. modelId flows into usage metering, so that is
 *      a billing record for work a provider never did.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/**
 * Source with comments stripped.
 *
 * This file's own header names INVALID_REQUEST, the token ceilings and
 * the plan check. Three guards in this codebase have already passed a
 * defect by matching their own explanation.
 */
function executable(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("*"))
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const FAILOVER = executable(
  readFileSync(join(ROOT, "lib", "ai", "failover.ts"), "utf8"),
);

const ORCHESTRATOR = executable(
  readFileSync(
    join(ROOT, "lib", "orchestration", "orchestrator.ts"),
    "utf8",
  ),
);

/* -------------------------------------------------------------------------- */
/*                       THE PLAN CHECK IS NOT BYPASSED                       */
/* -------------------------------------------------------------------------- */

void describe("Failover cannot outrank the caller's plan", () => {
  void test("every candidate is re-validated with selectModel", () => {
    assert.match(
      FAILOVER,
      /selectModel\(model\.id, capability, plan\)/,
      "Candidates must go through the same entitlement check as the " +
        "primary, or a failing primary becomes a way to reach a model " +
        "the caller's plan excludes.",
    );
  });

  void test("the caller's real plan is a required input", () => {
    assert.match(
      FAILOVER,
      /plan:\s*PlanId/,
      "Failover must take the caller's entitlement, not assume one.",
    );
  });

  void test("the orchestrator passes the entitlement through", () => {
    assert.match(
      ORCHESTRATOR,
      /plan:\s*request\.entitlement\.effectivePlan/,
      "The orchestrator must hand failover the plan resolved from the " +
        "database, never a default.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    ONLY THE PROVIDER'S FAULTS FAIL OVER                    */
/* -------------------------------------------------------------------------- */

void describe("A caller's bad request is not retried elsewhere", () => {
  void test("the failover-worthy set is explicit", () => {
    for (const kind of [
      "RATE_LIMITED",
      "TIMEOUT",
      "PROVIDER_ERROR",
      "AUTHENTICATION",
      "NOT_CONFIGURED",
    ]) {
      assert.ok(
        FAILOVER.includes(`"${kind}"`),
        `${kind} is a provider-side failure and should be worth a ` +
          `second opinion.`,
      );
    }
  });

  void test("INVALID_REQUEST and EMPTY_RESPONSE are excluded", () => {
    const set =
      /const FAILOVER_WORTHY[\s\S]*?\]\);/.exec(FAILOVER)?.[0] ?? "";

    assert.ok(
      set.length > 0,
      "The failover-worthy set is gone; every error would now fail " +
        "over, including the ones a second provider will refuse too.",
    );

    for (const kind of ["INVALID_REQUEST", "EMPTY_RESPONSE"]) {
      assert.ok(
        !set.includes(kind),
        `${kind} must not fail over. A malformed request is malformed ` +
          `at every provider, and an empty response is an answer.`,
      );
    }
  });

  void test("a non-worthy error stops the loop", () => {
    assert.match(
      FAILOVER,
      /if \(!isFailoverWorthy\(result\.error\)\) \{[\s\S]{0,200}?break;/,
      "Without the break, a refused request walks the whole candidate " +
        "list and pays for each refusal.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                     THE FALLBACK IS A DIFFERENT PROVIDER                   */
/* -------------------------------------------------------------------------- */

void describe("Failover crosses providers and respects ceilings", () => {
  void test("same-provider alternatives are excluded", () => {
    /*
     * If OpenAI is rate-limiting or unreachable, a second OpenAI model
     * is the same outage. Only a different provider is failover.
     */
    assert.match(
      FAILOVER,
      /model\.provider !== primary\.provider/,
      "A candidate on the same provider is not a fallback.",
    );
  });

  void test("maxTokens is re-clamped per candidate", () => {
    assert.match(
      FAILOVER,
      /Math\.min\(input\.maxTokens, candidate\.maxOutputTokens\)/,
      "gpt-4o-mini allows 16k and llama-3.1-8b-instant allows 8k. " +
        "Carrying the primary's budget across sends an over-limit " +
        "request.",
    );
  });

  void test("an unconfigured provider is skipped without a call", () => {
    assert.match(
      FAILOVER,
      /providerApiKey\(candidate\.provider\) === null/,
      "A provider with no key must be skipped before the network " +
        "call, not discovered by failing one.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                   THE RECORD NAMES THE MODEL THAT ANSWERED                 */
/* -------------------------------------------------------------------------- */

void describe("Usage is attributed to the provider that served it", () => {
  void test("the success result carries the answering model", () => {
    /*
     * chatCompletion returns modelId for the candidate it called, and
     * spreading the result preserves it. Overwriting it with the
     * originally selected model would bill a provider for work another
     * one did.
     */
    assert.match(
      FAILOVER,
      /return \{ \.\.\.result, attempts \}/,
      "The result must keep the answering model's id.",
    );
  });

  void test("the orchestrator reports the model that actually failed", () => {
    assert.match(
      ORCHESTRATOR,
      /completion\.attempts\.at\(-1\)\?\.modelId/,
      "On failure the orchestrator must name the last candidate " +
        "tried, not the primary that may never have been reached.",
    );
  });

  void test("attempts are recorded for every candidate tried", () => {
    const pushes = FAILOVER.match(/attempts\.push\(\{/g) ?? [];

    assert.ok(
      pushes.length >= 2,
      `Only ${pushes.length} attempt record(s). Both the skipped-key ` +
        `path and the failed-call path must be visible, or a silent ` +
        `failover looks like a first-try success.`,
    );
  });
});
