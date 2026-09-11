/**
 * SYRAVEN — dates, times and prices in the product's own locale
 * tests/security/one-locale.test.ts
 *
 * PRODUCT INTEGRITY REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * one-product-language.test.ts polices the words. This polices the
 * numbers, which slipped past it entirely: ten `Intl` calls were
 * hardcoded to "tr-TR" while the interface was English, so a reader saw
 * English copy beside Turkish-formatted timestamps and a price written
 * "50 €" rather than "€50".
 *
 * A locale string is not a translatable phrase, so no wordlist would
 * ever have caught these. They need their own rule.
 *
 * WHY toLocaleLowerCase MATTERS MORE THAN THE REST
 *
 * Turkish casing is not a presentation choice. Its alphabet has a
 * dotless ı, so "I".toLocaleLowerCase("tr-TR") is "ı", not "i" — and a
 * search that normalises input that way stops matching anything typed
 * with a capital I. One such call exists in this codebase, in a
 * component nothing currently imports; it is included below so that
 * wiring that component up does not quietly ship the bug with it.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const APP = join(ROOT, "app");

/** Every .ts/.tsx under app/. */
function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      sourceFiles(full, found);
      continue;
    }

    if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      found.push(full);
    }
  }

  return found;
}

/**
 * Strips commentary.
 *
 * The fixes carry comments naming "tr-TR" and explaining why it was
 * wrong. Those explanations must not fail the test that made them
 * necessary — the same trap an earlier guard here fell into when it
 * matched its own subject's prose.
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

const SOURCES = sourceFiles(APP);

/* -------------------------------------------------------------------------- */
/*                               ONE LOCALE                                   */
/* -------------------------------------------------------------------------- */

void describe("Formatting speaks the product's language", () => {
  void test("no source file hardcodes a Turkish locale", () => {
    const offenders: string[] = [];

    for (const file of SOURCES) {
      const content = executable(readFileSync(file, "utf8"));

      /*
       * Matches the locale wherever it is passed: Intl.DateTimeFormat,
       * Intl.NumberFormat, toLocaleLowerCase, toLocaleDateString, or a
       * bare constant waiting to be used.
       */
      if (/["']tr(?:-TR)?["']/.test(content)) {
        offenders.push(relative(ROOT, file).replace(/\\/g, "/"));
      }
    }

    assert.deepEqual(
      offenders,
      [],
      "A Turkish locale is back. The interface is English, so a date, " +
        "a time or a price formatted this way reads as a different " +
        "product mid-sentence:\n  " +
        offenders.join("\n  "),
    );
  });

  void test("search normalisation is not locale-dependent", () => {
    /*
     * The specific catch: toLocaleLowerCase with a Turkish locale maps
     * I to ı, so a query containing a capital I stops matching. Plain
     * toLowerCase, or an explicit neutral locale, is what a search
     * index needs.
     */
    const offenders: string[] = [];

    for (const file of SOURCES) {
      const content = executable(readFileSync(file, "utf8"));

      for (const match of content.match(
        /toLocaleLowerCase\(\s*["'][^"']+["']\s*\)/g,
      ) ?? []) {
        if (!/["']en(?:-[A-Z]{2})?["']/.test(match)) {
          offenders.push(
            `${relative(ROOT, file).replace(/\\/g, "/")}: ${match}`,
          );
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      "Case folding with a non-English locale changes which letters " +
        "match. Turkish maps I to a dotless i, so a search normalised " +
        "this way cannot find anything typed with a capital I:\n  " +
        offenders.join("\n  "),
    );
  });
});
