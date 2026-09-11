/**
 * SYRAVEN — the work graph draws only real relationships
 * tests/security/graph-edges-are-real.test.ts
 *
 * PRODUCT INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * A graph is the easiest surface in a product to fake. Nodes and lines
 * look meaningful whatever they are joined to, and a viewer has no way
 * to check. Scattering edges to make a picture look rich would be the
 * same defect as the eleven fabricated surfaces already removed from
 * this codebase, in a form that is harder to spot.
 *
 * So the rule is narrow: every edge must come from a foreign key that
 * exists in the schema, and both of its ends must be nodes the caller
 * actually received.
 *
 *   projects.workspace_id  ->  workspace contains project
 *   tasks.project_id       ->  project contains task
 *
 * Anything else — similarity, inferred relatedness, a random layout
 * seed presented as structure — is not permitted here.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8");
}

/**
 * Strips JSX comments and line comments, keeping block comments.
 *
 * Used for POSITIVE assertions — the ones that look for a code shape
 * that must be present. Prose cannot satisfy these, so leaving it in is
 * harmless and keeps the source close to what is on disk.
 */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/**
 * Strips ALL commentary, including bare block comments.
 *
 * Used for NEGATIVE assertions — the ones that forbid a substring.
 *
 * This distinction is the whole point. Both files explain at length why
 * ai_memory_relations is unused and why no edge is inferred, so a
 * forbidden-substring check against the commented source matches the
 * explanation and fails on a file that is correct. A previous guard in
 * this repo made the opposite mistake — it stripped the very evidence
 * it was policing and reported green over a broken build — so the fix
 * here is to narrow what each kind of assertion reads, never to blind
 * the guard wholesale.
 */
function executable(source: string): string {
  return code(source).replace(/\/\*[\s\S]*?\*\//g, "");
}

const PAGE = code(read("app", "graph", "page.tsx"));
const SCENE = code(read("app", "graph", "GraphScene.tsx"));

const PAGE_CODE = executable(read("app", "graph", "page.tsx"));
const SCENE_CODE = executable(read("app", "graph", "GraphScene.tsx"));

/* -------------------------------------------------------------------------- */
/*                              EDGES ARE REAL                                */
/* -------------------------------------------------------------------------- */

void describe("Every edge comes from a foreign key", () => {
  void test("edges are built from workspace_id and project_id only", () => {
    /*
     * The two real containment links. If a third edge source appears it
     * must be a real column too, and this test should be updated
     * deliberately rather than the rule quietly widened.
     */
    assert.match(
      PAGE,
      /project\.workspace_id/,
      "The workspace->project edge must come from projects.workspace_id.",
    );

    assert.match(
      PAGE,
      /task\.project_id/,
      "The project->task edge must come from tasks.project_id.",
    );
  });

  void test("an edge is dropped unless both ends exist", () => {
    /*
     * A project whose workspace the caller cannot see must not sprout a
     * line to nowhere. A dangling edge implies a relationship the user
     * has no way to verify.
     */
    assert.match(
      PAGE,
      /known\.has\(from\)\s*&&\s*known\.has\(to\)/,
      "Both endpoints must be present before an edge is drawn.",
    );
  });

  void test("no edge is invented from similarity or randomness", () => {
    for (const forbidden of [
      /Math\.random\s*\(/,
      /similarity/i,
      /relatedness/i,
      /inferred/i,
    ]) {
      assert.ok(
        !forbidden.test(PAGE_CODE),
        `The graph derives an edge from ${String(forbidden)}, which no ` +
          `column supplies.`,
      );
    }
  });

  void test("the unpopulated relation table is not read", () => {
    /*
     * public.ai_memory_relations carries typed relations and would make
     * a richer graph. It is RLS-protected and owner-scoped — an earlier
     * version of this comment claimed otherwise and was wrong.
     *
     * It stays unused because nothing in the product writes to it: no
     * API route, no service, no UI. The table holds zero rows, so any
     * edge drawn from it would be an edge the user cannot possibly
     * verify. Using it means building the producer first.
     */
    assert.ok(
      !/ai_memory_relations/.test(PAGE_CODE + SCENE_CODE),
      "ai_memory_relations has no writer and holds no rows; an edge " +
        "from it would be unverifiable.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        THE SPATIAL VIEW IS OPTIONAL                        */
/* -------------------------------------------------------------------------- */

void describe("The spatial view degrades rather than breaks", () => {
  void test("reduced motion skips WebGL entirely", () => {
    assert.match(
      SCENE,
      /prefers-reduced-motion/,
      "A request not to be moved must be honoured before anything " +
        "renders or loads.",
    );
  });

  void test("a missing WebGL context falls back", () => {
    assert.match(
      SCENE,
      /getContext\("webgl2"\)|getContext\("webgl"\)/,
      "The scene must probe for a context rather than assume one.",
    );
  });

  void test("three is imported dynamically", () => {
    /*
     * ~23 MB installed. A static import would put it in the bundle of
     * every page that shares a chunk, including devices that will never
     * render it.
     */
    assert.match(
      SCENE,
      /await import\("three"\)/,
      "three must be loaded on demand, not bundled eagerly.",
    );

    assert.ok(
      !/^import .* from "three"/m.test(SCENE),
      "A static three import defeats the dynamic loading.",
    );
  });

  void test("the relationships are readable without the scene", () => {
    /*
     * A picture of a graph is not navigable on a phone, and a spatial
     * view nobody can use is decoration. The structure is always
     * available as text, not only when WebGL is missing.
     */
    assert.match(
      PAGE,
      /Structure/,
      "The graph must also be listed, independently of the canvas.",
    );
  });

  void test("the scene owns no AI claim", () => {
    /*
     * The orbit conveys depth, not activity. Nothing in this picture is
     * AI state, and animating it as though it were would be the
     * fabricated-progress defect in a new costume.
     */
    for (const forbidden of ["thinking", "executing", "processing"]) {
      assert.ok(
        !SCENE_CODE.includes(`"${forbidden}"`),
        `The scene claims an AI state (${forbidden}) it has no source for.`,
      );
    }
  });
});
