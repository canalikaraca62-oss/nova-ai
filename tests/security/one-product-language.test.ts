/**
 * SYRAVEN — One product language
 * tests/security/one-product-language.test.ts
 *
 * COPY REGRESSION SUITE.
 *
 * WHAT THIS PINS
 *
 * The product speaks English. That was settled by earlier commits ("put
 * the AI pages into the product's own language", "translate the
 * remaining agents headline"), but the job was left half done: 109
 * Turkish strings remained, and they were not confined to a forgotten
 * corner.
 *
 * They sat in three places where the mixture did real damage:
 *
 *   Billing.  Every error a paying customer could hit while starting or
 *             managing a subscription — no configured payment method, a
 *             failed checkout session, an unreachable customer portal —
 *             was in Turkish.
 *
 *   a11y.     "Şifreyi göster" and "Şifreyi gizle" were the aria-labels
 *             on the shared Input's show-password control, so a screen
 *             reader announced Turkish on every password field in the
 *             product. `aria-label="Geri dön"` did the same on the agent
 *             back button.
 *
 *   Agents.   /agents/[id] carried an English agent name above a Turkish
 *             description, and English tab content behind Turkish tab
 *             labels — in the same card, on the same screen.
 *
 * WHY IT IS TESTED RATHER THAN JUST FIXED
 *
 * A mixed-language interface is not a tidiness problem. A user who
 * cannot read the error does not know their payment failed, and a
 * screen-reader user gets a language switch mid-form with no warning.
 * Half-finished translation passes are also exactly the kind of work
 * that regresses quietly, one new string at a time.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function sourceFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }

    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      found.push(full);
    }
  }

  return found;
}

const SOURCES = [
  ...sourceFiles(join(ROOT, "app")),
  ...sourceFiles(join(ROOT, "lib")),
  ...sourceFiles(join(ROOT, "services")),
];

/**
 * Characters that exist in Turkish but not English.
 *
 * Deliberately narrow. It cannot catch Turkish written without them
 * ("Bu plan icin"), and it is not meant to: the goal is a cheap, exact
 * signal with no false positives, not a language classifier. Every one
 * of the 109 strings removed contained at least one of these.
 */
const TURKISH_ONLY = /[şğıçöüŞĞİÇÖÜ]/;

/** A quoted string literal, single or double. */
const QUOTED = /"[^"\n]*"|'[^'\n]*'/g;

/* -------------------------------------------------------------------------- */
/*                                 THE RULE                                   */
/* -------------------------------------------------------------------------- */

void describe("The interface speaks one language", () => {
  void test("no source file carries a Turkish string literal", () => {
    const offenders: string[] = [];

    for (const file of SOURCES) {
      const content = readFileSync(file, "utf8");

      for (const match of content.match(QUOTED) ?? []) {
        if (TURKISH_ONLY.test(match)) {
          offenders.push(
            `${file.replace(ROOT, "").replace(/\\/g, "/")}: ${match}`,
          );
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      "A Turkish string literal is back. The product settled on English; " +
        "a mixed interface leaves a user unable to read the error that " +
        "tells them their payment failed.",
    );
  });

  void test("no accessible name is in another language", () => {
    /*
     * Checked separately from the rule above, and kept even though it
     * currently overlaps with it. An aria-label is read aloud rather
     * than seen, so a user relying on a screen reader has no visual
     * context to fall back on — this deserves to fail with its own
     * message rather than as one line in a long list.
     */
    const offenders: string[] = [];

    for (const file of SOURCES) {
      const content = readFileSync(file, "utf8");

      const labels =
        content.match(/aria-label\s*=\s*(?:"[^"]*"|\{`[^`]*`\})/g) ?? [];

      for (const label of labels) {
        if (TURKISH_ONLY.test(label)) {
          offenders.push(
            `${file.replace(ROOT, "").replace(/\\/g, "/")}: ${label}`,
          );
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      "An aria-label is not in the product's language. It is announced " +
        "aloud, so there is no visual context to recover the meaning " +
        "from.",
    );
  });

  void test("API messages returned to a client are in one language", () => {
    /*
     * The run route returned Turkish text as an API `message` field,
     * which the client rendered directly. A route's message is product
     * copy, not a log line.
     */
    const offenders: string[] = [];

    for (const file of SOURCES) {
      if (!file.includes(join("app", "api"))) {
        continue;
      }

      const content = readFileSync(file, "utf8");

      const messages =
        content.match(/message:\s*(?:"[^"]*"|'[^']*')/g) ?? [];

      for (const message of messages) {
        if (TURKISH_ONLY.test(message)) {
          offenders.push(
            `${file.replace(ROOT, "").replace(/\\/g, "/")}: ${message}`,
          );
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      "An API route returns a message a client will render, in another " +
        "language.",
    );
  });
});
