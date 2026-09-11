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
const TURKISH_DIACRITIC = /[şğıçöüŞĞİÇÖÜ]/;

/**
 * Turkish written in plain ASCII.
 *
 * The diacritic test above called its own narrowness deliberate: every
 * one of the 109 strings removed at the time carried at least one of
 * those letters, so a wordlist would have added false positives for no
 * gain.
 *
 * That stopped being true. Seven strings survived in reachable UI with
 * no diacritic at all — "agent bulundu", `aria-label="Favorilere
 * ekle"`, `title="Ekip uyumlu"`, "Agent ara...", "Aktivitelerde ara...",
 * "Arama ifadenizi veya kategori", and a textarea placeholder asking
 * `${agent.name} ile ne yapmak istiyorsun?`. The suite reported the
 * product monolingual through all of them.
 *
 * Every token here is a whole word that does not occur in English.
 * "ara", "ile" and "veya" are short enough to be worth stating why
 * they are safe: as \b-delimited words none of them is English, and
 * the word boundaries stop them matching inside "area", "file" or
 * "conveyance".
 */
const TURKISH_ASCII =
  /\b(?:bulundu|ara|arama|ifadenizi|kategori|ekle|eklendi|belirle|uyumlu|ekip|sistemi|gelecekte|istiyorsun|yapmak|ile|veya|icin|aktivitelerde|yukleniyor|kaydet|duzenle|secim|secin|gorunum|baslat|durdur|iptal)\b/i;

/**
 * Either spelling of Turkish, diacritic or ASCII.
 *
 * Kept as one predicate so all four extractors below — quoted
 * literals, JSX text, aria-labels and API messages — gain the ASCII
 * coverage together rather than one at a time.
 */
const TURKISH_ONLY = {
  test(value: string): boolean {
    return TURKISH_DIACRITIC.test(value) || TURKISH_ASCII.test(value);
  },
};

/**
 * A string literal: single, double, or template.
 *
 * Backticks were missing, and that was not academic.
 * app/components/activity/ActivityFeed.tsx builds its relative
 * timestamps as `${minutes} dk önce` — text rendered on every activity
 * row, invisible to a pattern that only knew about " and '.
 */
const QUOTED = /"[^"\n]*"|'[^'\n]*'|`[^`\n]{0,400}`/g;

/**
 * JSX text content — the words rendered between tags.
 *
 * The quoted-literal pattern cannot see these, and that gap was real:
 * app/agents/[id]/page.tsx carried ten visible Turkish strings as bare
 * JSX text while this suite reported the product monolingual. A user
 * reads that text directly; the guard simply was not looking at it.
 *
 * Matches a run between `>` and `<` containing at least one letter, so
 * punctuation and whitespace between tags are ignored.
 */
const JSX_TEXT = />([^<>{}]*\p{L}[^<>{}]*)</gu;

/*
 * SCOPE: what a user reads, not what an engineer reads.
 *
 * Code comments are deliberately NOT policed. Eight files under app/api
 * carry Turkish engineering notes — "Kullanıcının kendi agentları",
 * "Güvenlik:", explanations of a TypeScript narrowing — and none of it
 * reaches a screen. Translating those would be tidiness; leaving a
 * Turkish error message in a billing route was a defect.
 *
 * This is recorded because the difference is not obvious from a grep: a
 * repository-wide search for Turkish characters still returns those
 * files, and this suite passing is the correct answer rather than a
 * blind spot. The blind spots that did exist — quoted literals only,
 * then no template literals, then single-line JSX text only — are each
 * fixed above.
 */

/* -------------------------------------------------------------------------- */
/*                                 THE RULE                                   */
/* -------------------------------------------------------------------------- */

void describe("The interface speaks one language", () => {
  void test("no source file carries a Turkish string literal", () => {
    const offenders: string[] = [];

    for (const file of SOURCES) {
      const content = readFileSync(file, "utf8");

      /*
        Both surfaces a user can read: quoted literals, and the text
        rendered between tags.

        Scanning only the first is what let app/agents/[id]/page.tsx
        stay visibly Turkish — headings, paragraphs, button labels —
        while this suite reported the product monolingual.
      */
      for (const match of content.match(QUOTED) ?? []) {
        if (TURKISH_ONLY.test(match)) {
          offenders.push(
            `${file.replace(ROOT, "").replace(/\\/g, "/")}: ${match}`,
          );
        }
      }

      for (const match of content.matchAll(JSX_TEXT)) {
        const text = match[1];
        if (text === undefined) continue;

        /*
          A language picker is the one place a non-English word is
          correct.

          app/settings/page.tsx offers <option>Türkçe</option> beside
          Deutsch, Français and Español. Every language is named in its
          own script, because that is how a person finds their own
          language in a list — rendering it as "Turkish" would be the
          defect, not the fix.

          Scoped to <option> deliberately. This is not a general licence
          for non-English text: a heading, a button or a paragraph in
          another language is still caught. The exemption covers exactly
          the element where endonyms belong.
        */
        /*
          `+ 1` because JSX_TEXT captures after consuming the opening
          `>`, so match.index points AT that bracket rather than past
          it. Without it the preceding slice ends in "<option" with no
          closing bracket and the test never matches — verified against
          the real indices rather than assumed.
        */
        if (/<option[^>]*>\s*$/.test(content.slice(0, match.index + 1))) {
          continue;
        }

        if (TURKISH_ONLY.test(text)) {
          offenders.push(
            `${file.replace(ROOT, "").replace(/\\/g, "/")}: ` +
              `${text.trim().slice(0, 80)}`,
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
