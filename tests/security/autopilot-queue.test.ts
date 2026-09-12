/**
 * SYRAVEN — a lease that two runners can both win is not a lease
 * tests/security/autopilot-queue.test.ts
 *
 * SECURITY / CORRECTNESS REGRESSION SUITE.
 *
 * WHAT THIS PROTECTS
 *
 * lib/autopilot/queue.ts claims jobs from public.jobs. Four things must
 * hold, and none of them is visible to a type checker:
 *
 *   1. The claim is a COMPARE-AND-SET. Two runners reading the same
 *      candidate both issue the update; only the one whose status
 *      predicate still matches may write. Drop that predicate and both
 *      believe they own the job, so the work runs twice -- and each run
 *      may cost a provider call.
 *
 *   2. A lease EXPIRES. A runner that crashes mid-job leaves status
 *      "running" and locked_at set forever. Without an expiry the row
 *      is stranded and the work silently never happens, which looks
 *      identical to success from outside the table.
 *
 *   3. Retries are BOUNDED by attempts already recorded, never by a
 *      caller's claim. A poison payload that loops forever spends money
 *      on every iteration.
 *
 *   4. Completion is scoped to the RUNNING job. A cancelled job that
 *      can still be completed makes cancellation advisory.
 *
 * AND ONE THING THIS FILE DELIBERATELY ASSERTS ABOUT ABSENCE
 *
 * queue.ts has no importer. That is normally the signature of dead
 * code -- this session deleted roughly 40,000 lines of exactly that.
 * Here it is the honest state of a blocked feature: the queue can be
 * filled and drained, but nothing calls it on a timer because this
 * deployment has no scheduler (no vercel.json, no cron, no external
 * worker, no Trigger.dev or Inngest account).
 *
 * The assertions below pin the parts that exist so they cannot rot
 * while the external gate stays shut, and pin the ABSENCE of a fake
 * scheduler so nobody satisfies the gap with a setInterval.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/**
 * Source with comments stripped.
 *
 * This file's own header names compare-and-set, the lease expiry and
 * setInterval. Guards in this repository have passed defects by
 * matching their own explanation, twice in this session alone.
 */
function executable(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("*"))
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const QUEUE = executable(
  readFileSync(join(ROOT, "lib", "autopilot", "queue.ts"), "utf8"),
);

const MIGRATION = readFileSync(
  join(
    ROOT,
    "supabase",
    "migrations",
    "20260910120000_syraven_jobs_lease_policy.sql",
  ),
  "utf8",
)
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .replace(/\s+/g, " ")
  .toLowerCase();

/* -------------------------------------------------------------------------- */
/*                    TWO RUNNERS CANNOT WIN THE SAME JOB                     */
/* -------------------------------------------------------------------------- */

