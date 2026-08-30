/**
 * SYRAVEN Document Reader
 * DOCX document text extraction
 *
 * Production-grade DOCX parser.
 */

import mammoth from "mammoth";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface ReadDocxOptions {
  /**
   * Maximum input file size in bytes.
   * Default: 50 MB
   */
  maxFileSize?: number;

  /**
   * Include basic metadata where available.
   */
  includeMetadata?: boolean;

  /**
   * Preserve empty lines where possible.
   */
  preserveLineBreaks?: boolean;
}

export interface DocxMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  description?: string;
}

export interface ReadDocxResult {
  /**
   * Extracted plain text.
   */
  text: string;

  /**
   * Parser warnings/messages.
   */
  warnings: string[];

  /**
   * Basic document metadata.
   */
  metadata?: DocxMetadata;

  /**
   * File information.
   */
  fileSize: number;

  /**
   * Number of extracted characters.
   */
  characterCount: number;

  /**
   * Number of detected words.
   */
  wordCount: number;
}

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/* -------------------------------------------------------------------------- */
/*                               INPUT VALIDATION                             */
/* -------------------------------------------------------------------------- */

function normalizeToBuffer(
  input: Buffer | Uint8Array | ArrayBuffer
): Buffer {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (input instanceof Uint8Array) {
    return Buffer.from(
      input.buffer,
      input.byteOffset,
      input.byteLength
    );
  }

  if (input instanceof ArrayBuffer) {
    return Buffer.from(input);
  }

  throw new TypeError(
    "Unsupported DOCX input type. Expected Buffer, Uint8Array, or ArrayBuffer."
  );
}

/* -------------------------------------------------------------------------- */
/*                              TEXT PROCESSING                               */
/* -------------------------------------------------------------------------- */

function normalizeText(
  text: string,
  preserveLineBreaks: boolean
): string {
  if (!text) {
    return "";
  }

  let normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (!preserveLineBreaks) {
    normalized = normalized
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  return normalized.trim();
}

function countWords(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).filter(Boolean).length;
}

/* -------------------------------------------------------------------------- */
/*                              MESSAGE NORMALIZER                            */
/* -------------------------------------------------------------------------- */

function normalizeWarnings(
  messages: Array<{
    type?: string;
    message?: string;
  }>
): string[] {
  return messages
    .map((message) => {
      const type = message.type
        ? `[${message.type}] `
        : "";

      return `${type}${message.message ?? "Unknown parser warning"}`;
    })
    .filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/*                                MAIN READER                                 */
/* -------------------------------------------------------------------------- */

/**
 * Extract plain text from a DOCX document.
 *
 * Supports:
 * - Buffer
 * - Uint8Array
 * - ArrayBuffer
 *
 * Returns normalized text and parser warnings.
 */
export async function readDocx(
  input: Buffer | Uint8Array | ArrayBuffer,
  options: ReadDocxOptions = {}
): Promise<ReadDocxResult> {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    includeMetadata = false,
    preserveLineBreaks = false,
  } = options;

  const buffer = normalizeToBuffer(input);

  if (buffer.length === 0) {
    throw new Error("DOCX file is empty.");
  }

  if (buffer.length > maxFileSize) {
    throw new Error(
      `DOCX file exceeds the maximum allowed size of ${maxFileSize} bytes.`
    );
  }

  try {
    const result = await mammoth.extractRawText({
      buffer,
    });

    const text = normalizeText(
      result.value ?? "",
      preserveLineBreaks
    );

    const warnings = normalizeWarnings(
      Array.isArray(result.messages)
        ? result.messages
        : []
    );

    const response: ReadDocxResult = {
      text,
      warnings,
      fileSize: buffer.length,
      characterCount: text.length,
      wordCount: countWords(text),
    };

    /*
     * mammoth.extractRawText does not guarantee metadata extraction.
     * Metadata is intentionally left optional to avoid unsafe assumptions.
     */
    if (includeMetadata) {
      response.metadata = {};
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown DOCX parsing error.";

    throw new Error(
      `Failed to read DOCX document: ${message}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                              CONVENIENCE API                               */
/* -------------------------------------------------------------------------- */

/**
 * Extract only plain text from a DOCX file.
 */
export async function extractDocxText(
  input: Buffer | Uint8Array | ArrayBuffer
): Promise<string> {
  const result = await readDocx(input);

  return result.text;
}

/**
 * Check whether input appears to be a DOCX-compatible ZIP file.
 *
 * DOCX files are ZIP containers and normally begin with PK.
 * This is only a lightweight preliminary check.
 */
export function isLikelyDocx(
  input: Buffer | Uint8Array | ArrayBuffer
): boolean {
  const buffer = normalizeToBuffer(input);

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

export default readDocx;