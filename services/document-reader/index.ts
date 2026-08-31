/**
 * SYRAVEN Document Reader
 * Enterprise document ingestion and text extraction layer.
 *
 * Supported formats:
 * - PDF
 * - DOCX
 * - PPTX
 * - TXT
 * - Markdown
 * - JSON
 * - CSV
 */

import { readDocx } from "./read-docx";
import { readPdf } from "./read-pdf";
import { readPptx } from "./read-pptx";
import { readText } from "./readText";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type SupportedDocumentType =
  | "pdf"
  | "docx"
  | "pptx"
  | "txt"
  | "md"
  | "markdown"
  | "json"
  | "csv"
  | "unknown";

export interface DocumentMetadata {
  fileName: string;
  fileType: SupportedDocumentType;
  mimeType: string;
  size: number;
  extractedAt: string;
}

export interface DocumentReaderResult {
  success: boolean;
  text: string;
  metadata: DocumentMetadata;
  error?: string;
}

export interface DocumentReaderOptions {
  maxFileSize?: number;
  includeMetadata?: boolean;
  trimText?: boolean;
}

export interface DocumentInput {
  fileName: string;
  mimeType?: string;
  buffer: Buffer | Uint8Array | ArrayBuffer;
}

type BinaryDocumentInput =
  | Buffer
  | Uint8Array
  | ArrayBuffer;

type DocumentReader = (
  input: Response
) => Promise<unknown> | unknown;

/* -------------------------------------------------------------------------- */
/*                              CONFIGURATION                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

const DEFAULT_BINARY_MIME_TYPE =
  "application/octet-stream";

const MIME_TYPE_MAP: Record<
  string,
  SupportedDocumentType
> = {
  "application/pdf": "pdf",

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",

  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",

  "text/plain": "txt",

  "text/markdown": "md",

  "application/json": "json",

  "text/csv": "csv",
};

const EXTENSION_MAP: Record<
  string,
  SupportedDocumentType
> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
  txt: "txt",
  text: "txt",
  md: "md",
  markdown: "markdown",
  json: "json",
  csv: "csv",
};

/* -------------------------------------------------------------------------- */
/*                              BINARY HELPERS                                */
/* -------------------------------------------------------------------------- */

/**
 * Converts supported binary input into a Uint8Array.
 */
function toUint8Array(
  input: BinaryDocumentInput
): Uint8Array {
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  return new Uint8Array(
    input.buffer,
    input.byteOffset,
    input.byteLength
  );
}

/**
 * Creates a standalone ArrayBuffer.
 *
 * This prevents Buffer / Uint8Array backing-buffer
 * compatibility issues with Response BodyInit typing.
 */
function toStandaloneArrayBuffer(
  input: BinaryDocumentInput
): ArrayBuffer {
  const bytes = toUint8Array(input);

  const arrayBuffer = new ArrayBuffer(
    bytes.byteLength
  );

  const target = new Uint8Array(
    arrayBuffer
  );

  target.set(bytes);

  return arrayBuffer;
}

/**
 * Creates a valid Response from document binary data.
 */
