import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/*
  SYRAVEN — Autopilot work queue

  WHAT THIS IS

  The claim/lease half of a durable job queue, built on public.jobs --
  a table that already exists, with every column a queue needs:
  status, priority, scheduled_for, attempts, max_attempts, locked_at,
  locked_by, payload, result, error. jobs_queue_idx is already ordered
  (status, priority desc, scheduled_for asc), which is exactly a queue
  scan.

  WHAT THIS IS NOT, AND WILL NOT PRETEND TO BE

  Autopilot is NOT complete because this file exists.

  A queue needs something to drain it. This deployment has no scheduler:
  no vercel.json, no cron entry, no external worker, no Trigger.dev or
  Inngest account. Nothing calls claimNextJob() on a timer, and nothing
  here creates that timer, because a setInterval inside a Next.js route
  is not a durable execution substrate -- it dies with the process and
  runs once per instance.

  So this module is the part that CAN be built and proven without an
  external dependency. The part that cannot is named in the report as
  blocked, not quietly simulated.

  WHY SERVICE ROLE

  A runner does not execute inside any user's session. There is no
  auth.uid() to scope a lease to, so the claim runs through the
  service-role client -- the same shape lib/usage/meter.ts uses for the
  metering ledger, and for the same reason: a row the metered party must
  not write themselves.

  That is a deliberate boundary, not a shortcut:

    - claimNextJob never takes a user id from a caller. It claims
      whatever the queue offers next, and the job's own payload carries
      the identity the work will run as.
    - Nothing here SERVES user data. It moves rows between queue states.
    - public.jobs still has RLS enabled, and the accompanying migration
      narrows what an authenticated caller may update to cancelling
      their own unfinished job.

  THE LEASE

  A claim is a compare-and-set on BOTH the status and the lease it read.
  Status alone is enough for a queued or retrying job, because the claim
  moves it to running. It is not enough for an expired lease: that row
  is already 'running', so 'running -> running' would match for every
  runner that read it. Pinning locked_at to the value this runner saw
  means the first claim rewrites it and every later claim compares
  against a value that no longer exists. Postgres arbitrates; this code
  holds no lock of its own.
*/

/** Queue states, mirroring the CHECK constraint on public.jobs.status. */
export const JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "retrying",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** States a runner may pick up. */
const CLAIMABLE: readonly JobStatus[] = ["queued", "retrying"];

/**
 * States a job can still leave.
 *
 * completed, failed and cancelled are final. A write that could move a
 * job out of one of them -- most importantly out of 'cancelled' -- would
 * make that state advisory.
 */
const OPEN: readonly JobStatus[] = ["queued", "retrying", "running"];

/**
 * How long a lease is honoured before another runner may steal it.
 *
 * A runner that crashes mid-job leaves locked_at set and status
 * "running" forever. Without an expiry the row is stranded and the work
 * silently never happens -- which looks identical to success from the
 * outside, and is the failure this constant exists to prevent.
 */
export const LEASE_MS = 5 * 60 * 1000;

export interface ClaimedJob {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly attempts: number;
  readonly maxAttempts: number;
}

/**
 * Claims the next runnable job, or returns null when the queue is empty.
 *
 * @param runnerId Identifies which runner holds the lease. Recorded in
 *                 locked_by so a stranded job can be traced to the
 *                 process that took it, and so only that runner may
 *                 complete it.
 * @param now      Injectable for tests. Never read from a request.
 */
