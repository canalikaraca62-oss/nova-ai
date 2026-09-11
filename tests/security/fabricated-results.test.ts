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
  {
    /*
     * /activity opened on eight invented events presented as the user's
     * own history — "Research Agent completed a market analysis" with
     * "24 sources" and "8 insights", each stamped "2 minutes ago" and
     * flagged unread. Refresh then slept 650ms behind a spinner and
     * fetched nothing, because there is no /api/activity.
     *
     * The detail is what made it believable, and a feed of fabricated
     * events is worse than an empty one: it reports work done on the
     * user's behalf that never happened.
     */
    name: "/activity",
    source: stripComments(read("app", "activity", "page.tsx")),
  },
];

/**
 * Surfaces that offer a capability standing behind a provider.
 *
 * These must say so when it is missing, and disable the control that
 * would have used it. /activity is deliberately absent: it has no
 * provider to be missing, only an empty feed.
 */
const CAPABILITY_SURFACES = new Set([
  "/studio/image",
  "/studio/video",
  "/studio/audio",
  "/marketplace/[id]",
]);

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
      /*
        Scoped to surfaces that offer a CAPABILITY behind a provider.

        /activity is a different shape: nothing there is "unavailable"
        pending a provider — it is a feed with no events yet, and
        EmptyActivityState already says so. Asserting the Studio wording
        against it would force a misleading message onto the page just
        to satisfy a test.
      */
      if (!CAPABILITY_SURFACES.has(surface.name)) {
        return;
      }

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

void describe("A security log is never invented", () => {
  const PRIVACY = stripComments(read("app", "privacy", "activity", "page.tsx"));

  void test("the log is not seeded", () => {
    /*
      The worst surface in the product to fabricate. A person reads a
      security log to decide whether someone else has been in their
      account: an invented sign-in from an unfamiliar device causes real
      alarm, and an invented quiet log hides a real intrusion.
    */
    assert.ok(
      !/const\s+ACTIVITIES\s*[:=]/.test(PRIVACY),
      "/privacy/activity renders invented security events.",
    );
  });

  void test("it opens empty", () => {
    assert.match(
      PRIVACY,
      /useState<PrivacyActivity\[\]>\(\[\]\)/,
      "The log must be empty until real events are recorded.",
    );
  });
});

void describe("A team roster is never invented", () => {
  const TEAM = stripComments(read("app", "teams", "[id]", "page.tsx"));

  void test("members are not minted client-side", () => {
    /*
      Inviting used to mint an id from Date.now() and append to local
      state under an \"invited\" badge. No invitation was ever sent, and
      there is no team_members table to hold one.
    */
    assert.ok(
      !/Date\.now\(\)/.test(TEAM),
      "/teams/[id] mints a member id that belongs to no row.",
    );
  });

  void test("the roster is not seeded from an invented array", () => {
    assert.ok(
      /*
        Catches the DECLARATION, not just a call.

        The first version matched only `setMembers(`, so a page could
        declare `const [members, setMembers] = useState(...)` — a fully
        mutable roster — and pass, because the destructured name is
        followed by `]` rather than `(`. Verified: reintroducing exactly
        that left the guard green.
      */
      !/\bsetMembers\b/.test(TEAM),
      "A locally mutated roster is an invitation nobody received.",
    );
  });
});

void describe("Canvases are stored, never invented", () => {
  const CANVAS = stripComments(read("app", "canvas", "page.tsx"));

  void test("the list is not seeded with invented canvases", () => {
    /*
      Six fabricated canvases opened this page — "SYRAVEN Product
      Strategy" at 82% progress with 6 collaborators — reading as a
      populated workspace that no user had built.
    */
    assert.ok(
      !/const\s+INITIAL_CANVASES\s*[:=]/.test(CANVAS),
      "/canvas renders invented canvases as though they were real.",
    );
  });

  void test("it opens empty and loads from the API", () => {
    assert.match(
      CANVAS,
      /useState<CanvasItem\[\]>\(\[\]\)/,
      "The list must open empty until the server answers.",
    );

    assert.match(
      CANVAS,
      /fetch\("\/api\/canvases"/,
      "/canvas must load from /api/canvases, which has always existed.",
    );
  });

  void test("the id comes from the server", () => {
    /*
      It used to be built from the title plus Date.now(), so the canvas
      existed only in that tab and its Open link pointed at nothing.
    */
    assert.ok(
      !/Date\.now\(\)/.test(CANVAS),
      "A client-minted id belongs to no row.",
    );

    assert.match(CANVAS, /created/, "Creation must adopt the server row.");
  });

  void test("no column is invented", () => {
    /*
      public.canvases has no type, status, collaborators, progress or
      tags column. Each of those drove a filter, a stat card or a
      progress bar, and every value was made up.
    */
    for (const field of [
      "collaborators",
      "progress",
      "canvas.tags",
      "canvas.status",
    ]) {
      assert.ok(
        !CANVAS.includes(field),
        `/canvas still renders "${field}", which no column supplies.`,
      );
    }
  });
});

void describe("Activity is recorded, never invented", () => {
  const ACTIVITY = stripComments(read("app", "activity", "page.tsx"));

  void test("the feed is not seeded with invented events", () => {
    /*
      Eight fabricated events opened this page as the user own history,
      with detail ("24 sources", "8 insights") that is precisely what
      made them believable.
    */
    assert.ok(
      !/const\s+initialActivities\s*[:=]/.test(ACTIVITY),
      "/activity renders invented events as though they had happened.",
    );
  });

  void test("it starts empty rather than populated", () => {
    /*
      Whitespace-tolerant on purpose: the declaration is wrapped across
      lines in the source, and an assertion that only matches one
      formatting fails on correct code — which is what it did here.
    */
    assert.match(
      ACTIVITY,
      /useState<\s*ActivityItem\s*\[\s*\]\s*>\s*\(\s*\[\s*\]\s*\)/,
      "The feed must open empty until real events exist.",
    );
  });

  void test("nothing offers a refresh that fetches nothing", () => {
    assert.ok(
      !/refreshActivity/.test(ACTIVITY),
      "A refresh control that calls no endpoint reports work it did " +
        "not do.",
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
      /*
        Only pages that KEPT a control need to explain it. /activity
        deleted its "Refresh activity" button rather than disabling it —
        a control that can never work is better gone than greyed out —
        so there is nothing here to describe.
      */
      if (!CAPABILITY_SURFACES.has(surface.name)) {
        continue;
      }

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
