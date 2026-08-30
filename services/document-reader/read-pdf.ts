/**
 * SYRAVEN Document Reader
 * PDF document text extraction
 *
 * Production-grade PDF parser.
 */

import pdf from "pdf-parse";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface ReadPdfOptions {
  /**
   * Maximum input file size in bytes.
   * Default: 100 MB
   */
  maxFileSize?: number;

  /**
   * Maximum number of pages to parse.
   * Default: unlimited
   */
  maxPages?: number;

  /**
   * Preserve line breaks in extracted text.
   * Default: false
   */
  preserveLineBreaks?: boolean;

  /**
   * Normalize whitespace.
   * Default: true
   */
  normalizeWhitespace?: boolean;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;

  [key: string]: unknown;
}

export interface ReadPdfResult {
  /**
   * Extracted plain text.
   */
  text: string;

  /**
   * Number of pages parsed.
   */
  pageCount: number;

  /**
   * Original file size in bytes.
   */
  fileSize: number;

  /**
   * Extracted character count.
   */
  characterCount: number;

  /**
   * Extracted word count.
   */
  wordCount: number;

  /**
   * PDF metadata when available.
   */
  metadata?: PdfMetadata;

  /**
   * PDF version when available.
   */
  version?: string;
}

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024;

/* -------------------------------------------------------------------------- */
/*                              INPUT UTILITIES                               */
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
    "Unsupported PDF input type. Expected Buffer, Uint8Array, or ArrayBuffer."
  );
}

function normalizeText(
  text: string,
  preserveLineBreaks: boolean,
  normalizeWhitespace: boolean
): string {
  if (!text) {
    return "";
  }

  let normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (normalizeWhitespace) {
    if (preserveLineBreaks) {
      normalized = normalized
        .replace(/[ \t]+/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
    } else {
      normalized = normalized.replace(/\s+/g, " ");
    }
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

function normalizeMetadata(
  value: unknown
): PdfMetadata | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const metadata: PdfMetadata = {};

  const fields = [
    "Title",
    "Author",
    "Subject",
    "Keywords",
    "Creator",
    "Producer",
    "CreationDate",
    "ModDate",
  ] as const;

  for (const field of fields) {
    const fieldValue = source[field];

    if (typeof fieldValue === "string" && fieldValue.trim()) {
      switch (field) {
        case "Title":
          metadata.title = fieldValue;
          break;
        case "Author":
          metadata.author = fieldValue;
          break;
        case "Subject":
          metadata.subject = fieldValue;
          break;
        case "Keywords":
          metadata.keywords = fieldValue;
          break;
        case "Creator":
          metadata.creator = fieldValue;
          break;
        case "Producer":
          metadata.producer = fieldValue;
          break;
        case "CreationDate":
          metadata.creationDate = fieldValue;
          break;
        case "ModDate":
          metadata.modificationDate = fieldValue;
          break;
      }
    }
  }

  return Object.keys(metadata).length > 0
    ? metadata
    : undefined;
}

/* -------------------------------------------------------------------------- */
/*                                MAIN READER                                 */
/* -------------------------------------------------------------------------- */

/**
 * Extract text and metadata from a PDF document.
 */
export async function readPdf(
  input: Buffer | Uint8Array | ArrayBuffer,
  options: ReadPdfOptions = {}
): Promise<ReadPdfResult> {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    maxPages,
    preserveLineBreaks = false,
    normalizeWhitespace = true,
  } = options;

  const buffer = normalizeToBuffer(input);

  if (buffer.length === 0) {
    throw new Error("PDF file is empty.");
  }

  if (buffer.length > maxFileSize) {
    throw new Error(
      `PDF file exceeds the maximum allowed size of ${maxFileSize} bytes.`
    );
  }

  if (
    maxPages !== undefined &&
    (!Number.isInteger(maxPages) || maxPages <= 0)
  ) {
    throw new TypeError(
      "maxPages must be a positive integer."
    );
  }

  try {
    const result = await pdf(buffer, {
      max: maxPages,
    });

    const text = normalizeText(
      typeof result.text === "string" ? result.text : "",
      preserveLineBreaks,
      normalizeWhitespace
    );

    const pageCount =
      typeof result.numpages === "number" &&
      Number.isFinite(result.numpages)
        ? result.numpages
        : 0;

    const metadata = normalizeMetadata(
      result.info
    );

    const version =
      typeof result.version === "string"
        ? result.version
        : undefined;

    return {
      text,
      pageCount,
      fileSize: buffer.length,
      characterCount: text.length,
      wordCount: countWords(text),
      ...(metadata ? { metadata } : {}),
      ...(version ? { version } : {}),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown PDF parsing error.";

    throw new Error(
      `Failed to read PDF document: ${message}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                              CONVENIENCE API                               */
/* -------------------------------------------------------------------------- */

/**
 * Extract only plain text from a PDF document.
 */
export async function extractPdfText(
  input: Buffer | Uint8Array | ArrayBuffer
): Promise<string> {
  const result = await readPdf(input);

  return result.text;
}

/**
 * Lightweight PDF signature check.
 */
export function isLikelyPdf(
  input: Buffer | Uint8Array | ArrayBuffer
): boolean {
  const buffer = normalizeToBuffer(input);

  if (buffer.length < 5) {
    return false;
  }

  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  );
}

/* -------------------------------------------------------------------------- */
/*                               DEFAULT EXPORT                               */
/* -------------------------------------------------------------------------- */

export default readPdf;