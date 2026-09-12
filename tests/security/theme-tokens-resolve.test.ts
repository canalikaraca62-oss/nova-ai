/**
 * SYRAVEN — the palette actually paints
 * tests/security/theme-tokens-resolve.test.ts
 *
 * PRODUCT INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * globals.css declared a full palette on :root -- background, card,
 * muted, primary, border and the rest -- and imported Tailwind with no
 * @theme block. Tailwind v4 generates colour utilities from @theme,
 * not from :root, so every semantic utility in the product resolved to
 * nothing:
 *
 *     bg-card, bg-muted, bg-background, bg-primary
 *       measured rgba(0, 0, 0, 0) in the browser
 *
 *     text-foreground, text-muted-foreground, text-primary
 *       all measured rgb(250, 250, 250), so muted text was
 *       indistinguishable from primary text
 *
 *     text-destructive, bg-destructive
 *       painted nothing at all
 *
 * That is roughly 4,000 occurrences across 118 files. It is also why
 * so much of this codebase reaches for bg-white/[0.0x] and
 * border-white/10: those are real Tailwind utilities, and they worked.
 *
 * WHY NOTHING CAUGHT IT
 *
 * Typecheck cannot see CSS. Lint checks class syntax, not whether a
 * class resolves. The build succeeded -- an unresolved utility is not
 * an error, it simply emits no rule. Every one of 1,551 tests passed
 * throughout. The product looked plausible because the ad-hoc alphas
 * carried the design while the token layer did nothing.
 *
 * Only two instruments found it: the built bundle, which contained
 * .bg-white 47 times and .bg-card zero times, and getComputedStyle on
 * a live page.
 *
 * WHAT THIS GUARD CHECKS
 *
 * The source-level cause, not the rendered result -- a unit test
 * cannot run a browser. If the @theme block is removed or a mapping
 * is dropped, the utilities silently stop resolving again, and this
 * is what says so.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * globals.css with every comment removed.
 *
 * This file's own header explains the defect and names `@theme` in
 * prose. Reading raw source, the assertion below matched that comment
 * and passed on a stylesheet whose real block had been renamed away --
 * verified by mutation, which is the only reason it was caught.
 *
 * That is the third guard in this codebase to match its own subject's
 * explanation. The sibling guards already strip; this one now strips
 * too, and every assertion here reads the stripped source.
 */
function executable(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("*"))
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const CSS = executable(
  readFileSync(join(process.cwd(), "app", "globals.css"), "utf8"),
);

/**
 * Every colour a semantic utility is used for in the product.
 *
 * Each name here corresponds to real usage: bg-card appears 197 times,
 * text-foreground 1046, text-muted-foreground 924, border-border 619,
 * bg-muted 450, bg-primary 341, bg-background 276, and the destructive
 * family 176. None of them painted before the @theme block existed.
 */
const REQUIRED_COLOURS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "input",
  "ring",
  "destructive",
] as const;

/* -------------------------------------------------------------------------- */
/*                          THE THEME BLOCK EXISTS                            */
/* -------------------------------------------------------------------------- */

void describe("Semantic colours resolve to utilities", () => {
  void test("an @theme block is declared", () => {
    /*
     * Without this, :root is a set of custom properties that nothing
     * reads, and every semantic class in the product is inert.
     */
    /*
     * Anchored on the block's opening brace, not the bare word.
     *
     * `/@theme\b/` matched the sentence in this file's header that
     * mentions @theme, so renaming the real block to @nottheme left
     * the guard green while every semantic utility in the product
     * went dead again.
     */
    assert.match(
      CSS,
      /@theme[^{]*\{/,
      "The @theme block is gone. Tailwind v4 generates colour " +
        "utilities from it, so bg-card, text-foreground, border-border " +
        "and ~4,000 other usages now paint nothing -- silently, " +
        "because an unresolved utility is not a build error.",
    );
  });

  void test("every semantic colour is mapped", () => {
    const theme = /@theme[^{]*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";

    assert.ok(
      theme.length > 0,
      "The @theme block is present but empty or unparseable.",
    );

    for (const colour of REQUIRED_COLOURS) {
      assert.match(
        theme,
        new RegExp(`--color-${colour}\\s*:`),
        `--color-${colour} is not mapped, so every bg-${colour} / ` +
          `text-${colour} / border-${colour} in the product resolves ` +
          `to nothing.`,
      );
    }
  });

  void test("the mappings read the :root values", () => {
    /*
     * Mapped through var() rather than duplicated literals, so the
     * palette has one source. A hardcoded hex here would drift from
     * :root without anything noticing -- the same class of defect as
     * two focus traps that differ in small ways.
     */
    const theme = /@theme[^{]*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";

    const mappings = theme.match(/--color-[a-z-]+\s*:\s*[^;]+;/g) ?? [];

    assert.ok(
      mappings.length >= REQUIRED_COLOURS.length,
      `Only ${mappings.length} colour mappings found.`,
    );

    for (const mapping of mappings) {
      assert.match(
        mapping,
        /var\(--[a-z-]+\)/,
        `A colour is hardcoded rather than mapped: ${mapping.trim()}. ` +
          `The palette must have one source, or :root and @theme drift.`,
      );
    }
  });

  void test("the :root palette still defines what @theme points at", () => {
    /*
     * The mapping is only as good as its target. A var() pointing at a
     * property nobody declares resolves to nothing, which is exactly
     * the state this guard exists to prevent.
     */
    const theme = /@theme[^{]*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";

    const referenced = [
      ...theme.matchAll(/var\((--[a-z-]+)\)/g),
    ].map((match) => match[1]);

    assert.ok(
      referenced.length > 0,
      "The @theme block references no custom properties at all.",
    );

    const root = /:root\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";

    for (const property of new Set(referenced)) {
      assert.ok(
        root.includes(`${property}:`),
        `@theme maps a colour to ${property}, which :root does not ` +
          `define. The utility resolves to nothing.`,
      );
    }
  });
});
