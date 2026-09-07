/**
 * SYRAVEN — Embedding ingestion cost and rate control
 * lib/search/ingestPolicy.ts
 *
 * Phase 12 follow-up, step 1 (ingestion cost/rate control).
 *
 * COST BOUNDARY.
 *
 * `lib/search/embedding.ts` decides WHETHER a provider can be called.
 * This module decides HOW OFTEN and HOW MUCH. They are separate concerns
 * and separate files, because the first is a correctness question and
 * this one is a spend question.
 *
 *
 * WHY THIS EXISTS
 *
 * `ingestChunk` is authorization-correct and idempotent, but it has no
 * ceiling of its own. A caller looping it is bounded only by how many
 * chunks they own, and each iteration is a paid provider call. Before
 * any route exposes ingestion, three limits must hold:
 *
 *   1. a per-user RATE limit  — how fast
 *   2. a per-batch SIZE limit — how much in one request
 *   3. a per-user VOLUME ceiling — how much in a rolling window
 *
 *
 * WHY THIS DOES NOT USE lib/usage/meter.ts's QUOTA PATH
 *
 * The obvious implementation is `recordUsage()` with a new metric. It
 * does not work, and the reason is a live production defect found while
 * auditing this step:
 *
 *   - `public.usage` has RLS enabled with SELECT policies ONLY. There is
 *     no INSERT policy, so every `recordUsage()` write is silently
 *     denied. Verified empirically against production: an insert as
 *     `authenticated` leaves zero rows.
 *
 *   - `usage.type` carries CHECK (type IN ('message','file')), but every
 *     metric in USAGE_METRICS writes a different value ('chat_message',
 *     'agent_run', 'vision_request', …). Even with an INSERT policy,
 *     those writes would violate the constraint.
 *
 * Both are pre-existing and affect all quota tracking, not just
 * ingestion. They are reported for approval rather than fixed here —
 * repairing them needs a production migration, which is out of scope for
 * this step.
 *
 * The consequence for THIS module is deliberate: the volume ceiling is
 * derived from `ai_knowledge_chunks` itself — counting chunks that
 * already carry an embedding — rather than from a usage ledger that
 * cannot currently be written. That is less precise (it counts stored
 * state, not attempts) but it is REAL, whereas a usage-based ceiling
 * would silently never trigger.
 *
 *
 * RELATIONSHIP TO THE RATE LIMITER
 *
 * `checkRateLimit()` in lib/usage/meter.ts DOES work — it reads and
 * writes `rate_limit_events`, whose RLS policies were repaired in
 * migration 20260906130000. It refuses any endpoint key it does not
 * recognise, so `embedding:ingest` must be declared in RATE_LIMITS or
 * every ingestion call is denied. That declaration lives in meter.ts
 * beside the others; this module supplies the key and the ceilings.
 */

import "server-only";

import type { AuthenticatedSession } from "@/lib/auth/session";

import { resolveAuthorizedDocuments } from "./semantic";

/* -------------------------------------------------------------------------- */
/*                                  CEILINGS                                  */
/* -------------------------------------------------------------------------- */

/**
 * Hard limits on embedding ingestion.
 *
 * These are SERVER constants, not configuration. A ceiling that can be
 * raised by an environment variable is a ceiling an ops mistake can
 * remove, and the failure mode here is money.
 */
export const INGEST_LIMITS = {
  /**
   * Rate-limit key. MUST exist in RATE_LIMITS (lib/usage/meter.ts) or
   * `checkRateLimit` fails closed and refuses every call.
   */
  rateLimitKey: "embedding:ingest",

  /**
   * Chunks accepted in a single batch request.
   *
   * Small deliberately. A batch is one authorization check amortised
   * over many paid calls, so a large batch is exactly where an
   * accounting mistake becomes expensive.
   */
  maxBatchSize: 10,

  /**
   * Chunks a single user may have embedded in the rolling window.
   *
   * This is the spend ceiling. At `text-embedding-3-small` list price
   * ($0.02 / 1M input tokens) and a ~500-token chunk, 1,000 chunks is
   * roughly $0.01 — so this is not primarily about the money at these
   * volumes. It bounds a runaway loop, which is the actual risk.
   */
  maxChunksPerWindow: 1_000,

  /** Rolling window for the volume ceiling. */
  windowHours: 24,

  /**
   * Longest chunk text sent to a provider, in characters.
   *
   * `EMBEDDING_POLICY.maxInputCharacters` (32,000) already bounds a
   * single call for correctness. This lower bound exists for cost:
   * embedding price scales with tokens, and a chunk far above normal
   * size is more likely a chunking bug than real content.
   */
  maxChunkCharacters: 8_000,
} as const;

