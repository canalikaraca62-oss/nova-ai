/**
 * SYRAVEN File Service
 *
 * Enterprise-grade file management service.
 *
 * Features:
 * - File metadata management
 * - File validation
 * - MIME type validation
 * - Extension validation
 * - File size limits
 * - File categorization
 * - Object URL management
 * - Browser-safe File API access
 * - In-memory registry abstraction
 * - Strict TypeScript compatibility
 *
 * Note:
 * This service manages client-side file objects and metadata.
 * Production persistence should be handled by a storage provider
 * such as Supabase Storage, S3, Cloudflare R2, etc.
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type FileCategory =
  | "document"
  | "image"
  | "audio"
  | "video"
  | "archive"
  | "text"
  | "data"
  | "other";

export type FileStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "deleted";

export interface ManagedFile {
  id: string;

  name: string;

  originalName: string;

  extension: string;

  mimeType: string;

  size: number;

  category: FileCategory;

  status: FileStatus;

  userId?: string;

  url?: string;

  objectUrl?: string;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<string, unknown>;
}

export interface CreateFileInput {
  file: File;

  userId?: string;

  metadata?: Record<string, unknown>;
}

export interface UpdateFileInput {
  status?: FileStatus;

  url?: string;

  metadata?: Record<string, unknown>;
}

export interface FileValidationOptions {
  maxSize?: number;

  minSize?: number;

  allowedMimeTypes?: string[];

  allowedExtensions?: string[];

  blockedExtensions?: string[];

  requireMimeType?: boolean;
}

export interface FileValidationResult {
  valid: boolean;

  errors: string[];

  warnings: string[];
}

export interface FileListOptions {
  userId?: string;

  category?: FileCategory;

  status?: FileStatus;

  limit?: number;

  offset?: number;
}

export interface PaginatedFiles {
  files: ManagedFile[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface FileObjectUrl {
  fileId: string;

  url: string;
}

/* -------------------------------------------------------------------------- */
/*                                  ERRORS                                    */
/* -------------------------------------------------------------------------- */

export class FileServiceError extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "FileServiceError";
  }
}

export class FileNotFoundError
  extends FileServiceError {
  constructor(
    fileId: string
  ) {
    super(
      `File not found: ${fileId}`
    );

    this.name =
      "FileNotFoundError";
  }
}

export class FileValidationError
  extends FileServiceError {
  readonly errors: string[];

  constructor(
    errors: string[]
  ) {
    super(
      errors.join(" ")
    );

    this.name =
      "FileValidationError";

    this.errors = errors;
  }
}

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_MAX_FILE_SIZE =
  50 * 1024 * 1024;

export const DEFAULT_FILE_LIMIT =
  50;

export const MAX_FILE_LIMIT =
  500;

export const DEFAULT_ALLOWED_EXTENSIONS = [
  "txt",
  "md",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "ppt",
  "pptx",
  "json",
  "xml",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "mp3",
  "wav",
  "mp4",
  "webm",
  "zip",
] as const;

export const DEFAULT_BLOCKED_EXTENSIONS = [
  "exe",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "pif",
  "jar",
  "app",
] as const;

/* -------------------------------------------------------------------------- */
/*                              FILE UTILITIES                                */
/* -------------------------------------------------------------------------- */

export function getFileExtension(
  fileName: string
): string {
  const normalized =
    fileName.trim();

  const lastDot =
    normalized.lastIndexOf(".");

  if (
    lastDot <= 0 ||
    lastDot ===
      normalized.length - 1
  ) {
    return "";
  }

  return normalized
    .slice(lastDot + 1)
    .toLowerCase();
}

export function removeFileExtension(
  fileName: string
): string {
  const extension =
    getFileExtension(fileName);

  if (!extension) {
    return fileName;
  }

  return fileName.slice(
    0,
    -(extension.length + 1)
  );
}

