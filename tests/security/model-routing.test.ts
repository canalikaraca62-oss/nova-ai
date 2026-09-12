/**
 * SYRAVEN — routing proposes, it never authorises
 * tests/security/model-routing.test.ts
 *
 * SECURITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * lib/ai/routing.ts chooses which model to suggest for a piece of work.
 * A router that can also GRANT is a second path to a model the caller's
 * plan excludes -- the same class of hole the failover suite exists to
 * keep shut, arriving from a different direction.
 *
 * Four rules, none of which a type checker can see:
 *
 *   1. Every candidate goes through selectModel with the caller's real
 *      plan. Routing must not become a way around the entitlement the
 *      registry enforces.
 *
 *   2. A provider with no API key in this deployment is never
 *      recommended. GROQ_API_KEY is not configured here, so suggesting
 *      a Groq model would be a confident answer about a call that
 *      cannot be made.
 *
 *   3. A model whose context window cannot hold prompt plus completion
 *      is excluded, not merely ranked low. Sending it fails at the
 *      provider for a reason the caller cannot act on.
 *
 *   4. The recommended ModelDefinition comes back from selectModel, not
 *      from the router's own copy, so the two cannot drift.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/**
 * Source with comments stripped.
 *
 * This file's own header names selectModel, GROQ_API_KEY and the
 * context rule. Three guards in this codebase have already passed a
 * defect by matching their own explanation, and two of mine failed open
 * this same session.
 */
function executable(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("*"))
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const ROUTING = executable(
  readFileSync(join(ROOT, "lib", "ai", "routing.ts"), "utf8"),
);

const REGISTRY = executable(
  readFileSync(join(ROOT, "lib", "ai", "registry.ts"), "utf8"),
);

const ORCHESTRATOR = executable(
  readFileSync(
    join(ROOT, "lib", "orchestration", "orchestrator.ts"),
    "utf8",
  ),
);

/* -------------------------------------------------------------------------- */
/*                     ROUTING CANNOT OUTRANK THE PLAN                        */
/* -------------------------------------------------------------------------- */