/* -------------------------------------------------------------------------- */
/*                                  OUTCOMES                                  */
/* -------------------------------------------------------------------------- */

export type IngestDenialReason =
  /** Per-user burst limit exceeded. */
  | "RATE_LIMITED"
  /** Rolling-window volume ceiling reached. */
  | "VOLUME_CEILING"
  /** Batch larger than `maxBatchSize`. */
  | "BATCH_TOO_LARGE"
  /** Caller owns no knowledge documents. */
  | "NOT_AUTHORIZED"
  /** A ceiling could not be evaluated. Denies rather than assuming. */
  | "CHECK_FAILED";

export interface IngestDenial {
  readonly reason: IngestDenialReason;
  readonly clientMessage: string;
  /** HTTP status a route should reply with. */
  readonly status: number;
  readonly retryAfterSeconds?: number;
}

export type IngestPolicyOutcome =
  | { allowed: true; authorizedDocumentIds: readonly string[] }
  | { allowed: false; denial: IngestDenial };

/* -------------------------------------------------------------------------- */
/*                               BATCH VALIDATION                             */
/* -------------------------------------------------------------------------- */

/**
 * Validates a requested batch BEFORE any authorization or provider work.
 *
 * Cheapest check first: an oversized batch is rejected without touching
 * the database, so a caller cannot use batch size to amplify load.
 *
 * Duplicate ids are collapsed. Without that, a batch of the same chunk
 * repeated ten times would pass a size check and then be embedded ten
 * times — the batch limit would bound the array length, not the spend.
 */