export function getFileCategory(
  mimeType: string,
  extension?: string
): FileCategory {
  const normalizedMime =
    mimeType.toLowerCase();

  const normalizedExtension =
    extension?.toLowerCase() ??
    "";

  if (
    normalizedMime.startsWith(
      "image/"
    )
  ) {
    return "image";
  }

  if (
    normalizedMime.startsWith(
      "audio/"
    )
  ) {
    return "audio";
  }

  if (
    normalizedMime.startsWith(
      "video/"
    )
  ) {
    return "video";
  }

  if (
    normalizedMime.startsWith(
      "text/"
    )
  ) {
    return "text";
  }

  if (
    normalizedMime.includes(
      "pdf"
    ) ||
    normalizedMime.includes(
      "word"
    ) ||
    normalizedMime.includes(
      "presentation"
    ) ||
    normalizedMime.includes(
      "spreadsheet"
    )
  ) {
    return "document";
  }

  if (
    [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
    ].includes(
      normalizedExtension
    )
  ) {
    return "document";
  }

  if (
    [
      "zip",
      "rar",
      "7z",
      "tar",
      "gz",
    ].includes(
      normalizedExtension
    )
  ) {
    return "archive";
  }

  if (
    [
      "json",
      "xml",
      "yaml",
      "yml",
      "csv",
    ].includes(
      normalizedExtension
    )
  ) {
    return "data";
  }

  if (
    [
      "txt",
      "md",
      "rtf",
    ].includes(
      normalizedExtension
    )
  ) {
    return "text";
  }

  return "other";
}

export function formatFileSize(
  bytes: number
): string {
  if (
    !Number.isFinite(bytes) ||
    bytes < 0
  ) {
    return "0 B";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(bytes) /
          Math.log(1024)
      ),
      units.length - 1
    );

  const value =
    bytes /
    Math.pow(
      1024,
      index
    );

  return `${value.toFixed(
    index === 0 ? 0 : 2
  )} ${units[index]}`;
}

/* -------------------------------------------------------------------------- */
/*                              FILE SERVICE                                  */
/* -------------------------------------------------------------------------- */

export class FileService {
  private readonly files =
    new Map<
      string,
      ManagedFile
    >();

  private readonly fileObjects =
    new Map<
      string,
      File
    >();

  /* ------------------------------------------------------------------------ */
  /*                                VALIDATION                                */
  /* ------------------------------------------------------------------------ */

  validate(
    file: File,
    options: FileValidationOptions = {}
  ): FileValidationResult {
    const errors: string[] =
      [];

    const warnings: string[] =
      [];

    if (!file) {
      return {
        valid: false,

        errors: [
          "A file is required.",
        ],

        warnings,
      };
    }

    if (
      !file.name ||
      !file.name.trim()
    ) {
      errors.push(
        "File name is required."
      );
    }

    if (
      !Number.isFinite(
        file.size
      ) ||
      file.size < 0
    ) {
      errors.push(
        "File size is invalid."
      );
    }

    const extension =
      getFileExtension(
        file.name
      );

    const maxSize =
      options.maxSize ??
      DEFAULT_MAX_FILE_SIZE;

    const minSize =
      options.minSize ?? 0;

    if (
      file.size > maxSize
    ) {
      errors.push(
        `File exceeds maximum size of ${formatFileSize(
          maxSize
        )}.`
      );
    }

    if (
      file.size < minSize
    ) {
      errors.push(
        `File is smaller than minimum size of ${formatFileSize(
          minSize
        )}.`
      );
    }

    const blockedExtensions =
      options.blockedExtensions ??
      Array.from(
        DEFAULT_BLOCKED_EXTENSIONS
      );

    if (
      extension &&
      blockedExtensions
        .map(
          (value) =>
            value
              .replace(
                /^\./,
                ""
              )
              .toLowerCase()
        )
        .includes(extension)
    ) {
      errors.push(
        `File extension ".${extension}" is not allowed.`
      );
    }

    if (
      options.allowedExtensions &&
      options.allowedExtensions.length >
        0
    ) {
      const allowed =
        options.allowedExtensions.map(
          (value) =>
            value
              .replace(
                /^\./,
                ""
              )
              .toLowerCase()
        );

      if (
        !extension ||
        !allowed.includes(
          extension
        )
      ) {
        errors.push(
          `File extension ".${extension || "unknown"}" is not allowed.`
        );
      }
    }

    if (
      options.allowedMimeTypes &&
      options.allowedMimeTypes.length >
        0
    ) {
      const mimeType =
        file.type.toLowerCase();

      const allowed =
        options.allowedMimeTypes.map(
          (value) =>
            value.toLowerCase()
        );

      const matches =
        allowed.some(
          (allowedType) => {
            if (
              allowedType.endsWith(
                "/*"
              )
            ) {
              const prefix =
                allowedType.slice(
                  0,
                  -1
                );

              return mimeType.startsWith(
                prefix
              );
            }

            return (
              mimeType ===
              allowedType
            );
          }
        );

      if (!matches) {
        errors.push(
          `MIME type "${file.type || "unknown"}" is not allowed.`
        );
      }
    }

    if (
      options.requireMimeType &&
      !file.type
    ) {
      errors.push(
        "A detectable MIME type is required."
      );
    }

    if (
      !file.type
    ) {
      warnings.push(
        "The browser did not provide a MIME type."
      );
    }

    return {
      valid:
        errors.length === 0,

      errors,

      warnings,
    };
  }