function createDocumentResponse(
  input: BinaryDocumentInput,
  mimeType: string
): Response {
  const arrayBuffer =
    toStandaloneArrayBuffer(input);

  return new Response(arrayBuffer, {
    headers: {
      "content-type":
        mimeType || DEFAULT_BINARY_MIME_TYPE,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                              FILE DETECTION                                */
/* -------------------------------------------------------------------------- */

/**
 * Gets the extension from a filename.
 */
export function getFileExtension(
  fileName: string
): string {
  const normalized =
    fileName.trim().toLowerCase();

  const index =
    normalized.lastIndexOf(".");

  if (
    index === -1 ||
    index === normalized.length - 1
  ) {
    return "";
  }

  return normalized.slice(index + 1);
}

/**
 * Normalizes a MIME type.
 */
function normalizeMimeType(
  mimeType?: string
): string {
  if (!mimeType) {
    return "";
  }

  const normalized =
    mimeType
      .split(";")[0]
      ?.trim()
      .toLowerCase();

  return normalized ?? "";
}

/**
 * Detects document type using MIME type and filename.
 */
export function detectDocumentType(
  fileName: string,
  mimeType?: string
): SupportedDocumentType {
  const normalizedMimeType =
    normalizeMimeType(mimeType);

  if (normalizedMimeType) {
    const detectedFromMime =
      MIME_TYPE_MAP[normalizedMimeType];

    if (detectedFromMime !== undefined) {
      return detectedFromMime;
    }
  }

  const extension =
    getFileExtension(fileName);

  const detectedFromExtension =
    EXTENSION_MAP[extension];

  return detectedFromExtension ?? "unknown";
}

/* -------------------------------------------------------------------------- */
/*                              TEXT NORMALIZATION                            */
/* -------------------------------------------------------------------------- */

/**
 * Type guard for generic object records.
 */
function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Normalizes different parser return types into text.
 */
function normalizeReaderResult(
  result: unknown
): string {
  if (typeof result === "string") {
    return result;
  }

  if (
    result === null ||
    result === undefined
  ) {
    return "";
  }

  if (isRecord(result)) {
    const text =
      result["text"];

    if (typeof text === "string") {
      return text;
    }

    const content =
      result["content"];

    if (typeof content === "string") {
      return content;
    }

    const data =
      result["data"];

    if (typeof data === "string") {
      return data;
    }
  }

  return String(result);
}

/**
 * Cleans extracted document text.
 */
function cleanText(
  text: string
): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* -------------------------------------------------------------------------- */
/*                              VALIDATION                                    */
/* -------------------------------------------------------------------------- */

/**
 * Validates maximum file size.
 */
function validateFileSize(
  input: BinaryDocumentInput,
  maxFileSize: number
): void {
  if (
    !Number.isFinite(maxFileSize) ||
    maxFileSize <= 0
  ) {
    throw new Error(
      "maxFileSize must be a positive finite number"
    );
  }

  const bytes =
    toUint8Array(input);

  if (
    bytes.byteLength >
    maxFileSize
  ) {
    const maxSizeMb =
      Math.round(
        maxFileSize / 1024 / 1024
      );

    throw new Error(
      `Document exceeds maximum allowed size of ${maxSizeMb} MB`
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                              READER EXECUTION                              */
/* -------------------------------------------------------------------------- */

/**
 * Executes a document parser safely.
 *
 * The parser receives Response,
 * never raw Buffer.
 */
async function executeReader(
  reader: DocumentReader,
  buffer: BinaryDocumentInput,
  mimeType: string
): Promise<string> {
  const response =
    createDocumentResponse(
      buffer,
      mimeType
    );

  const result =
    await reader(response);

  return normalizeReaderResult(result);
}

/* -------------------------------------------------------------------------- */
/*                           DOCUMENT MIME RESOLUTION                         */
/* -------------------------------------------------------------------------- */

/**
 * Returns the preferred MIME type for a document type.
 */
function getDefaultMimeType(
  fileType: SupportedDocumentType
): string {
  switch (fileType) {
    case "pdf":
      return "application/pdf";

    case "docx":
      return (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

    case "pptx":
      return (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );

    case "md":
    case "markdown":
      return "text/markdown";

    case "json":
      return "application/json";

    case "csv":
      return "text/csv";

    case "txt":
      return "text/plain";

    default:
      return DEFAULT_BINARY_MIME_TYPE;
  }
}

/**
 * Resolves the effective MIME type.
 */
function resolveMimeType(
  mimeType: string | undefined,
  fileType: SupportedDocumentType
): string {
  const normalized =
    normalizeMimeType(mimeType);

  if (normalized) {
    return normalized;
  }

  return getDefaultMimeType(fileType);
}

/* -------------------------------------------------------------------------- */
/*                             MAIN DOCUMENT READER                           */
/* -------------------------------------------------------------------------- */

/**
 * Reads and extracts text from a supported document.
 */
export async function readDocument(
  input: DocumentInput,
  options: DocumentReaderOptions = {}
): Promise<DocumentReaderResult> {
  const maxFileSize =
    options.maxFileSize ??
    DEFAULT_MAX_FILE_SIZE;

  const trimText =
    options.trimText ?? true;

  const fileName =
    input.fileName.trim();

  const buffer =
    input.buffer;

  const fileType =
    detectDocumentType(
      fileName,
      input.mimeType
    );

  const mimeType =
    resolveMimeType(
      input.mimeType,
      fileType
    );

  const bytes =
    toUint8Array(buffer);

  const metadata: DocumentMetadata = {
    fileName,
    fileType,
    mimeType,
    size: bytes.byteLength,
    extractedAt:
      new Date().toISOString(),
  };

  try {
    if (!fileName) {
      throw new Error(
        "Document file name is required"
      );
    }

    validateFileSize(
      buffer,
      maxFileSize
    );

    let text: string;

    switch (fileType) {
      case "pdf": {
        text =
          await executeReader(
            readPdf as unknown as DocumentReader,
            buffer,
            mimeType
          );

        break;
      }

      case "docx": {
        text =
          await executeReader(
            readDocx as unknown as DocumentReader,
            buffer,
            mimeType
          );

        break;
      }

      case "pptx": {
        text =
          await executeReader(
            readPptx as unknown as DocumentReader,
            buffer,
            mimeType
          );

        break;
      }

      case "txt":
      case "md":
      case "markdown":
      case "json":
      case "csv": {
        text =
          await executeReader(
            readText as unknown as DocumentReader,
            buffer,
            mimeType
          );

        break;
      }

      case "unknown":
      default: {
        throw new Error(
          `Unsupported document type: ${fileType}`
        );
      }
    }

    const finalText =
      trimText
        ? cleanText(text)
        : text;

    return {
      success: true,
      text: finalText,
      metadata,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown document processing error";

    return {
      success: false,
      text: "",
      metadata,
      error: message,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                              CONVENIENCE API                               */
/* -------------------------------------------------------------------------- */

/**
 * Reads a browser File.
 */
export async function readFile(
  file: File,
  options: DocumentReaderOptions = {}
): Promise<DocumentReaderResult> {
  const arrayBuffer =
    await file.arrayBuffer();

  const input: DocumentInput = {
    fileName: file.name,
    buffer: arrayBuffer,
  };

  if (file.type) {
    input.mimeType =
      file.type;
  }

  return readDocument(
    input,
    options
  );
}

/**
 * Reads raw binary content.
 */
export async function readBuffer(
  buffer: BinaryDocumentInput,
  fileName: string,
  mimeType?: string,
  options: DocumentReaderOptions = {}
): Promise<DocumentReaderResult> {
  const input: DocumentInput = {
    fileName,
    buffer,
  };

  if (mimeType !== undefined) {
    input.mimeType =
      mimeType;
  }

  return readDocument(
    input,
    options
  );
}

/**
 * Checks whether a document is supported.
 */
export function isSupportedDocument(
  fileName: string,
  mimeType?: string
): boolean {
  return (
    detectDocumentType(
      fileName,
      mimeType
    ) !== "unknown"
  );
}

/**
 * Returns all supported extensions.
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(
    EXTENSION_MAP
  );
}

/**
 * Returns the default maximum document size.
 */
export function getMaxDocumentSize(): number {
  return DEFAULT_MAX_FILE_SIZE;
}

/* -------------------------------------------------------------------------- */
/*                              SERVICE EXPORT                                */
/* -------------------------------------------------------------------------- */

export const documentReader = {
  readDocument,
  readFile,
  readBuffer,

  detectDocumentType,
  getFileExtension,

  isSupportedDocument,
  getSupportedExtensions,
  getMaxDocumentSize,
} as const;

export default documentReader;