export async function claimNextJob(
  runnerId: string,
  now: Date = new Date(),
): Promise<ClaimedJob | null> {
  const nowIso = now.toISOString();
  const leaseCutoff = new Date(now.getTime() - LEASE_MS).toISOString();

  /*
    Candidates: claimable, due, and not already leased by a live runner.

    `scheduled_for` null means "as soon as possible"; a future value
    means the job is not due yet. A row whose lease has expired is
    reclaimable even though its status is "running", because the runner
    that held it is gone.
  */
  const { data: candidates, error: readError } = await supabaseAdmin
    .from("jobs")
    .select("id, type, payload, attempts, max_attempts, status, locked_at")
    .or(
      `status.in.(${CLAIMABLE.join(",")}),` +
        `and(status.eq.running,locked_at.lt.${leaseCutoff})`,
    )
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
    .order("priority", { ascending: false })
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .limit(10);

  if (readError || !candidates || candidates.length === 0) return null;

  for (const candidate of candidates) {
    /*
      Retries are bounded here, not by the runner. A job that has
      already used its attempts is failed permanently rather than
      claimed again -- otherwise a poison payload loops forever, and
      each loop may cost a provider call.
    */
    if (candidate.attempts >= candidate.max_attempts) {
      await failJob(
        candidate.id,
        { reason: "MAX_ATTEMPTS_EXCEEDED", attempts: candidate.attempts },
        now,
      );
      continue;
    }

    let claim = supabaseAdmin
      .from("jobs")
      .update({
        status: "running",
        locked_at: nowIso,
        locked_by: runnerId,
        started_at: nowIso,
        attempts: candidate.attempts + 1,
        updated_at: nowIso,
      })
      .eq("id", candidate.id)
      .eq("status", candidate.status);

    /*
      THE LEASE IS PART OF THE COMPARE.

      Without this, two runners that both read an expired 'running' row
      would both match 'status = running' and both believe they own it,
      and the work would run twice.
    */
    claim =
      candidate.locked_at === null
        ? claim.is("locked_at", null)
        : claim.eq("locked_at", candidate.locked_at);

    const { data: claimed, error: claimError } = await claim
      .select("id, type, payload, attempts, max_attempts")
      .maybeSingle();

    if (claimError || !claimed) continue;

    return {
      id: claimed.id,
      type: claimed.type,
      payload: claimed.payload,
      attempts: claimed.attempts,
      maxAttempts: claimed.max_attempts,
    };
  }

  return null;
}

/**
 * Records a successful outcome and releases the lease.
 *
 * Scoped to the runner that holds the lease. A runner whose lease
 * expired and was reclaimed by another must not report an outcome for
 * work the other runner now owns -- that is one job with two authors.
 *
 * The lease columns are cleared deliberately: a completed job holding a
 * lock reads as work in progress to anyone inspecting the table.
 */
export async function completeJob(
  jobId: string,
  runnerId: string,
  result: unknown,
  now: Date = new Date(),
): Promise<boolean> {
  const nowIso = now.toISOString();

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .update({
      status: "completed",
      result: result as never,
      completed_at: nowIso,
      locked_at: null,
      locked_by: null,
      updated_at: nowIso,
    })
    .eq("id", jobId)
    /* Only the running job may complete: a cancelled one must stay so. */
    .eq("status", "running")
    .eq("locked_by", runnerId)
    .select("id")
    .maybeSingle();

  return !error && data !== null;
}

/**
 * Records a failure, and decides whether the job may be retried.
 *
 * Retryable failures return to "retrying" so the next scan picks them
 * up; exhausted ones become "failed" permanently. The distinction is
 * made from attempts already recorded, never from a caller's claim.
 *
 * Only an OPEN job can fail. Without that predicate, a job the user
 * cancelled while it ran would be moved back to 'retrying' by its
 * runner's failure report and then claimed again -- cancellation
 * silently undone.
 *
 * @param runnerId When given, the failure is only recorded if that
 *                 runner still holds the lease.
 */
export async function failJob(
  jobId: string,
  error: unknown,
  now: Date = new Date(),
  runnerId?: string,
): Promise<boolean> {
  const nowIso = now.toISOString();

  const { data: current } = await supabaseAdmin
    .from("jobs")
    .select("attempts, max_attempts")
    .eq("id", jobId)
    .maybeSingle();

  if (!current) return false;

  const exhausted = current.attempts >= current.max_attempts;

  let write = supabaseAdmin
    .from("jobs")
    .update({
      status: exhausted ? "failed" : "retrying",
      error: error as never,
      completed_at: exhausted ? nowIso : null,
      locked_at: null,
      locked_by: null,
      updated_at: nowIso,
    })
    .eq("id", jobId)
    .in("status", [...OPEN]);

  if (runnerId !== undefined) write = write.eq("locked_by", runnerId);

  const { data, error: writeError } = await write.select("id").maybeSingle();

  return !writeError && data !== null;
}

/**
 * Counts jobs by status.
 *
 * One exact count per status, computed by the database. Selecting the
 * rows and counting them here would be wrong past 1,000 jobs: PostgREST
 * caps a response at that many rows, so the totals would stop growing
 * while reading as complete. A queue depth is a fact, and a truncated
 * one is an estimate presented as a measurement.
 */
export async function queueDepth(): Promise<Record<JobStatus, number> | null> {
  const counts = await Promise.all(
    JOB_STATUSES.map(async (status) => {
      const { count, error } = await supabaseAdmin
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", status);

      return error || count === null ? null : count;
    }),
  );

  const depth = {} as Record<JobStatus, number>;

  for (const [index, status] of JOB_STATUSES.entries()) {
    const count = counts[index];

    /* One failed count makes the whole picture unknown, not zero. */
    if (count === null || count === undefined) return null;

    depth[status] = count;
  }

  return depth;
}