  assertValid(
    file: File,
    options: FileValidationOptions = {}
  ): void {
    const result =
      this.validate(
        file,
        options
      );

    if (!result.valid) {
      throw new FileValidationError(
        result.errors
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                                CREATION                                  */
  /* ------------------------------------------------------------------------ */

  create(
    input: CreateFileInput,
    validationOptions: FileValidationOptions = {}
  ): ManagedFile {
    this.assertValid(
      input.file,
      validationOptions
    );

    const now =
      new Date();

    const extension =
      getFileExtension(
        input.file.name
      );

    const managedFile: ManagedFile = {
      id:
        this.generateId(
          "file"
        ),

      name:
        this.sanitizeFileName(
          input.file.name
        ),

      originalName:
        input.file.name,

      extension,

      mimeType:
        input.file.type ||
        "application/octet-stream",

      size:
        input.file.size,

      category:
        getFileCategory(
          input.file.type,
          extension
        ),

      status:
        "pending",

      userId:
        input.userId,

      createdAt:
        now,

      updatedAt:
        now,

      metadata:
        this.cloneMetadata(
          input.metadata
        ),
    };

    this.files.set(
      managedFile.id,
      managedFile
    );

    this.fileObjects.set(
      managedFile.id,
      input.file
    );

    return this.cloneManagedFile(
      managedFile
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  READ                                    */
  /* ------------------------------------------------------------------------ */

  get(
    fileId: string
  ): ManagedFile | undefined {
    const file =
      this.files.get(
        fileId
      );

    if (!file) {
      return undefined;
    }

    return this.cloneManagedFile(
      file
    );
  }

  require(
    fileId: string
  ): ManagedFile {
    const file =
      this.get(fileId);

    if (!file) {
      throw new FileNotFoundError(
        fileId
      );
    }

    return file;
  }

  getNativeFile(
    fileId: string
  ): File | undefined {
    return this.fileObjects.get(
      fileId
    );
  }

  requireNativeFile(
    fileId: string
  ): File {
    const file =
      this.getNativeFile(
        fileId
      );

    if (!file) {
      throw new FileNotFoundError(
        fileId
      );
    }

    return file;
  }

  list(
    options: FileListOptions = {}
  ): PaginatedFiles {
    const limit =
      this.normalizeLimit(
        options.limit
      );

    const offset =
      this.normalizeOffset(
        options.offset
      );

    let items =
      Array.from(
        this.files.values()
      );

    if (
      options.userId !==
      undefined
    ) {
      items =
        items.filter(
          (file) =>
            file.userId ===
            options.userId
        );
    }

    if (
      options.category !==
      undefined
    ) {
      items =
        items.filter(
          (file) =>
            file.category ===
            options.category
        );
    }

    if (
      options.status !==
      undefined
    ) {
      items =
        items.filter(
          (file) =>
            file.status ===
            options.status
        );
    }

    items.sort(
      (a, b) =>
        b.updatedAt.getTime() -
        a.updatedAt.getTime()
    );

    const total =
      items.length;

    const files =
      items
        .slice(
          offset,
          offset + limit
        )
        .map(
          (file) =>
            this.cloneManagedFile(
              file
            )
        );

    return {
      files,

      total,

      limit,

      offset,

      hasMore:
        offset +
          files.length <
        total,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                                  UPDATE                                  */
  /* ------------------------------------------------------------------------ */

  update(
    fileId: string,
    input: UpdateFileInput
  ): ManagedFile {
    const existing =
      this.require(
        fileId
      );

    const updated: ManagedFile = {
      ...existing,

      status:
        input.status ??
        existing.status,

      url:
        input.url !== undefined
          ? input.url
          : existing.url,

      metadata:
        input.metadata !== undefined
          ? this.cloneMetadata(
              input.metadata
            )
          : existing.metadata,

      updatedAt:
        new Date(),
    };

    this.files.set(
      fileId,
      updated
    );

    return this.cloneManagedFile(
      updated
    );
  }

  setStatus(
    fileId: string,
    status: FileStatus
  ): ManagedFile {
    return this.update(
      fileId,
      {
        status,
      }
    );
  }

  setUploaded(
    fileId: string,
    url: string
  ): ManagedFile {
    if (!url.trim()) {
      throw new FileServiceError(
        "Uploaded file URL is required."
      );
    }

    return this.update(
      fileId,
      {
        status: "uploaded",
        url,
      }
    );
  }

  markProcessing(
    fileId: string
  ): ManagedFile {
    return this.setStatus(
      fileId,
      "processing"
    );
  }

  markReady(
    fileId: string
  ): ManagedFile {
    return this.setStatus(
      fileId,
      "ready"
    );
  }

  markFailed(
    fileId: string
  ): ManagedFile {
    return this.setStatus(
      fileId,
      "failed"
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                              FILE CONTENT                                */
  /* ------------------------------------------------------------------------ */

  async readAsText(
    fileId: string
  ): Promise<string> {
    const file =
      this.requireNativeFile(
        fileId
      );

    return file.text();
  }

  async readAsArrayBuffer(
    fileId: string
  ): Promise<ArrayBuffer> {
    const file =
      this.requireNativeFile(
        fileId
      );

    return file.arrayBuffer();
  }

  async readAsDataUrl(
    fileId: string
  ): Promise<string> {
    const file =
      this.requireNativeFile(
        fileId
      );

    return this.readFileAsDataUrl(
      file
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                               OBJECT URLS                                */
  /* ------------------------------------------------------------------------ */

  createObjectUrl(
    fileId: string
  ): FileObjectUrl {
    this.assertObjectUrlSupport();

    const managedFile =
      this.require(
        fileId );

    const nativeFile =
      this.requireNativeFile(
        fileId
      );

    this.revokeObjectUrl(
      fileId
    );

    const url =
      URL.createObjectURL(
        nativeFile
      );

    const updated: ManagedFile = {
      ...managedFile,

      objectUrl:
        url,

      updatedAt:
        new Date(),
    };

    this.files.set(
      fileId,
      updated
    );

    return {
      fileId,
      url,
    };
  }

  revokeObjectUrl(
    fileId: string
  ): void {
    const managedFile =
      this.files.get(
        fileId
      );

    if (
      !managedFile ||
      !managedFile.objectUrl
    ) {
      return;
    }

    if (
      typeof URL !==
        "undefined" &&
      typeof URL.revokeObjectURL ===
        "function"
    ) {
      URL.revokeObjectURL(
        managedFile.objectUrl
      );
    }

    const updated: ManagedFile = {
      ...managedFile,

      objectUrl:
        undefined,

      updatedAt:
        new Date(),
    };

    this.files.set(
      fileId,
      updated
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  DELETE                                  */
  /* ------------------------------------------------------------------------ */

  delete(
    fileId: string,
    permanently = false
  ): void {
    this.require(
      fileId
    );

    this.revokeObjectUrl(
      fileId
    );

    if (permanently) {
      this.files.delete(
        fileId
      );

      this.fileObjects.delete(
        fileId
      );

      return;
    }

    this.update(
      fileId,
      {
        status: "deleted",
      }
    );
  }

  clear(
    userId?: string
  ): void {
    if (
      userId === undefined
    ) {
      for (
        const fileId of
        this.files.keys()
      ) {
        this.revokeObjectUrl(
          fileId
        );
      }

      this.files.clear();

      this.fileObjects.clear();

      return;
    }

    const fileIds =
      Array.from(
        this.files.values()
      )
        .filter(
          (file) =>
            file.userId ===
            userId
        )
        .map(
          (file) =>
            file.id
        );

    for (
      const fileId of
      fileIds
    ) {
      this.revokeObjectUrl(
        fileId
      );

      this.files.delete(
        fileId
      );

      this.fileObjects.delete(
        fileId
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                             PRIVATE HELPERS                              */
  /* ------------------------------------------------------------------------ */

  private sanitizeFileName(
    fileName: string
  ): string {
    const normalized =
      fileName
        .trim()
        .replace(
          /[\/\\:*?"<>|]/g,
          "_"
        )
        .replace(
          /\s+/g,
          " "
        );

    if (!normalized) {
      return "file";
    }

    return normalized.slice(
      0,
      255
    );
  }

  private normalizeLimit(
    limit?: number
  ): number {
    if (
      limit === undefined ||
      !Number.isFinite(
        limit
      )
    ) {
      return DEFAULT_FILE_LIMIT;
    }

    return Math.max(
      1,
      Math.min(
        Math.floor(limit),
        MAX_FILE_LIMIT
      )
    );
  }

  private normalizeOffset(
    offset?: number
  ): number {
    if (
      offset === undefined ||
      !Number.isFinite(
        offset
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(offset)
    );
  }

  private cloneMetadata(
    metadata?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!metadata) {
      return undefined;
    }

    return {
      ...metadata,
    };
  }

  private cloneManagedFile(
    file: ManagedFile
  ): ManagedFile {
    return {
      ...file,

      createdAt:
        new Date(
          file.createdAt
        ),

      updatedAt:
        new Date(
          file.updatedAt
        ),

      metadata:
        this.cloneMetadata(
          file.metadata
        ),
    };
  }

  private generateId(
    prefix: string
  ): string {
    const timestamp =
      Date.now()
        .toString(36);

    const random =
      Math.random()
        .toString(36)
        .slice(2, 14);

    return `${prefix}_${timestamp}_${random}`;
  }

  private assertObjectUrlSupport(): void {
    if (
      typeof URL ===
        "undefined" ||
      typeof URL.createObjectURL !==
        "function"
    ) {
      throw new FileServiceError(
        "Object URL creation is not supported in this environment."
      );
    }
  }

  private readFileAsDataUrl(
    file: File
  ): Promise<string> {
    if (
      typeof FileReader ===
      "undefined"
    ) {
      return Promise.reject(
        new FileServiceError(
          "FileReader is not supported in this environment."
        )
      );
    }

    return new Promise<
      string
    >(
      (
        resolve,
        reject
      ) => {
        const reader =
          new FileReader();

        reader.onload =
          () => {
            const result =
              reader.result;

            if (
              typeof result !==
              "string"
            ) {
              reject(
                new FileServiceError(
                  "Failed to convert file to Data URL."
                )
              );

              return;
            }

            resolve(
              result
            );
          };

        reader.onerror =
          () => {
            reject(
              new FileServiceError(
                "Failed to read file."
              )
            );
          };

        reader.readAsDataURL(
          file
        );
      }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                               SINGLETON                                    */
/* -------------------------------------------------------------------------- */

export const fileService =
  new FileService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): FileValidationResult {
  return fileService.validate(
    file,
    options
  );
}

export function createManagedFile(
  input: CreateFileInput,
  validationOptions: FileValidationOptions = {}
): ManagedFile {
  return fileService.create(
    input,
    validationOptions
  );
}

export function getManagedFile(
  fileId: string
): ManagedFile | undefined {
  return fileService.get(
    fileId
  );
}

export function listManagedFiles(
  options: FileListOptions = {}
): PaginatedFiles {
  return fileService.list(
    options
  );
}

export function updateManagedFile(
  fileId: string,
  input: UpdateFileInput
): ManagedFile {
  return fileService.update(
    fileId,
    input
  );
}

export function deleteManagedFile(
  fileId: string,
  permanently = false
): void {
  fileService.delete(
    fileId,
    permanently
  );
}

export function createFileObjectUrl(
  fileId: string
): FileObjectUrl {
  return fileService.createObjectUrl(
    fileId
  );
}

export function revokeFileObjectUrl(
  fileId: string
): void {
  fileService.revokeObjectUrl(
    fileId
  );
}

export function getNativeFile(
  fileId: string
): File | undefined {
  return fileService.getNativeFile(
    fileId
  );
}

export function readManagedFileAsText(
  fileId: string
): Promise<string> {
  return fileService.readAsText(
    fileId
  );
}

export function readManagedFileAsArrayBuffer(
  fileId: string
): Promise<ArrayBuffer> {
  return fileService.readAsArrayBuffer(
    fileId
  );
}

export function readManagedFileAsDataUrl(
  fileId: string
): Promise<string> {
  return fileService.readAsDataUrl(
    fileId
  );
}

export default fileService;