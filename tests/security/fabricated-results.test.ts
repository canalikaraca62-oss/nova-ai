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
import { existsSync, readFileSync } from "node:fs";
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
     * /apps is a static launcher for surfaces that exist -- names,
     * descriptions and hrefs into /agents, /chat, /canvas. That part is
     * true and worth showing.
     *
     * Each card also carried a usage figure: "12.4k runs", "8.7k
     * messages", "24.1k sources", "1.8k workspaces". The page has no
     * data source of any kind, so those counters measured nothing while
     * reading as this workspace's own activity -- on a page linked from
     * the sidebar, which made them among the first numbers a new user
     * saw.
     */
    name: "/apps",
    source: stripComments(read("app", "apps", "page.tsx")),
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
  /*
    The worst surface in the product to fabricate. A person reads a
    security log to decide whether someone else has been in their
    account: an invented sign-in from an unfamiliar device causes real
    alarm, and an invented quiet log hides a real intrusion.

    /privacy/activity first shipped five invented events, then an empty
    log with no backend: no route exposes audit_logs and there is no
    /api/privacy. Phase 2 retired it (PURIFICATION_EVIDENCE.md P2-P03).
    A security log comes back only with a real audit-log route behind
    it -- and with this pin replaced by one on that route's data.
  */
  void test("/privacy/activity stays retired until a real audit-log route exists", () => {
    assert.ok(
      !existsSync(join(process.cwd(), "app", "privacy", "activity", "page.tsx")),
      "/privacy/activity is back without an audit-log backend. A " +
        "security log must read real events, not show a seeded or " +
        "permanently empty list.",
    );
  });
});