void describe("The claim is a compare-and-set", () => {
  void test("the update is conditioned on the status it read", () => {
    assert.match(
      QUEUE,
      /\.eq\("id", candidate\.id\)\s*\.eq\("status", candidate\.status\)/,
      "Without the status predicate, two runners racing for one row " +
        "both write and both believe they own it. Postgres must " +
        "arbitrate, not this code.",
    );
  });

  void test("a lost race moves on rather than proceeding", () => {
    assert.match(
      QUEUE,
      /if \(claimError \|\| !claimed\) continue;/,
      "The loser of a race gets an empty result. Treating that as a " +
        "successful claim would run the job twice.",
    );
  });

  void test("the claimed job is read back from the write", () => {
    /*
     * The returned row must come from the UPDATE's own RETURNING, not
     * from the candidate read earlier. The candidate is a snapshot that
     * another runner may already have changed.
     */
    assert.match(
      QUEUE,
      /\.select\("id, type, payload, attempts, max_attempts"\)\s*\.maybeSingle\(\)/,
      "The claim must return the row it actually wrote.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                            A LEASE EXPIRES                                 */
/* -------------------------------------------------------------------------- */

void describe("A crashed runner does not strand a job forever", () => {
  void test("an expiry window is defined", () => {
    assert.match(
      QUEUE,
      /export const LEASE_MS = /,
      "Without an expiry, a runner that dies mid-job leaves the row " +
        "'running' forever and the work silently never happens.",
    );
  });

  void test("expired leases are reclaimable", () => {
    assert.match(
      QUEUE,
      /status\.eq\.running,locked_at\.lt\.\$\{leaseCutoff\}/,
      "A job whose lease has expired must be claimable again even " +
        "though its status is still 'running'.",
    );
  });

  void test("the cutoff is computed from the lease window", () => {
    assert.match(
      QUEUE,
      /now\.getTime\(\) - LEASE_MS/,
      "The cutoff must derive from LEASE_MS, or the constant is " +
        "decoration and the window is whatever was hardcoded.",
    );
  });

  void test("a completed job releases its lock", () => {
    assert.match(
      QUEUE,
      /status: "completed",[\s\S]{0,200}?locked_at: null,\s*locked_by: null/,
      "A finished job still holding a lease reads as work in progress.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                          RETRIES ARE BOUNDED                               */
/* -------------------------------------------------------------------------- */

void describe("A poison job cannot loop forever", () => {
  void test("attempts are checked before claiming", () => {
    assert.match(
      QUEUE,
      /candidate\.attempts >= candidate\.max_attempts/,
      "A job that has used its attempts must not be claimed again. " +
        "Each loop may spend a provider call.",
    );
  });

  void test("the attempt counter is incremented by the claim itself", () => {
    assert.match(
      QUEUE,
      /attempts: candidate\.attempts \+ 1/,
      "If the runner incremented attempts, a crash before that write " +
        "would make the job immortal.",
    );
  });

  void test("exhaustion is decided from recorded state", () => {
    assert.match(
      QUEUE,
      /const exhausted = current\.attempts >= current\.max_attempts;/,
      "Whether a failure may be retried must come from the row, never " +
        "from a caller's assertion.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                      COMPLETION RESPECTS CANCELLATION                      */
/* -------------------------------------------------------------------------- */

void describe("Only a running job may complete", () => {
  void test("completion is scoped to status running", () => {
    assert.match(
      QUEUE,
      /status: "completed",[\s\S]{0,400}?\.eq\("status", "running"\)/,
      "A cancelled job that can still be completed makes cancellation " +
        "advisory rather than binding.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/*                    NO FABRICATED EXECUTION SUBSTRATE                       */
/* -------------------------------------------------------------------------- */

void describe("The missing scheduler is not simulated", () => {
  void test("the queue starts no timer of its own", () => {
    /*
     * The tempting shortcut: a setInterval that drains the queue from
     * inside the Next.js process. It dies with the process, runs once
     * per instance, and produces a feature that works in development
     * and silently stops in production. That is a fabricated substrate,
     * not a durable one.
     */
    for (const fake of ["setInterval", "setTimeout", "cron.schedule"]) {
      assert.ok(
        !QUEUE.includes(fake),
        `${fake} in the queue would fake a scheduler. A durable ` +
          `substrate is an external trigger, and this deployment has ` +
          `none -- that gap is reported as blocked, not filled in.`,
      );
    }
  });

  void test("no scheduler configuration is claimed", () => {
    /*
     * If any of these appear later, the gate has genuinely moved and
     * this assertion should be updated deliberately -- not discovered
     * by a reader wondering why Autopilot never runs.
     */
    assert.ok(
      !existsSync(join(ROOT, "vercel.json")),
      "vercel.json now exists. If it defines a cron, Autopilot's " +
        "execution gate has moved and this suite must be revisited.",
    );
  });

  void test("queue depth is counted, never estimated", () => {
    for (const invented of ["healthScore", "estimatedWait", "throughput"]) {
      assert.ok(
        !QUEUE.includes(invented),
        `${invented} would be a figure this deployment cannot measure.`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                   THE LEASE POLICY CANNOT FORGE COMPLETION                 */
/* -------------------------------------------------------------------------- */

void describe("A client may cancel its own job, and nothing more", () => {
  void test("the policy exists and is an update policy", () => {
    assert.match(
      MIGRATION,
      /create policy "users can cancel own jobs" on public\.jobs for update/,
      "Without an update policy no authenticated caller can cancel " +
        "their own queued work.",
    );
  });

  void test("WITH CHECK pins the only reachable end state", () => {
    /*
     * The defect this prevents: "update your own queued job" is "set
     * your own job to completed" unless WITH CHECK says otherwise.
     * A caller able to write status='completed' can mark work done
     * that never ran.
     */
    assert.match(
      MIGRATION,
      /with check \( user_id = auth\.uid\(\) and status = 'cancelled' \)/,
      "Without this, a client can move its own job to 'completed' and " +
        "forge an outcome.",
    );
  });

  void test("USING excludes jobs that already finished", () => {
    assert.match(
      MIGRATION,
      /using \( user_id = auth\.uid\(\) and status in \('queued', 'retrying', 'running'\) \)/,
      "A finished job must not be re-openable by its owner.",
    );
  });

  void test("the policy is paired with a drop, so re-running is safe", () => {
    assert.match(
      MIGRATION,
      /drop policy if exists "users can cancel own jobs" on public\.jobs;/,
      "An unpaired create policy fails the second time it is applied.",
    );
  });

  void test("no broad update policy is granted", () => {
    /*
     * Leasing stays with trusted server code through the service-role
     * client, for the reason 20260906160000 gives about public.usage:
     * a queue whose workers are the metered party is not a queue.
     */
    assert.ok(
      !/for update[\s\S]*with check \( user_id = auth\.uid\(\) \)/.test(
        MIGRATION,
      ),
      "An unconstrained update policy would let a caller write " +
        "locked_by and steal another tenant's lease.",
    );
  });
});
