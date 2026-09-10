/**
 * SYRAVEN — UI integrity tests
 *
 * Phase 12 (see IMPLEMENTATION_PLAN.md).
 *
 * The repository has no browser/E2E tooling, so these tests cannot
 * assert rendered pixels. What they CAN assert, without a browser, are
 * the two classes of defect the Phase 12 audit actually found:
 *
 *   DEAD LINKS — an href pointing at a route with no page.tsx. This is
 *   decidable from the filesystem: Next.js App Router maps a route
 *   segment to a directory, so a missing directory is a 404 with
 *   certainty, not a guess.
 *
 *   UNPAIRED BUTTON COLOURS — a button that sets a background without a
 *   text colour (or vice versa) inherits the other from an ancestor. On
 *   this application's dark surfaces that is how a payment button
 *   becomes black-on-black.
 *
 * Both are properties of the source that hold regardless of rendering,
 * which is why they are worth testing here. Contrast that actually
 * depends on the cascade is NOT asserted — it needs a browser, and is
 * recorded as a limitation in PRODUCTION_RELIABILITY.md rather than
 * faked with a source-text check.
 *
 * Run: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/* -------------------------------------------------------------------------- */
/*                              FILE DISCOVERY                                */
/* -------------------------------------------------------------------------- */

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;

  for (const entry of readdirSync(dir)) {
    /* Build output and dependencies are not source. */
    if (entry === "node_modules" || entry === ".next") continue;

    const full = join(dir, entry);

    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }

  return out;
}

const TSX_FILES = walk(join(ROOT, "app")).concat(walk(join(ROOT, "components")));

/* -------------------------------------------------------------------------- */
/*                              ROUTE RESOLUTION                              */
/* -------------------------------------------------------------------------- */

/**
 * Whether an internal path resolves to a real App Router page.
 *
 * Handles dynamic segments: `/projects/123` matches `app/projects/[id]`.
 * A path is resolvable if every segment matches either a literal
 * directory or a `[param]` directory, and the leaf holds a page.tsx.
 */
function routeExists(path: string): boolean {
  const clean = path.split("?")[0]?.split("#")[0] ?? path;

  if (clean === "/" ) return existsSync(join(ROOT, "app", "page.tsx"));

  const segments = clean.split("/").filter(Boolean);

  let dir = join(ROOT, "app");

  for (const segment of segments) {
    const literal = join(dir, segment);

    if (existsSync(literal) && statSync(literal).isDirectory()) {
      dir = literal;
      continue;
    }

    /* Fall back to a dynamic segment at this level. */
    const dynamic = existsSync(dir)
      ? readdirSync(dir).find(
          (entry) =>
            entry.startsWith("[") &&
            statSync(join(dir, entry)).isDirectory(),
        )
      : undefined;

    if (dynamic === undefined) return false;

    dir = join(dir, dynamic);
  }

  return existsSync(join(dir, "page.tsx"));
}

/* -------------------------------------------------------------------------- */
/*                                DEAD LINKS                                  */
/* -------------------------------------------------------------------------- */

interface FoundLink {
  readonly file: string;
  readonly href: string;
}

function collectLinks(): FoundLink[] {
  const found: FoundLink[] = [];

  for (const file of TSX_FILES) {
    const source = readFileSync(file, "utf8");

    /*
      Two forms, both static and both user-reachable.

      JSX attribute:   href="/search"
      Object property: href: "/search"

      Only the first was collected before, which made this audit blind to
      the exact construct /apps uses: it declares a catalogue of apps as
      objects carrying `href:` and renders each through
      <Link href={app.href}>. A dead entry there is a real 404 a user can
      click — "Research Engine → Open application" was one — but the
      collector could not see it, so the suite reported zero dead links
      while one was on screen.

      Template literals stay excluded: they are dynamic and cannot be
      resolved statically.
    */
    const patterns = [/href="(\/[^"]*)"/g, /href:\s*"(\/[^"]*)"/g];

    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const href = match[1];
        if (href === undefined) continue;

        found.push({ file: file.slice(ROOT.length + 1), href });
      }
    }
  }

  return found;
}

