/**
 * SYRAVEN Document Reader
 * Plain text document extraction
 *
 * Supports:
 * - TXT
 * - Markdown
 * - JSON
 * - CSV
 */

export interface ReadTextOptions {
  /**
   * Maximum file size in bytes.
   * Default: 50 MB
   */
  maxFileSize?: number;

  /**
   * Text encoding.
   * Default: utf-8
   */
  encoding?: string;

  /**
   * Normalize whitespace.
   * Default: true
   */
  normalizeWhitespace?: boolean;

  /**
   * Preserve line breaks.
   * Default: true
   */
  preserveLineBreaks?: boolean;

  /**
   * Trim final output.
   * Default: true
   */
  trim?: boolean;
}

export interface ReadTextResult {
  /**
   * Extracted text.
   */
  text: string;

  /**
   * Original file size in bytes.
   */
  fileSize: number;

  /**
   * Character count.
   */
  characterCount: number;

  /**
   * Word count.
   */
  wordCount: number;

  /**
   * Detected or supplied content type.
   */
  contentType?: string;

  /**
   * Text encoding used.
   */
  encoding: string;
}

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;
const DEFAULT_ENCODING = "utf-8";

/* -------------------------------------------------------------------------- */
/*                               TEXT HELPERS                                 */
/* -------------------------------------------------------------------------- */

function countWords(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).filter(Boolean).length;
}

function normalizeText(
  value: string,
  options: {
    normalizeWhitespace: boolean;
    preserveLineBreaks: boolean;
    trim: boolean;
  },
): string {
  let text = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "");

  if (options.normalizeWhitespace) {
    if (options.preserveLineBreaks) {
      text = text
        .replace(/[ \t]+/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
    } else {
      text = text.replace(/\s+/g, " ");
    }
  }

  return options.trim ? text.trim() : text;
}

function isSupportedEncoding(encoding: string): boolean {
  const normalized = encoding.toLowerCase();

  return [
    "utf-8",
    "utf8",
    "utf-16",
    "utf-16le",
    "utf16le",
    "ascii",
    "latin1",
    "binary",
  ].includes(normalized);
}

function normalizeEncoding(encoding: string): string {
  const normalized = encoding.toLowerCase();

  switch (normalized) {
    case "utf8":
      return "utf-8";

    case "utf16le":
      return "utf-16le";

    default:
      return normalized;
  }
}

/* -------------------------------------------------------------------------- */
/*                              RESPONSE READER                               */
/* -------------------------------------------------------------------------- */

async function responseToBuffer(
  response: Response,
): Promise<Buffer> {
  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

/* -------------------------------------------------------------------------- */
/*                                MAIN READER                                 */
/* -------------------------------------------------------------------------- */

/**
 * Reads plain text content from a Response.
 *
 * Designed to work with the central document-reader pipeline.
 */
export async function readText(
  input: Response,
  options: ReadTextOptions = {},
): Promise<ReadTextResult> {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    encoding = DEFAULT_ENCODING,
    normalizeWhitespace = true,
    preserveLineBreaks = true,
    trim = true,
  } = options;

  if (!(input instanceof Response)) {
    throw new TypeError(
      "readText expects a Response object.",
    );
  }

  if (
    !Number.isFinite(maxFileSize) ||
    maxFileSize <= 0
  ) {
    throw new TypeError(
      "maxFileSize must be a positive number.",
    );
  }

  const normalizedEncoding = normalizeEncoding(encoding);

  if (!isSupportedEncoding(normalizedEncoding)) {
    throw new TypeError(
      `Unsupported text encoding: ${encoding}`,
    );
  }

  const contentType =
    input.headers.get("content-type") ?? undefined;

  const buffer = await responseToBuffer(input);

  if (buffer.length > maxFileSize) {
    throw new Error(
      `Text file exceeds maximum allowed size of ${Math.round(
        maxFileSize / 1024 / 1024,
      )} MB.`,
    );
  }

  let rawText: string;

  try {
    rawText = buffer.toString(
      normalizedEncoding as BufferEncoding,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown decoding error.";

    throw new Error(
      `Failed to decode text document: ${message}`,
    );
  }

  const text = normalizeText(rawText, {
    normalizeWhitespace,
    preserveLineBreaks,
    trim,
  });

  return {
    text,
    fileSize: buffer.length,
    characterCount: text.length,
    wordCount: countWords(text),
    ...(contentType ? { contentType } : {}),
    encoding: normalizedEncoding,
  };
}

/* -------------------------------------------------------------------------- */
/*                            CONVENIENCE API                                 */
/* -------------------------------------------------------------------------- */

/**
 * Extract only text from a Response.
 */
export async function extractText(
  input: Response,
): Promise<string> {
  const result = await readText(input);

  return result.text;
}

/**
 * Checks whether a Response appears to contain text.
 */
export function isTextResponse(
  input: Response,
): boolean {
  const contentType =
    input.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  return (
    contentType.startsWith("text/") ||
    contentType.includes("json") ||
    contentType.includes("csv") ||
    contentType.includes("xml")
  );
}

/**
 * Estimates whether binary data is likely text.
 */
export function isLikelyTextBuffer(
  input: Buffer | Uint8Array | ArrayBuffer,
): boolean {
  let bytes: Uint8Array;

  if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = new Uint8Array(
      input.buffer,
      input.byteOffset,
      input.byteLength,
    );
  }

  if (bytes.length === 0) {
    return true;
  }

  const sampleSize = Math.min(
    bytes.length,
    4096,
  );

  let suspiciousBytes = 0;

  for (let index = 0; index < sampleSize; index++) {
    const value = bytes[index];

    if (
      value !== undefined &&
      (
        value === 0 ||
        (value < 7 && value !== 0)
      )
    ) {
      suspiciousBytes++;
    }
  }

  return suspiciousBytes / sampleSize < 0.05;
}

/* -------------------------------------------------------------------------- */
/*                               DEFAULT EXPORT                               */
/* -------------------------------------------------------------------------- */

export default readText;