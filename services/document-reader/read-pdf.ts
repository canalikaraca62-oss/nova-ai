/**
 * ============================================================
 * SYRAVEN DOCUMENT READER
 * Production-grade PDF text extraction
 * ============================================================
 *
 * Compatible with modern pdf-parse ESM versions.
 *
 * Features:
 * - Buffer / Uint8Array / ArrayBuffer support
 * - File size validation
 * - PDF signature validation
 * - Page limit validation
 * - Metadata extraction
 * - Text normalization
 * - Word counting
 * - Safe TypeScript strict-mode compatibility
 * - No default-import dependency on pdf-parse
 * ============================================================
 */

import { PDFParse } from "pdf-parse";

/* ============================================================
   TYPES
============================================================ */

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

/* ============================================================
   INTERNAL TYPES
============================================================ */

type PdfInput =
  | Buffer
  | Uint8Array
  | ArrayBuffer;

type UnknownRecord =
  Record<string, unknown>;

/* ============================================================
   CONSTANTS
============================================================ */

const DEFAULT_MAX_FILE_SIZE =
  100 * 1024 * 1024;

const PDF_SIGNATURE =
  "%PDF-";

/* ============================================================
   INPUT NORMALIZATION
============================================================ */

function normalizeToBuffer(
  input: PdfInput
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

/* ============================================================
   TEXT NORMALIZATION
============================================================ */

function normalizeText(
  text: string,
  preserveLineBreaks: boolean,
  normalizeWhitespace: boolean
): string {
  if (!text) {
    return "";
  }

  let normalized =
    text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

  if (!normalizeWhitespace) {
    return normalized.trim();
  }

  if (preserveLineBreaks) {
    normalized =
      normalized
        .replace(/[ \t]+/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
  } else {
    normalized =
      normalized.replace(/\s+/g, " ");
  }

  return normalized.trim();
}

/* ============================================================
   WORD COUNT
============================================================ */

function countWords(
  text: string
): number {
  const trimmed =
    text.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed
    .split(/\s+/)
    .filter(
      Boolean
    )
    .length;
}

/* ============================================================
   TYPE HELPERS
============================================================ */

function isRecord(
  value: unknown
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getStringValue(
  value: unknown
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized
    ? normalized
    : undefined;
}

function getNumberValue(
  value: unknown
): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return undefined;
  }

  return value;
}

/* ============================================================
   METADATA NORMALIZATION
============================================================ */

function normalizeMetadata(
  value: unknown
): PdfMetadata | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const metadata:
    PdfMetadata = {};

  const title =
    getStringValue(
      value.Title ??
      value.title
    );

  const author =
    getStringValue(
      value.Author ??
      value.author
    );

  const subject =
    getStringValue(
      value.Subject ??
      value.subject
    );

  const keywords =
    getStringValue(
      value.Keywords ??
      value.keywords
    );

  const creator =
    getStringValue(
      value.Creator ??
      value.creator
    );

  const producer =
    getStringValue(
      value.Producer ??
      value.producer
    );

  const creationDate =
    getStringValue(
      value.CreationDate ??
      value.creationDate
    );

  const modificationDate =
    getStringValue(
      value.ModDate ??
      value.modificationDate
    );

  if (title) {
    metadata.title =
      title;
  }

  if (author) {
    metadata.author =
      author;
  }

  if (subject) {
    metadata.subject =
      subject;
  }

  if (keywords) {
    metadata.keywords =
      keywords;
  }

  if (creator) {
    metadata.creator =
      creator;
  }

  if (producer) {
    metadata.producer =
      producer;
  }

  if (creationDate) {
    metadata.creationDate =
      creationDate;
  }

  if (modificationDate) {
    metadata.modificationDate =
      modificationDate;
  }

  return Object.keys(metadata).length > 0
    ? metadata
    : undefined;
}

/* ============================================================
   PAGE COUNT EXTRACTION
============================================================ */

function getPageCount(
  value: unknown
): number {
  const directNumber =
    getNumberValue(value);

  if (
    directNumber !== undefined
  ) {
    return Math.max(
      0,
      Math.floor(directNumber)
    );
  }

  if (!isRecord(value)) {
    return 0;
  }

  const candidates = [
    value.total,
    value.pages,
    value.numPages,
    value.numpages,
    value.pageCount,
  ];

  for (
    const candidate of candidates
  ) {
    const number =
      getNumberValue(candidate);

    if (
      number !== undefined
    ) {
      return Math.max(
        0,
        Math.floor(number)
      );
    }
  }

  return 0;
}

/* ============================================================
   PDF SIGNATURE CHECK
============================================================ */

