/**
 * SYRAVEN — how a Brain record becomes indexable passages
 * lib/search/knowledgeIndex.ts
 *
 * PURE. No I/O, no provider, no server imports. Everything here is a
 * deterministic function of a record's own text, so the rules that
 * decide what reaches an embedding provider can be executed in a test
 * rather than only read.
 *
 * WHY THIS EXISTS
 *
 * Semantic retrieval (semantic.ts) and embedding ingestion (ingest.ts)
 * both work on public.ai_knowledge_chunks, and nothing in the product
 * ever wrote a chunk. The Brain's records live in public.knowledge. This
 * module is the half of the bridge that decides WHAT is written; the
 * I/O half is knowledgeBridge.ts.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * Summaries, keywords, "enriched" text. A passage is a slice of what the
 * user wrote -- nothing is generated, so nothing retrieved can be
 * something the user never said.
 */

import { createHash } from "node:crypto";

/* -------------------------------------------------------------------------- */
/*                                   POLICY                                   */
/* -------------------------------------------------------------------------- */

/**
 * Passage sizing.
 *
 * `targetCharacters` must stay at or below INGEST_LIMITS.maxChunkCharacters
 * (8,000) in ingestPolicy.ts, or ingestChunk refuses every passage as
 * over the cost ceiling. A test reads both values and keeps them in step.
 *
 * `maxChunksPerRecord` bounds one record's spend and write volume. A
 * record longer than this is refused as too large rather than indexed in
 * part: a half-indexed record would answer for its first pages and stay
 * silent about the rest, which reads as "not in the Brain" when it is.
 */
export const CHUNK_POLICY = {
  targetCharacters: 1_500,
  overlapCharacters: 200,
  maxChunksPerRecord: 40,
} as const;

/** The one knowledge base per user that holds Brain records. */
export const BRAIN_BASE_SLUG = "syraven-brain";

/* -------------------------------------------------------------------------- */
/*                                    TEXT                                    */
/* -------------------------------------------------------------------------- */

export interface IndexableRecord {
  readonly title: string;
  readonly description: string | null;
  readonly content: string | null;
}

/** Line endings and runs of blank space collapsed; meaning untouched. */
export function normaliseText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The text a record is indexed by: its title, description and content,
 * in that order.
 *
 * The title is included because it is often the most specific thing the
 * user wrote about the record -- a query for "pricing decision" should
 * find a note titled that even if its body never repeats the words.
 */
export function indexableText(record: IndexableRecord): string {
  return [record.title, record.description ?? "", record.content ?? ""]
    .map(normaliseText)
    .filter((part) => part.length > 0)
    .join("\n\n");
}

/**
 * Fingerprint of the indexed text.
 *
 * Stored on the document so an unchanged record is never re-embedded:
 * same text, same hash, no provider call.
 */
export function contentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/* -------------------------------------------------------------------------- */
/*                                  CHUNKING                                  */
/* -------------------------------------------------------------------------- */

export type ChunkPlan =
  | { ok: true; chunks: string[] }
  | { ok: false; reason: "EMPTY" | "TOO_LARGE" };

/**
 * Where a passage starting at `start` should end.
 *
 * Prefers a paragraph break, then a line break, then a sentence end,
 * then a space -- but never earlier than half a passage, so a stray
 * early newline cannot produce a string of tiny passages.
 */
function breakPoint(text: string, start: number, hardEnd: number): number {
  if (hardEnd >= text.length) return text.length;

  const floor = start + Math.floor(CHUNK_POLICY.targetCharacters / 2);

  for (const separator of ["\n\n", "\n", ". ", " "]) {
    const at = text.lastIndexOf(separator, hardEnd - separator.length);
    if (at >= floor) return at + separator.length;
  }

  return hardEnd;
}

/**
 * Where the next passage starts: a little before the previous one ended,
 * on a word boundary, so a sentence cut at a boundary is still whole in
 * one of the two passages.
 *
 * Always strictly after `previousStart`, which is what guarantees the
 * loop in `chunkText` terminates.
 */
function nextStart(text: string, previousStart: number, end: number): number {
  if (end >= text.length) return text.length;

  const desired = end - CHUNK_POLICY.overlapCharacters;
  if (desired <= previousStart) return end;

  const space = text.indexOf(" ", desired);
  const candidate = space !== -1 && space < end ? space + 1 : desired;

  return candidate > previousStart ? candidate : end;
}

/**
 * Splits text into passages of at most `targetCharacters`.
 *
 * Every character of the input lies in at least one passage -- the next
 * passage always starts at or before the previous one ended -- so
 * nothing the user wrote is silently left out of the index.
 */
export function chunkText(text: string): ChunkPlan {
  const normalised = normaliseText(text);

  if (normalised.length === 0) return { ok: false, reason: "EMPTY" };

  const chunks: string[] = [];
  let start = 0;

  while (start < normalised.length) {
    const end = breakPoint(
      normalised,
      start,
      Math.min(start + CHUNK_POLICY.targetCharacters, normalised.length),
    );

    const piece = normalised.slice(start, end).trim();

    if (piece.length > 0) {
      if (chunks.length === CHUNK_POLICY.maxChunksPerRecord) {
        return { ok: false, reason: "TOO_LARGE" };
      }

      chunks.push(piece);
    }

    start = nextStart(normalised, start, end);
  }

  return { ok: true, chunks };
}