void describe("A launcher does not report activity it cannot measure", () => {
  /*
   * Read through stripComments, so the note left in the page recording
   * what the figures used to say cannot satisfy -- or trip -- this.
   */
  const APPS = stripComments(read("app", "apps", "page.tsx"));

  void test("no card carries a usage count", () => {
    /*
     * "12.4k runs", "8.7k messages", "24.1k sources", "1.8k
     * workspaces", "642 active", "9.1k completed". None was measured:
     * /apps issues no request of any kind. They read as this
     * workspace's own activity on a page linked from the sidebar.
     */
    const counted =
      /"\s*\d+(\.\d+)?k?\s+(runs|messages|sources|boards|workspaces|active|completed|users|items)\s*"/i.exec(
        APPS,
      );

    assert.equal(
      counted,
      null,
      `/apps reports ${counted?.[0]} without measuring anything.`,
    );
  });

  void test("the catalogue declares no usage field", () => {
    assert.ok(
      !/^\s*usage\??:\s*string/m.test(APPS),
      "A usage field on the item type invites a number back onto a " +
        "page that has no data source to produce one.",
    );
  });

  void test("it still issues no request, so no figure could be real", () => {
    /*
     * The honest position for this page. If /apps ever gains a data
     * source, a usage figure becomes possible -- and this assertion is
     * what forces that to be a deliberate change rather than a
     * hardcoded string reappearing.
     */
    assert.ok(
      !/fetch\(/.test(APPS),
      "/apps now fetches. Any per-app figure must come from that " +
        "response, and these assertions must be revisited deliberately.",
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

  /*
    THE ROSTER WAS NOT THE WHOLE DEFECT.

    The two assertions above passed while the page still ran on a
    module-scope array of three invented teams. Emptying `members` left
    everything around it standing: eighteen invented projects, a 94%
    collaboration score, a "Healthy" status, three invented initiative
    names, and an activity feed of events that never happened with
    timestamps like "12 minutes ago".

    It was broken as a route too — the lookup matched a real team's UUID
    against invented slugs, so only the fictions could ever render.

    A guard that checks how a roster is mutated, but not whether the
    surrounding page is real, is the narrow kind that lets this survive.
  */

  void test("the team itself is not an invented constant", () => {
    assert.ok(
      !/const\s+teams\s*:\s*Team\[\]\s*=\s*\[/.test(TEAM),
      "A module-scope team array is three fictions with a lookup.",
    );

    for (const invention of [
      /@syraven\.ai/,
      /SYRAVEN Core/,
      /Global Growth/,
    ]) {
      assert.ok(
        !invention.test(TEAM),
        `/teams/[id] carries invented data (${String(invention)}).`,
      );
    }
  });

  void test("no metric is asserted without a column behind it", () => {
    /*
      public.projects has no team_id — only knowledge does — so a team's
      project count cannot be derived at all. Collaboration and health
      were never columns anywhere. Rendering zero would still assert the
      metric exists, so these are absent rather than empty.
    */
    for (const metric of [
      /Collaboration/,
      /\b94%/,
      /Active projects/,
      /Active initiatives/,
    ]) {
      assert.ok(
        !metric.test(TEAM),
        `/teams/[id] reports ${String(metric)}, which no column supplies.`,
      );
    }
  });

  void test("no activity feed is invented", () => {
    assert.ok(
      !/\bactivities\b/.test(TEAM),
      "Nothing records team events, so a feed here would be fabricated.",
    );
  });

  void test("the team is loaded from the route that owns it", () => {
    assert.match(
      TEAM,
      /fetch\(\s*`\/api\/teams\?id=/,
      "The team must come from /api/teams, on the caller's session.",
    );
  });
});

void describe("Social proof is never manufactured", () => {
  const LIST = stripComments(read("app", "marketplace", "page.tsx"));

  const DETAIL = stripComments(
    read("app", "marketplace", "[id]", "page.tsx"),
  );

  /*
    The catalogue copy here is real: it describes what SYRAVEN does,
    and it is worth showing. The numbers beside it were not.

    Every item carried rating: 4.9, reviews: 248, installs: "12.4k",
    rendered as stars, a review count and an install figure. Nobody
    rated these. There is no /api/marketplace, no ratings table, no
    installs table, and nothing has ever been installed.

    This is a worse class than an invented canvas. A fabricated
    document misrepresents the user's own data to the user; fabricated
    social proof is aimed at a decision they are about to make.
  */

  for (const [name, source] of [
    ["/marketplace", LIST],
    ["/marketplace/[id]", DETAIL],
  ] as const) {
    void test(`${name} claims no rating, review or install count`, () => {
      for (const metric of [
        /\brating\s*:/,
        /\breviews\s*:/,
        /\binstalls\s*:/,
        /\bitem\.rating\b/,
        /\bitem\.reviews\b/,
        /\bitem\.installs\b/,
      ]) {
        assert.ok(
          !metric.test(source),
          `${name} reports ${String(metric)}, which nothing measures.`,
        );
      }
    });
  }
});

void describe("A task is loaded, never conjured", () => {
  const TASK = stripComments(
    read("app", "tasks", "[id]", "page.tsx"),
  );

  void test("no task database is held in the module", () => {
    /*
      Four invented tasks keyed "task-1".."task-4". /tasks links to
      /tasks/${task.id} with real UUIDs, so none of those keys could
      ever match a genuine row.
    */
    assert.ok(
      !/taskDatabase/.test(TASK),
      "/tasks/[id] carries an invented task database.",
    );
  });

  void test("an unknown id is not answered with an invented task", () => {
    /*
      The worst of the sixteen fabricated surfaces found here.
      createDefaultTask(id) returned a task for ANY unrecognised id --
      "Untitled Task", "This task was created in your workspace.",
      dated today. Because the real UUIDs never matched the four keys,
      every genuine task rendered as one of these, and the page had no
      path on which it could say a task did not exist.
    */
    assert.ok(
      !/createDefaultTask/.test(TASK),
      "An unknown id must produce a not-found state, not a task.",
    );

    assert.match(
      TASK,
      /Task not found/,
      "There must be a state that reports the task is absent.",
    );
  });

  void test("no completion percentage is manufactured", () => {
    /*
      getCompletionPercentage mapped status to 0/50/100 and drove a
      progress bar from it -- the status badge restated as a
      measurement. public.tasks has no progress column.
    */
    assert.ok(
      !/getCompletionPercentage|completionPercentage/.test(TASK),
      "/tasks/[id] reports progress that no column supplies.",
    );
  });

  void test("it loads from the route that owns the row", () => {
    assert.match(
      TASK,
      /fetch\("\/api\/tasks/,
      "The task must come from /api/tasks, on the caller's session.",
    );

    assert.match(
      TASK,
      /payload\?\.data\?\.tasks/,
      "This route wraps rows as { data: { tasks } }; reading another " +
        "shape would render every task as not found.",
    );
  });

  void test("edits reach the server", () => {
    /*
      Editing, status changes and completion toggles all called setTask
      and nothing else: the UI moved, the row never did, and a reload
      undid it. That is the fake-persistence defect, on a surface where
      the user has every reason to believe their change was saved.
    */
    assert.match(
      TASK,
      /method: "PATCH"/,
      "A change that never leaves the browser has not been saved.",
    );

    assert.match(
      TASK,
      /method: "DELETE"/,
      "Deleting must remove the row, not just hide the page.",
    );
  });

  void test("the status spelling the route accepts is sent", () => {
    /*
      The route validates against todo | in_progress | blocked |
      completed | cancelled. This page displays "in-progress" like
      /tasks does, so it must convert on the way out or every status
      change fails with a 400 the user never sees.
    */
    assert.match(
      TASK,
      /in_progress/,
      "Sending the hyphenated spelling would be rejected by the route.",
    );
  });
});

void describe("Projects are loaded, never invented", () => {
  const PROJECTS = stripComments(read("app", "projects", "page.tsx"));

  void test("the list is not seeded from a module-scope array", () => {
    assert.ok(
      !/const projects\s*:\s*Project\[\]\s*=\s*\[/.test(PROJECTS),
      "/projects is seeded with invented projects.",
    );
  });

  void test("it loads from the route that owns the rows", () => {
    assert.match(
      PROJECTS,
      /fetch\("\/api\/projects/,
      "Projects must come from /api/projects, on the caller's session.",
    );
  });

  void test("no metric is claimed without a column behind it", () => {
    /*
      progress, members, tasksCompleted and totalTasks were invented
      per row. public.projects has none of them.

      The task-completion tile computed
      Math.round((completedTasks / totalTasks) * 100). With real data
      and no tasks that is 0/0 -- it would have rendered "NaN%" on the
      first honest load, which is how a fabricated metric announces
      itself once the fabrication is removed.
    */
    for (const invented of [
      /\bprogress\b/,
      /tasksCompleted/,
      /totalTasks/,
      /\bmembers\b/,
    ]) {
      assert.ok(
        !invented.test(PROJECTS),
        `/projects reports ${String(invented)}, which no column supplies.`,
      );
    }
  });
});

void describe("Agents are loaded, never invented", () => {
  const AGENTS = stripComments(read("app", "agents", "page.tsx"));

  void test("the list is not seeded from a module-scope array", () => {
    assert.ok(
      !/const agents\s*:\s*Agent\[\]\s*=\s*\[/.test(AGENTS),
      "/agents is seeded with twelve invented agents.",
    );
  });

  void test("it reads the envelope this route actually returns", () => {
    /*
      /api/agents answers { success, agents: [...] }, not { data }.
      Assuming a shared envelope has already silently emptied one page
      in this codebase, so the key is asserted rather than trusted.
    */
    assert.match(
      AGENTS,
      /fetch\("\/api\/agents/,
      "Agents must come from /api/agents, on the caller's session.",
    );

    assert.match(
      AGENTS,
      /payload\?\.agents/,
      "This route returns `agents`; reading `data` would render empty.",
    );
  });

  void test("no taxonomy is invented", () => {
    /*
      category, featured, premium, popular, colour gradients and tag
      lists were all client-side inventions. public.agents has none of
      those columns, so the category chips and the "Featured" rail
      filtered fiction.
    */
    for (const invented of [
      /\bpremium\b/,
      /\bpopular\b/,
      /featuredAgents/,
      /AgentCategory/,
    ]) {
      assert.ok(
        !invented.test(AGENTS),
        `/agents carries ${String(invented)}, which no column supplies.`,
      );
    }
  });

  void test("favourites are not kept only in local state", () => {
    /*
      A heart button toggled a `favorites` array that nothing stored,
      so every favourite vanished on reload.
    */
    assert.ok(
      !/\bsetFavorites\b/.test(AGENTS),
      "A favourite nothing persists is lost on the next page load.",
    );
  });
});

void describe("Knowledge is loaded, never invented", () => {
  const KNOWLEDGE = stripComments(read("app", "knowledge", "page.tsx"));

  void test("the list is not seeded from a module-scope array", () => {
    /*
      Six invented items opened this page as though they were the
      user's own knowledge base -- "AI Strategy & Architecture",
      "Product Research" -- each stamped "Recently updated" and tagged.
      The search box filtered fiction and the counters counted it.
    */
    assert.ok(
      !/const KNOWLEDGE_ITEMS\s*:\s*KnowledgeItem\[\]\s*=\s*\[/.test(
        KNOWLEDGE,
      ),
      "/knowledge is seeded with invented items.",
    );
  });

  void test("it loads from the route that owns the rows", () => {
    assert.match(
      KNOWLEDGE,
      /fetch\("\/api\/knowledge/,
      "Knowledge must come from /api/knowledge, on the caller's session.",
    );
  });

  void test("no timestamp is invented", () => {
    for (const invention of [
      /"Recently updated"/,
      /"Updated today"/,
    ]) {
      assert.ok(
        !invention.test(KNOWLEDGE),
        `/knowledge stamps rows with ${String(invention)}, which is not ` +
          `a timestamp.`,
      );
    }
  });

  void test("creating does not fake a save", () => {
    /*
      The create button awaited a 500ms timer and resolved, having
      created nothing. POST /api/knowledge requires a title and this
      page has no title field, so the control says so instead.
    */
    assert.ok(
      !/setTimeout/.test(KNOWLEDGE),
      "A timer on this page can only be simulating work.",
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