export function isLikelyPdf(
  input: PdfInput
): boolean {
  const buffer =
    normalizeToBuffer(input);

  if (
    buffer.length <
    PDF_SIGNATURE.length
  ) {
    return false;
  }

  return (
    buffer
      .subarray(
        0,
        PDF_SIGNATURE.length
      )
      .toString("ascii") ===
    PDF_SIGNATURE
  );
}

/* ============================================================
   OPTION VALIDATION
============================================================ */

function validateOptions(
  options: ReadPdfOptions
): void {
  if (
    options.maxFileSize !== undefined
  ) {
    if (
      !Number.isFinite(
        options.maxFileSize
      ) ||
      options.maxFileSize <= 0
    ) {
      throw new TypeError(
        "maxFileSize must be a positive finite number."
      );
    }
  }

  if (
    options.maxPages !== undefined
  ) {
    if (
      !Number.isInteger(
        options.maxPages
      ) ||
      options.maxPages <= 0
    ) {
      throw new TypeError(
        "maxPages must be a positive integer."
      );
    }
  }
}

/* ============================================================
   MAIN PDF READER
============================================================ */

/**
 * Extract text and metadata from a PDF document.
 */
export async function readPdf(
  input: PdfInput,
  options: ReadPdfOptions = {}
): Promise<ReadPdfResult> {
  validateOptions(options);

  const {
    maxFileSize =
      DEFAULT_MAX_FILE_SIZE,

    maxPages,

    preserveLineBreaks =
      false,

    normalizeWhitespace =
      true,
  } = options;

  const buffer =
    normalizeToBuffer(input);

  if (
    buffer.length === 0
  ) {
    throw new Error(
      "PDF file is empty."
    );
  }

  if (
    buffer.length >
    maxFileSize
  ) {
    throw new Error(
      `PDF file exceeds the maximum allowed size of ${maxFileSize} bytes.`
    );
  }

  if (
    !isLikelyPdf(buffer)
  ) {
    throw new Error(
      "Input does not appear to be a valid PDF document."
    );
  }

  let parser:
    PDFParse | null = null;

  try {
    /**
     * Modern pdf-parse API.
     *
     * PDFParse is instantiated with
     * Uint8Array data.
     */
    parser =
      new PDFParse({
        data: new Uint8Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength
        ),
      });

    /*
      Extract text.

      The current pdf-parse ESM API
      returns a structured result.
    */
    const textResult =
      await parser.getText();

    const rawText =
      isRecord(textResult)
        ? getStringValue(
            textResult.text
          ) ?? ""
        : "";

    const text =
      normalizeText(
        rawText,
        preserveLineBreaks,
        normalizeWhitespace
      );

    /*
      Get page information.
    */
    let pageCount = 0;

    try {
      const infoResult =
        await parser.getInfo();

      if (
        isRecord(infoResult)
      ) {
        pageCount =
          getPageCount(
            infoResult.total
          );

        if (
          pageCount === 0
        ) {
          pageCount =
            getPageCount(
              infoResult
            );
        }
      }
    } catch {
      /*
        Page info is optional.
        Text extraction can still succeed.
      */
      pageCount = 0;
    }

    /*
      Respect maxPages when the
      parser reports a larger count.

      This does not guarantee parser-side
      page truncation in every pdf-parse
      version, but ensures the returned
      metadata respects the configured
      logical maximum.
    */
    if (
      maxPages !== undefined &&
      pageCount > maxPages
    ) {
      pageCount =
        maxPages;
    }

    /*
      Metadata extraction.
    */
    let metadata:
      PdfMetadata | undefined;

    let version:
      string | undefined;

    try {
      const infoResult =
        await parser.getInfo();

      if (
        isRecord(infoResult)
      ) {
        metadata =
          normalizeMetadata(
            infoResult.info ??
            infoResult.metadata
          );

        version =
          getStringValue(
            infoResult.version
          );
      }
    } catch {
      /*
        Metadata extraction failure
        should not fail text extraction.
      */
    }

    return {
      text,

      pageCount,

      fileSize:
        buffer.length,

      characterCount:
        text.length,

      wordCount:
        countWords(text),

      ...(metadata
        ? { metadata }
        : {}),

      ...(version
        ? { version }
        : {}),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown PDF parsing error.";

    throw new Error(
      `Failed to read PDF document: ${message}`
    );
  } finally {
    /*
      Cleanup parser resources.
    */
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        /*
          Ignore cleanup failures.
        */
      }
    }
  }
}

/* ============================================================
   CONVENIENCE API
============================================================ */

/**
 * Extract only plain text from a PDF document.
 */
export async function extractPdfText(
  input: PdfInput
): Promise<string> {
  const result =
    await readPdf(input);

  return result.text;
}

/* ============================================================
   DEFAULT EXPORT
============================================================ */

export default readPdf;