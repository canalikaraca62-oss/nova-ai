/**
 * SYRAVEN — Fabricated results must not return
 * tests/security/fabricated-results.test.ts
 *
 * PRODUCT INTEGRITY REGRESSION SUITE.
 *
 * THE DEFECT THIS PINS
 *
 * Four Studio surfaces claimed work they never did:
 *
 *   /studio/image  ran an 1,800ms spinner captioned "Creating your
 *                  image", then rendered a hardcoded Unsplash stock
 *                  photograph as the user's own generation, with a
 *                  Download button beside it.
 *
 *   /studio/video  slept 2,000ms behind "AI is producing your video",
 *                  then added a history entry whose preview was a CSS
 *                  gradient captioned AI GENERATED VIDEO. Its Download
 *                  saved a .txt file of the prompt.
 *
 *   /studio/audio  flipped a project to "processing", slept 1,800ms,
 *                  flipped it to "completed", and changed not one
 *                  sample of the uploaded file.
 *
 *   /marketplace   reported "Installed" after 700ms, installing nothing.
 *
 * None of these could be distinguished from a real result by the person
 * looking at them. That is what makes it a security-adjacent defect
 * rather than a cosmetic one: the interface asserted a fact about the
 * world that the system had not established.
 *
 * WHY THE TEST IS SHAPED THIS WAY
 *
 * The rule enforced here is narrow and mechanical: on a surface with no
 * provider behind it, a timer must not be followed by a success state.
 * `setTimeout` is not banned outright — debounces and animations are
 * legitimate. What is banned is the pairing that manufactures a result.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function read(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

/**
 * Strips comments so that a comment *describing* the removed defect is
 * never mistaken for the defect itself. Without this, the explanatory
 * note above each fix would fail its own test.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const SURFACES: ReadonlyArray<{
  name: string;
  source: string;
}> = [
  {
    name: "/studio/image",
    source: stripComments(read("app", "studio", "image", "page.tsx")),
  },
  {
    name: "/studio/video",
    source: stripComments(read("app", "studio", "video", "page.tsx")),
  },
  {
    name: "/studio/audio",
    source: stripComments(read("app", "studio", "audio", "page.tsx")),
  },
  {
    /*
     * The catalogue here is a real curated description of what SYRAVEN
     * does, which is worth showing. "Install" was not: it animated for
     * 700ms and settled on a green Installed tick having installed
     * nothing, and a reload reset the button.
     */
    name: "/marketplace/[id]",
    source: stripComments(
      read("app", "marketplace", "[id]", "page.tsx"),
    ),
  },
];

/* -------------------------------------------------------------------------- */
/*                              NO FAKE LATENCY                               */
/* -------------------------------------------------------------------------- */

void describe("Unprovisioned capabilities do not fake work", () => {
  for (const surface of SURFACES) {
    void test(`${surface.name} does not sleep to simulate processing`, () => {
      /*
       * The tell is a promise wrapped around a timer: the only reason to
       * await a bare setTimeout on these pages was to make an instant
       * local mutation feel like a network round trip.
       */
      const simulatedLatency =
        /new Promise\([^)]*\)\s*=>\s*\{?\s*(window\.)?setTimeout/.test(
          surface.source,
        ) ||
        /await new Promise[\s\S]{0,120}setTimeout/.test(surface.source);

      assert.equal(
        simulatedLatency,
        false,
        `${surface.name} awaits a timer, which is how it used to make a ` +
          `fabricated result look like real work.`,
      );
    });

    void test(`${surface.name} states that the capability is unavailable`, () => {
      assert.match(
        surface.source,
        /CapabilityUnavailable|is not available yet|not available|no .*provider is connected/i,
        `${surface.name} must tell the user the capability is not ` +
          `available rather than quietly doing nothing.`,
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                            NO INVENTED CONTENT                             */
/* -------------------------------------------------------------------------- */

void describe("No stock media is presented as the user's own", () => {
  void test("/studio/image does not source a result from a stock library", () => {
    const source = SURFACES[0]!.source;

    assert.ok(
      !/unsplash\.com|pexels\.com|picsum\.photos/i.test(source),
      "A stock photograph was rendered as the user's generated image. " +
        "No result may come from a stock library.",
    );
  });

  void test("/studio/image has no generated-image state to populate", () => {
    const source = SURFACES[0]!.source;

    /*
     * With no provider, there is nothing that can legitimately fill a
     * results collection. Keeping the state around is how the fake crept
     * back in during earlier work.
     */
    assert.ok(
      !/setGeneratedImages\s*\(/.test(source),
      "/studio/image still holds a results collection it cannot fill " +
        "honestly.",
    );
  });

  void test("/studio/video does not offer a download of a video that does not exist", () => {
    const source = SURFACES[1]!.source;

    assert.ok(
      !/\.txt`|-video\.txt/.test(source),
      "/studio/video's Download produced a text file named like a video.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                        DISABLED, NOT SILENTLY INERT                        */
/* -------------------------------------------------------------------------- */

void describe("An action that cannot run says so", () => {
  void test("/studio/image's generate control is disabled", () => {
    assert.match(
      SURFACES[0]!.source,
      /disabled\s*$|disabled\s*\n|disabled>/m,
      "A control that cannot succeed must be disabled, not merely inert.",
    );
  });

  void test("/studio/video's generate control is disabled", () => {
    assert.match(
      SURFACES[1]!.source,
      /disabled\s*$|disabled\s*\n|disabled>/m,
      "A control that cannot succeed must be disabled, not merely inert.",
    );
  });

  void test("a disabled control explains itself", () => {
    for (const surface of SURFACES) {
      assert.match(
        surface.source,
        /aria-describedby=/,
        `${surface.name} disables a control without pointing at the ` +
          `reason, which reads as a bug rather than a decision.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                          THE HONEST STATE ITSELF                           */
/* -------------------------------------------------------------------------- */

void describe("CapabilityUnavailable is honest by construction", () => {
  const COMPONENT = stripComments(
    read("app", "components", "ui", "CapabilityUnavailable.tsx"),
  );

  void test("it offers no retry", () => {
    /*
     * Retrying cannot succeed while no provider is configured, so a
     * retry button would be the same false promise in a smaller form.
     */
    assert.ok(
      !/retry|try again/i.test(COMPONENT),
      "CapabilityUnavailable must not offer an action that cannot work.",
    );
  });

  void test("it is announced politely, not as an alert", () => {
    /*
     * This is a standing condition of the page, not an event. `alert`
     * would interrupt a screen reader every time the region rendered.
     */
    assert.match(COMPONENT, /role="status"/);
    assert.match(COMPONENT, /aria-live="polite"/);
  });
});