void describe("Every internal link resolves to a real route", () => {
  const links = collectLinks();

  void test("links were actually discovered", () => {
    /*
     * Guards the test itself: if the regex broke, an empty set would
     * make every assertion below vacuously pass.
     */
    assert.ok(
      links.length > 10,
      `Only ${links.length} links found — the collector is probably broken.`,
    );
  });

  void test("both static href forms are collected", () => {
    /*
      The specific blind spot this suite had.

      `length > 10` above is not enough: deleting the object-property
      pattern would still leave hundreds of JSX-attribute links and the
      guard would pass, while every `href:` entry — the entire /apps
      catalogue — went unchecked. That is how a 404 a user could click
      sat behind a green "no dead links" result.

      So each form is asserted to have found something. If a construct
      stops being collected, this fails rather than quietly narrowing
      what the audit can see.
     */
    /*
      Asserted against the COLLECTOR'S OUTPUT, not against file text.

      The first version of this guard filtered `links` and re-read each
      file to see which syntax it contained. That could never fail:
      DesktopSidebar carries both forms, so its attribute-collected
      links still matched an `href:` regex on re-read even with the
      property pattern deleted. It tested the file, not the collector.
      Verified by deleting the pattern and watching it pass anyway.

      These four hrefs exist ONLY as object properties anywhere in the
      app. If the property pattern is lost, none of them can appear in
      `links`, and this fails — which is the whole point.
    */
    const PROPERTY_ONLY = [
      "/activity",
      "/search",
      "/studio/audio",
      "/studio/presentation",
    ];

    const collected = new Set(links.map((link) => link.href));

    const foundProperty = PROPERTY_ONLY.filter((href) =>
      collected.has(href),
    );

    assert.ok(
      collected.size > 0,
      "The collector returned nothing at all.",
    );

    assert.ok(
      foundProperty.length > 0,
      `None of ${PROPERTY_ONLY.join(", ")} were collected. Each exists ` +
        "only as an `href:` object property, so losing that pattern " +
        "makes the entire /apps catalogue invisible to this audit — " +
        "which is exactly how a user-clickable 404 sat behind a green " +
        "result.",
    );
  });

  void test("no href points at a nonexistent page", () => {
    const dead = links.filter((link) => !routeExists(link.href));

    assert.deepEqual(
      dead.map((d) => `${d.file} -> ${d.href}`),
      [],
      "Dead internal links found. Each returns a 404 for the user.",
    );
  });

  void test("the routes fixed in Phase 12 exist", () => {
    /*
     * Regression guards for the four dead links this phase found:
     * /signup, /forgot-password, /canvas/new and /contact.
     */
    for (const route of ["/register", "/reset-password", "/contact"]) {
      assert.ok(routeExists(route), `${route} is missing.`);
    }
  });

  void test("the dead routes are not referenced again", () => {
    for (const dead of ["/signup", "/forgot-password", "/canvas/new"]) {
      const offenders = links.filter((link) => link.href === dead);

      assert.deepEqual(
        offenders.map((o) => o.file),
        [],
        `${dead} does not exist but is still linked.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                          BUTTON COLOUR PAIRING                             */
/* -------------------------------------------------------------------------- */

/**
 * Finds BUTTON-LIKE elements that set a solid background without an
 * explicit text colour.
 *
 * Scoped to `<button>` and `<a>` elements specifically. An earlier,
 * broader version flagged every element with a background — dividers,
 * icon circles, badge dots — which contain no text and therefore cannot
 * have a contrast problem at all. Testing those produced noise that
 * would have to be suppressed, and a suppressed check is worse than no
 * check.
 *
 * Translucent backgrounds (`bg-white/[0.05]`) are excluded: they are
 * surfaces designed to let the inherited colour show through, not filled
 * controls.
 */
const SOLID_BACKGROUND =
  /\bbg-(white|black|zinc-\d{2,3}|slate-\d{2,3}|neutral-\d{2,3}|emerald-\d{2,3}|red-\d{2,3}|cyan-\d{2,3}|blue-\d{2,3})\b(?!\/)/;

const TEXT_COLOUR =
  /\btext-(white|black|zinc-\d{2,3}|slate-\d{2,3}|neutral-\d{2,3}|emerald-\d{2,3}|red-\d{2,3}|cyan-\d{2,3}|blue-\d{2,3})\b/;

function backgroundOnlyClasses(source: string): string[] {
  const offenders: string[] = [];

  /* Normalise multi-line JSX onto one line before matching. */
  const flattened = source.replace(/\s+/g, " ");

  /*
   * Each interactive element, from its tag to the end of its opening
   * tag. Only these can present unreadable label text.
   */
  for (const element of flattened.matchAll(/<(button|a)\s([^>]{0,1200})>/g)) {
    const attributes = element[2];
    if (attributes === undefined) continue;

    const classMatch = attributes.match(/className=[{"`]([^"`}]{10,800})[}"`]/);
    const classes = classMatch?.[1];

    if (classes === undefined) continue;
    if (!SOLID_BACKGROUND.test(classes)) continue;
    if (TEXT_COLOUR.test(classes)) continue;

    offenders.push(classes.trim().slice(0, 160));
  }

  return offenders;
}

void describe("Billing controls state both colours explicitly", () => {
  /*
   * Scoped to billing and pricing. These are the surfaces the phase
   * brief singles out, and where an unreadable CTA costs a sale rather
   * than merely looking wrong.
   */
  const BILLING_SURFACES = [
    join("app", "billing", "page.tsx"),
    join("app", "pricing", "page.tsx"),
    join("app", "contact", "page.tsx"),
    join("app", "components", "billing", "PlanCard.tsx"),
  ];

  for (const relative of BILLING_SURFACES) {
    const full = join(ROOT, relative);

    if (!existsSync(full)) continue;

    void test(`${relative} pairs background with text colour`, () => {
      const offenders = backgroundOnlyClasses(readFileSync(full, "utf8"));

      assert.deepEqual(
        offenders,
        [],
        `A solid background without an explicit text colour inherits it ` +
          `from an ancestor, which is how a payment button becomes ` +
          `black-on-black:\n${offenders.join("\n")}`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                        PLAN VOCABULARY CONSISTENCY                         */
/* -------------------------------------------------------------------------- */

void describe("Billing UI uses the canonical plan vocabulary", () => {
  const PLANS_SRC = readFileSync(join(ROOT, "lib", "plans.ts"), "utf8");

  void test("isPlanId still accepts exactly the five canonical plans", () => {
    for (const plan of ["free", "starter", "pro", "business", "enterprise"]) {
      assert.ok(
        new RegExp(`value === "${plan}"`).test(PLANS_SRC),
        `lib/plans.ts no longer accepts "${plan}".`,
      );
    }
  });

  void test('"premium" is not a canonical plan', () => {
    /*
     * Phase 6 found that a checkout selling "premium" wrote a value
     * isPlanId() rejects, silently degrading a paying customer to FREE.
     * lib/billing/planResolution.ts maps the legacy name to "starter";
     * this asserts the canonical list has not quietly re-adopted it.
     */
    assert.ok(
      !/value === "premium"/.test(PLANS_SRC),
      '"premium" has been re-added to the canonical plan vocabulary.',
    );
  });

  void test("legacy plan names still resolve rather than failing", () => {
    const resolution = readFileSync(
      join(ROOT, "lib", "billing", "planResolution.ts"),
      "utf8",
    );

    assert.match(
      resolution,
      /premium\s*:\s*["']starter["']/,
      "The legacy premium -> starter mapping is gone; old checkouts break.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          NO DEAD SCAFFOLDING IN UI                         */
/* -------------------------------------------------------------------------- */

void describe("Unwired integrations are not presented as working", () => {
  void test("no page imports the unwired integration services", () => {
    /*
     * Rule 24: unfinished scaffolding must not be exposed as product
     * functionality. services/integrations/* is ~145KB of unreferenced
     * code; if a page ever imports it, it becomes user-visible without
     * having been reviewed.
     */
    const offenders: string[] = [];

    for (const file of TSX_FILES) {
      const source = readFileSync(file, "utf8");

      if (
        /from\s+["'][^"']*services\/integrations\/(github|gmail|notion|slack|calendar)["']/.test(
          source,
        )
      ) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }

    assert.deepEqual(offenders, [], "Unwired integration scaffolding is imported by UI.");
  });
});