void describe("Routing cannot grant what a plan excludes", () => {
  void test("every candidate is validated with selectModel", () => {
    assert.match(
      ROUTING,
      /selectModel\(\s*registryKey,\s*request\.capability,\s*request\.plan,?\s*\)/,
      "Candidates must go through the registry's entitlement check, or " +
        "routing becomes a side door to a model the caller's plan " +
        "excludes.",
    );
  });

  void test("the caller's real plan is a required input", () => {
    assert.match(
      ROUTING,
      /readonly plan: PlanId/,
      "Routing must take the caller's entitlement, never assume one.",
    );
  });

  void test("a rejected candidate is scored out, not ranked low", () => {
    assert.match(
      ROUTING,
      /rejected: selection\.reason[\s\S]{0,80}?continue;/,
      "A model the plan excludes must be removed from contention. " +
        "Ranking it low still leaves it selectable when nothing else " +
        "qualifies.",
    );
  });

  void test("only non-negative scores can be recommended", () => {
    assert.match(
      ROUTING,
      /find\(\(candidate\) => candidate\.score >= 0\)/,
      "Rejected candidates carry score -1. Picking the highest score " +
        "without this floor would recommend a refused model whenever " +
        "every candidate was refused.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                  AN UNREACHABLE PROVIDER IS NOT A CANDIDATE                */
/* -------------------------------------------------------------------------- */

void describe("Routing does not recommend what cannot be called", () => {
  void test("a provider without a key is excluded", () => {
    assert.match(
      ROUTING,
      /providerApiKey\(model\.provider\) === null/,
      "GROQ_API_KEY is not configured in this deployment. Recommending " +
        "a Groq model would be a confident suggestion for a call that " +
        "cannot be made.",
    );
  });

  void test("the exclusion happens before scoring", () => {
    const keyCheck = ROUTING.indexOf("providerApiKey(model.provider)");
    const scoring = ROUTING.indexOf("const score =");

    assert.ok(keyCheck > 0, "The key check must exist.");
    assert.ok(
      keyCheck < scoring,
      "An unconfigured provider must be dropped before it can win on " +
        "score.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                         CONTEXT IS A HARD LIMIT                            */
/* -------------------------------------------------------------------------- */

void describe("A model that cannot hold the request is excluded", () => {
  void test("prompt and completion are summed", () => {
    assert.match(
      ROUTING,
      /estimatedPromptTokens \?\? 0\) \+ \(request\.maxTokens \?\? 0/,
      "The context window holds prompt AND completion. Checking either " +
        "alone lets the other overflow it.",
    );
  });

  void test("exceeding the window rejects the candidate", () => {
    assert.match(
      ROUTING,
      /needed > model\.contextWindow[\s\S]{0,120}?rejected: "CONTEXT_TOO_SMALL"/,
      "A model too small for the request must be excluded, not ranked.",
    );
  });

  void test("contextWindow is a real registry field", () => {
    assert.match(
      REGISTRY,
      /readonly contextWindow: number;/,
      "Routing reads contextWindow from the registry. Without the field " +
        "the check silently compares against undefined.",
    );

    assert.match(
      REGISTRY,
      /contextWindow: 128_000/,
      "gpt-4o-mini's published context window must be recorded, or the " +
        "context check has nothing to test against.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    THE AUTHORITY RETURNS THE DEFINITION                    */
/* -------------------------------------------------------------------------- */

void describe("The recommendation comes from the registry", () => {
  void test("recommendModel re-resolves through selectModel", () => {
    assert.match(
      ROUTING,
      /const selection = selectModel\(\s*best\.registryKey,/,
      "The ModelDefinition handed back must come from the authority, " +
        "not from a copy held here, or the two drift.",
    );
  });

  void test("registry keys and model ids genuinely differ", () => {
    /*
     * Why every lookup above is by key. selectModel resolves a name by
     * its APPROVED_MODELS key; the vision entry is keyed
     * "gpt-4o-mini-vision" and sends id "gpt-4o-mini" -- the chat
     * entry's key. Asking the authority about model.id validated the
     * CHAT entry while routing a vision request, so the only vision
     * model was rejected as the wrong capability.
     */
    assert.match(
      REGISTRY,
      /"gpt-4o-mini-vision": \{\s*id: "gpt-4o-mini",/,
      "If no key differs from its id any more, the key-vs-id rule is " +
        "untested -- revisit these assertions deliberately.",
    );
  });

  void test("a failed re-resolution returns nothing", () => {
    assert.match(
      ROUTING,
      /if \(!selection\.ok\) return null;/,
      "If the authority refuses on the second pass, routing must return " +
        "nothing rather than fall back to its own candidate.",
    );
  });

  void test("routing does not define its own model list", () => {
    /*
     * The defect this prevents: a local table of models that drifts
     * from APPROVED_MODELS. A parallel 583-line model table was exactly
     * that -- it described models the registry could not call, such as
     * qwen3-32b and llama-4-scout. Its usable context figures were
     * moved into the registry and the table deleted.
     */
    assert.ok(
      ROUTING.includes("Object.entries(APPROVED_MODELS)"),
      "Candidates must be read from the registry, never redeclared.",
    );

    assert.ok(
      !/const\s+\w*MODELS\w*\s*[:=]\s*\[/.test(ROUTING),
      "Routing must not carry its own model array.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        ROUTING IS ACTUALLY CONSULTED                       */
/* -------------------------------------------------------------------------- */

void describe("The orchestrator routes rather than taking the default", () => {
  /*
   * Without these, routing is code nobody calls. This session deleted
   * roughly 40,000 lines of exactly that, including a 1,035-line agent
   * router with no importer -- a module can be correct, tested and
   * still be dead.
   */
  void test("recommendModel is imported", () => {
    assert.match(
      ORCHESTRATOR,
      /import \{ recommendModel \} from "@\/lib\/ai\/routing"/,
      "The orchestrator must consult routing, or routing is dead code.",
    );
  });

  void test("the recommendation feeds selectModel", () => {
    assert.match(
      ORCHESTRATOR,
      /routed\?\.registryKey \?\? null/,
      "The routed model must be what selectModel is asked to authorise. " +
        "Calling recommendModel and discarding its answer would leave " +
        "the orchestrator on the registry default.",
    );
  });

  void test("the caller's real plan reaches routing", () => {
    assert.match(
      ORCHESTRATOR,
      /recommendModel\(\{[\s\S]{0,200}?plan: request\.entitlement\.effectivePlan/,
      "Routing must receive the plan resolved from the database, never " +
        "a default, or it can propose a model the caller cannot have.",
    );
  });

  void test("selectModel remains the authority after routing", () => {
    /*
     * The ordering that matters: recommendModel proposes, then
     * selectModel decides. Reversing them, or dropping the second call,
     * would make routing an authorisation path.
     */
    const routeAt = ORCHESTRATOR.indexOf("recommendModel({");
    const selectAt = ORCHESTRATOR.indexOf("const model = selectModel(");

    assert.ok(routeAt > 0, "recommendModel must be called.");
    assert.ok(selectAt > 0, "selectModel must still be called.");
    assert.ok(
      routeAt < selectAt,
      "Routing proposes BEFORE the registry authorises. Routing must " +
        "never be the last word on which model is used.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      HONESTY ABOUT WHAT IS MEASURED                        */
/* -------------------------------------------------------------------------- */

void describe("Routing does not claim signals it cannot measure", () => {
  void test("no reliability or latency score is computed", () => {
    /*
     * `usage` records model and tokens, but neither duration nor
     * failure kind. A success rate or latency estimate here would be
     * invented, which is the defect class this repository's Rule 1
     * exists to prevent.
     */
    for (const invented of [
      "reliabilityScore",
      "successRate",
      "latencyMs",
      "averageLatency",
      "uptimePercent",
    ]) {
      assert.ok(
        !ROUTING.includes(invented),
        `${invented} cannot be computed: no request duration or failure ` +
          `kind is recorded anywhere in this deployment.`,
      );
    }
  });

  void test("no per-token price table is invented", () => {
    for (const invented of ["costPerToken", "pricePer1k", "inputPrice"]) {
      assert.ok(
        !ROUTING.includes(invented),
        `${invented} would be a fabricated figure: lib/billing/config.ts ` +
          `prices SYRAVEN credits, not provider spend.`,
      );
    }
  });
});
