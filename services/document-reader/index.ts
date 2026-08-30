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

type DocumentReader = (
  input: Response
) => Promise<unknown> | unknown;

/* -------------------------------------------------------------------------- */
/*                              CONFIGURATION                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

const MIME_TYPE_MAP: Record<string, SupportedDocumentType> = {
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

const EXTENSION_MAP: Record<string, SupportedDocumentType> = {
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
  input: Buffer | Uint8Array | ArrayBuffer
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
 * Important:
 * Do not pass Uint8Array<ArrayBufferLike> directly to Response.
 * Some TypeScript versions reject it as BodyInit.
 */
function toStandaloneArrayBuffer(
  input: Buffer | Uint8Array | ArrayBuffer
): ArrayBuffer {
  const bytes = toUint8Array(input);

  const arrayBuffer = new ArrayBuffer(bytes.byteLength);

  const target = new Uint8Array(arrayBuffer);

  target.set(bytes);

  return arrayBuffer;
}

/**
 * Creates a valid Response from document binary data.
 */
function createDocumentResponse(
  input: Buffer | Uint8Array | ArrayBuffer,
  mimeType: string
): Response {
  const arrayBuffer = toStandaloneArrayBuffer(input);

  return new Response(arrayBuffer, {
    headers: {
      "content-type":
        mimeType || "application/octet-stream",
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
  const normalized = fileName.trim().toLowerCase();

  const index = normalized.lastIndexOf(".");

  if (index === -1) {
    return "";
  }

  return normalized.slice(index + 1);
}

/**
 * Detects document type using MIME type and filename.
 */
export function detectDocumentType(
  fileName: string,
  mimeType?: string
): SupportedDocumentType {
  const normalizedMimeType = mimeType
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (
    normalizedMimeType &&
    MIME_TYPE_MAP[normalizedMimeType]
  ) {
    return MIME_TYPE_MAP[normalizedMimeType];
  }

  const extension = getFileExtension(fileName);

  return EXTENSION_MAP[extension] ?? "unknown";
}

/* -------------------------------------------------------------------------- */
/*                              TEXT NORMALIZATION                            */
/* -------------------------------------------------------------------------- */

/**
 * Normalizes different parser return types into text.
 */
function normalizeReaderResult(
  result: unknown
): string {
  if (typeof result === "string") {
    return result;
  }

  if (result === null || result === undefined) {
    return "";
  }

  if (typeof result === "object") {
    const value = result as Record<string, unknown>;

    if (typeof value.text === "string") {
      return value.text;
    }

    if (typeof value.content === "string") {
      return value.content;
    }

    if (typeof value.data === "string") {
      return value.data;
    }
  }

  return String(result);
}

/**
 * Cleans extracted document text.
 */
function cleanText(text: string): string {
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

function validateFileSize(
  input: Buffer | Uint8Array | ArrayBuffer,
  maxFileSize: number
): void {
  const bytes = toUint8Array(input);

  if (bytes.byteLength > maxFileSize) {
    const maxSizeMb = Math.round(
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
 * The parser receives Response, never raw Buffer.
 */
async function executeReader(
  reader: DocumentReader,
  buffer: Buffer | Uint8Array | ArrayBuffer,
  mimeType: string
): Promise<string> {
  const response = createDocumentResponse(
    buffer,
    mimeType
  );

  const result = await reader(response);

  return normalizeReaderResult(result);
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
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    trimText = true,
  } = options;

  const {
    fileName,
    mimeType = "application/octet-stream",
    buffer,
  } = input;

  const fileType = detectDocumentType(
    fileName,
    mimeType
  );

  const bytes = toUint8Array(buffer);

  const metadata: DocumentMetadata = {
    fileName,
    fileType,
    mimeType,
    size: bytes.byteLength,
    extractedAt: new Date().toISOString(),
  };

  try {
    validateFileSize(
      buffer,
      maxFileSize
    );

    let text = "";

    switch (fileType) {
      case "pdf": {
        text = await executeReader(
          readPdf as unknown as DocumentReader,
          buffer,
          mimeType || "application/pdf"
        );

        break;
      }

      case "docx": {
        text = await executeReader(
          readDocx as unknown as DocumentReader,
          buffer,
          mimeType ||
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );

        break;
      }

      case "pptx": {
        text = await executeReader(
          readPptx as unknown as DocumentReader,
          buffer,
          mimeType ||
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        );

        break;
      }

      case "txt":
      case "md":
      case "markdown":
      case "json":
      case "csv": {
        text = await executeReader(
          readText as unknown as DocumentReader,
          buffer,
          mimeType || "text/plain"
        );

        break;
      }

      default: {
        throw new Error(
          `Unsupported document type: ${fileType}`
        );
      }
    }

    const finalText = trimText
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
  const arrayBuffer = await file.arrayBuffer();

  return readDocument(
    {
      fileName: file.name,
      mimeType: file.type,
      buffer: arrayBuffer,
    },
    options
  );
}

/**
 * Reads raw binary content.
 */
export async function readBuffer(
  buffer: Buffer | Uint8Array | ArrayBuffer,
  fileName: string,
  mimeType?: string,
  options: DocumentReaderOptions = {}
): Promise<DocumentReaderResult> {
  return readDocument(
    {
      fileName,
      mimeType,
      buffer,
    },
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
  return Object.keys(EXTENSION_MAP);
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
};

export default documentReader;