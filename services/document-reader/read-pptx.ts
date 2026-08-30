/**
 * SYRAVEN Document Reader
 * PPTX document text extraction
 *
 * Production-safe PowerPoint parser.
 */

import pptx2json from "pptx2json";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface ReadPptxOptions {
  maxFileSize?: number;
  maxSlides?: number;
  preserveLineBreaks?: boolean;
  normalizeWhitespace?: boolean;
}

export interface PptxSlideResult {
  index: number;
  title?: string;
  text: string;
  characterCount: number;
  wordCount: number;
}

export interface ReadPptxResult {
  text: string;
  slideCount: number;
  slides: PptxSlideResult[];
  fileSize: number;
  characterCount: number;
  wordCount: number;
}

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024;

/* -------------------------------------------------------------------------- */
/*                              TEXT UTILITIES                                */
/* -------------------------------------------------------------------------- */

function normalizeText(
  value: string,
  preserveLineBreaks: boolean,
  normalizeWhitespace: boolean
): string {
  let text = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (normalizeWhitespace) {
    if (preserveLineBreaks) {
      text = text
        .replace(/[ \t]+/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
    } else {
      text = text.replace(/\s+/g, " ");
    }
  }

  return text.trim();
}

function countWords(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).filter(Boolean).length;
}

/* -------------------------------------------------------------------------- */
/*                            VALUE EXTRACTION                                */
/* -------------------------------------------------------------------------- */

function collectText(
  value: unknown,
  results: string[]
): void {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed) {
      results.push(trimmed);
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, results);
    }

    return;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const record = value as Record<string, unknown>;

    const priorityKeys = [
      "text",
      "content",
      "value",
      "title",
      "name",
    ];

    for (const key of priorityKeys) {
      if (typeof record[key] === "string") {
        collectText(record[key], results);
      }
    }

    const childKeys = [
      "textRuns",
      "runs",
      "paragraphs",
      "shapes",
      "elements",
      "children",
      "objects",
      "items",
    ];

    for (const key of childKeys) {
      if (record[key] !== undefined) {
        collectText(record[key], results);
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                              RESPONSE INPUT                                */
/* -------------------------------------------------------------------------- */

async function responseToBuffer(
  response: Response
): Promise<Buffer> {
  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

/* -------------------------------------------------------------------------- */
/*                              PPTX PARSING                                   */
/* -------------------------------------------------------------------------- */

async function parsePptx(
  buffer: Buffer
): Promise<unknown> {
  const parser = pptx2json as unknown as Record<
    string,
    unknown
  >;

  /*
   * Different pptx2json versions expose different APIs.
   * Try the known parser entry points safely.
   */

  if (typeof parser.parse === "function") {
    return await (
      parser.parse as (
        input: Buffer
      ) => Promise<unknown>
    )(buffer);
  }

  if (typeof parser.convert === "function") {
    return await (
      parser.convert as (
        input: Buffer
      ) => Promise<unknown>
    )(buffer);
  }

  if (typeof pptx2json === "function") {
    return await (
      pptx2json as unknown as (
        input: Buffer
      ) => Promise<unknown>
    )(buffer);
  }

  throw new Error(
    "Unsupported pptx2json API. Expected parse(), convert(), or callable module."
  );
}

/* -------------------------------------------------------------------------- */
/*                             MAIN READER                                    */
/* -------------------------------------------------------------------------- */

/**
 * Extract text from a PPTX document.
 *
 * Input is Response to remain compatible with the central
 * document-reader/index.ts pipeline.
 */
export async function readPptx(
  input: Response,
  options: ReadPptxOptions = {}
): Promise<ReadPptxResult> {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    maxSlides,
    preserveLineBreaks = true,
    normalizeWhitespace = true,
  } = options;

  if (!(input instanceof Response)) {
    throw new TypeError(
      "readPptx expects a Response object."
    );
  }

  const buffer = await responseToBuffer(input);

  if (buffer.length === 0) {
    throw new Error("PPTX file is empty.");
  }

  if (buffer.length > maxFileSize) {
    throw new Error(
      `PPTX file exceeds maximum allowed size of ${Math.round(
        maxFileSize / 1024 / 1024
      )} MB.`
    );
  }

  if (
    maxSlides !== undefined &&
    (!Number.isInteger(maxSlides) ||
      maxSlides <= 0)
  ) {
    throw new TypeError(
      "maxSlides must be a positive integer."
    );
  }

  try {
    const parsed = await parsePptx(buffer);

    const parsedRecord =
      parsed &&
      typeof parsed === "object"
        ? parsed as Record<string, unknown>
        : {};

    let rawSlides: unknown[] = [];

    if (Array.isArray(parsed)) {
      rawSlides = parsed;
    } else if (Array.isArray(parsedRecord.slides)) {
      rawSlides = parsedRecord.slides;
    } else if (Array.isArray(parsedRecord.data)) {
      rawSlides = parsedRecord.data;
    }

    if (maxSlides) {
      rawSlides = rawSlides.slice(
        0,
        maxSlides
      );
    }

    const slides: PptxSlideResult[] =
      rawSlides.map((slide, index) => {
        const fragments: string[] = [];

        collectText(slide, fragments);

        const rawText = fragments.join("\n");

        const text = normalizeText(
          rawText,
          preserveLineBreaks,
          normalizeWhitespace
        );

        const slideRecord =
          slide &&
          typeof slide === "object"
            ? slide as Record<string, unknown>
            : {};

        const title =
          typeof slideRecord.title === "string"
            ? slideRecord.title
            : undefined;

        return {
          index: index + 1,
          ...(title ? { title } : {}),
          text,
          characterCount: text.length,
          wordCount: countWords(text),
        };
      });

    const text = slides
      .map((slide) => slide.text)
      .filter(Boolean)
      .join("\n\n");

    return {
      text,
      slideCount: slides.length,
      slides,
      fileSize: buffer.length,
      characterCount: text.length,
      wordCount: countWords(text),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown PPTX parsing error.";

    throw new Error(
      `Failed to read PPTX document: ${message}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                            CONVENIENCE API                                 */
/* -------------------------------------------------------------------------- */

export async function extractPptxText(
  input: Response
): Promise<string> {
  const result = await readPptx(input);

  return result.text;
}

/**
 * Lightweight ZIP signature validation.
 * PPTX files are ZIP-based containers.
 */
export async function isLikelyPptx(
  input: Response
): Promise<boolean> {
  const clone = input.clone();

  const arrayBuffer =
    await clone.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 4) {
    return false;
  }

  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b
  );
}

/* -------------------------------------------------------------------------- */
/*                               DEFAULT EXPORT                               */
/* -------------------------------------------------------------------------- */

export default readPptx;