export function validateIngestBatch(
  chunkIds: unknown,
): { ok: true; chunkIds: string[] } | { ok: false; denial: IngestDenial } {
  if (!Array.isArray(chunkIds) || chunkIds.length === 0) {
    return {
      ok: false,
      denial: {
        reason: "BATCH_TOO_LARGE",
        clientMessage: "Provide between 1 and 10 chunk ids.",
        status: 400,
      },
    };
  }

  const unique = Array.from(
    new Set(
      chunkIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  );

  if (unique.length === 0 || unique.length > INGEST_LIMITS.maxBatchSize) {
    return {
      ok: false,
      denial: {
        reason: "BATCH_TOO_LARGE",
        clientMessage: `Provide between 1 and ${INGEST_LIMITS.maxBatchSize} chunk ids.`,
        status: 400,
      },
    };
  }

  return { ok: true, chunkIds: unique };
}

/* -------------------------------------------------------------------------- */
/*                              CLIENT SHAPE                                  */
/* -------------------------------------------------------------------------- */

interface PolicyQueryBuilder {
  select(
    columns: string,
    options?: { count: "exact"; head: true },
  ): PolicyQueryBuilder;
  in(column: string, values: readonly string[]): PolicyQueryBuilder;
  not(column: string, operator: string, value: null): PolicyQueryBuilder;
  gte(column: string, value: string): PolicyQueryBuilder;
  then<TResult>(
    onfulfilled: (value: {
      count: number | null;
      error: { message: string } | null;
    }) => TResult,
  ): Promise<TResult>;
}

interface PolicyCapableClient {
  from(table: string): PolicyQueryBuilder;
}

/* -------------------------------------------------------------------------- */
/*                              VOLUME CEILING                                */
/* -------------------------------------------------------------------------- */

/**
 * Counts chunks the caller has already had embedded in the window.
 *
 * Scoped to the caller's authorized documents, so it cannot see or count
 * another tenant's ingestion. It reads through `session.supabase`, so
 * RLS applies as a second layer.
 *
 * Counts STORED STATE (`embedding is not null`) rather than attempts.
 * The trade-off is explicit: a failed provider call costs money but
 * stores nothing, so it is not counted here. A usage-ledger approach
 * would capture attempts, and should replace this once `public.usage`
 * is repaired — see the module header.
 */
async function countEmbeddedInWindow(
  session: AuthenticatedSession,
  documentIds: readonly string[],
): Promise<{ ok: true; count: number } | { ok: false }> {
  const since = new Date(
    Date.now() - INGEST_LIMITS.windowHours * 60 * 60 * 1000,
  ).toISOString();

  const client = session.supabase as unknown as PolicyCapableClient;

  const { count, error } = await client
    .from("ai_knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .in("knowledge_document_id", documentIds)
    .not("embedding", "is", null)
    .gte("created_at", since);

  if (error) {
    console.error("SYRAVEN INGEST POLICY: volume count failed.", {
      userId: session.userId,
      error: error.message,
    });
    return { ok: false };
  }

  return { ok: true, count: count ?? 0 };
}

/* -------------------------------------------------------------------------- */
/*                                 ENFORCEMENT                                */
/* -------------------------------------------------------------------------- */

/**
 * The gate every ingestion path must pass.
 *
 * ORDER IS DELIBERATE — cheapest and most protective first:
 *
 *   1. Authorization scope. A caller who owns nothing is refused before
 *      any counting, and the resolved allowlist is handed back so the
 *      caller does not resolve it twice.
 *   2. Volume ceiling, scoped to that allowlist.
 *
 * The BURST rate limit is applied by the caller through
 * `checkRateLimit(db, userId, INGEST_LIMITS.rateLimitKey)` before this
 * function, because that path also RECORDS the event and belongs with
 * the request lifecycle rather than here.
 *
 * Every failure path DENIES. A ceiling that cannot be evaluated returns
 * `CHECK_FAILED` rather than assuming the caller is under it — the
 * opposite would make a database hiccup into unlimited spend.
 */
export async function enforceIngestPolicy(
  session: AuthenticatedSession,
  requestedChunks: number,
): Promise<IngestPolicyOutcome> {
  if (
    !Number.isFinite(requestedChunks) ||
    requestedChunks < 1 ||
    requestedChunks > INGEST_LIMITS.maxBatchSize
  ) {
    return {
      allowed: false,
      denial: {
        reason: "BATCH_TOO_LARGE",
        clientMessage: `Provide between 1 and ${INGEST_LIMITS.maxBatchSize} chunk ids.`,
        status: 400,
      },
    };
  }

  const authorized = await resolveAuthorizedDocuments(session, null);

  if (!authorized.ok) {
    return {
      allowed: false,
      denial: {
        reason: "CHECK_FAILED",
        clientMessage: "Indexing is temporarily unavailable.",
        status: 503,
      },
    };
  }

  if (authorized.documentIds.length === 0) {
    return {
      allowed: false,
      denial: {
        reason: "NOT_AUTHORIZED",
        clientMessage: "The requested content is unavailable.",
        status: 404,
      },
    };
  }

  const embedded = await countEmbeddedInWindow(
    session,
    authorized.documentIds,
  );

  if (!embedded.ok) {
    return {
      allowed: false,
      denial: {
        reason: "CHECK_FAILED",
        clientMessage: "Indexing is temporarily unavailable.",
        status: 503,
      },
    };
  }

  /*
   * The requested batch must fit ENTIRELY under the ceiling. Admitting a
   * partial batch would let a caller sit exactly at the limit and creep
   * past it one chunk at a time.
   */
  if (
    embedded.count + requestedChunks >
    INGEST_LIMITS.maxChunksPerWindow
  ) {
    return {
      allowed: false,
      denial: {
        reason: "VOLUME_CEILING",
        clientMessage:
          "Indexing limit reached for today. Please try again later.",
        status: 429,
        retryAfterSeconds: INGEST_LIMITS.windowHours * 60 * 60,
      },
    };
  }

  return { allowed: true, authorizedDocumentIds: authorized.documentIds };
}

/* -------------------------------------------------------------------------- */
/*                              CONTENT CEILING                               */
/* -------------------------------------------------------------------------- */

/**
 * Whether a chunk's text is within the cost ceiling.
 *
 * Applied per chunk immediately before the provider call. Returning
 * false skips that chunk rather than failing the batch: one oversized
 * chunk is a data problem, not a reason to abandon nine good ones.
 */
export function isWithinContentCeiling(content: string): boolean {
  return (
    typeof content === "string" &&
    content.trim().length > 0 &&
    content.length <= INGEST_LIMITS.maxChunkCharacters
  );
}
