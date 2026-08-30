/**
 * SYRAVEN File Types
 *
 * Enterprise-grade file domain models and contracts.
 *
 * Shared by:
 * - File Service
 * - Storage Service
 * - Document Reader
 * - Search Service
 * - Knowledge Service
 * - Projects
 * - Chat Attachments
 * - AI Processing
 */

/* -------------------------------------------------------------------------- */
/*                                  PRIMITIVES                                */
/* -------------------------------------------------------------------------- */

export type FileId = string;

export type FileName = string;

export type FileMimeType = string;

export type FileSize = number;

export type FileUrl = string;

export type FileChecksum = string;

/* -------------------------------------------------------------------------- */
/*                                FILE STATUS                                 */
/* -------------------------------------------------------------------------- */

export type FileStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "deleted";

/* -------------------------------------------------------------------------- */
/*                                 FILE TYPE                                  */
/* -------------------------------------------------------------------------- */

export type FileType =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "spreadsheet"
  | "presentation"
  | "text"
  | "code"
  | "other";

/* -------------------------------------------------------------------------- */
/*                              FILE VISIBILITY                               */
/* -------------------------------------------------------------------------- */

export type FileVisibility =
  | "private"
  | "workspace"
  | "project"
  | "public";

/* -------------------------------------------------------------------------- */
/*                              STORAGE PROVIDER                              */
/* -------------------------------------------------------------------------- */

export type StorageProvider =
  | "local"
  | "memory"
  | "s3"
  | "r2"
  | "gcs"
  | "azure"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                              PROCESSING STATUS                             */
/* -------------------------------------------------------------------------- */

export type FileProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/* -------------------------------------------------------------------------- */
/*                              PROCESSING TYPE                               */
/* -------------------------------------------------------------------------- */

export type FileProcessingType =
  | "text_extraction"
  | "ocr"
  | "thumbnail"
  | "preview"
  | "embedding"
  | "virus_scan"
  | "metadata_extraction"
  | "transcription"
  | "conversion"
  | "custom";

/* -------------------------------------------------------------------------- */
/*                              FILE METADATA                                 */
/* -------------------------------------------------------------------------- */

export interface FileMetadata {
  title?: string;

  description?: string;

  author?: string;

  subject?: string;

  keywords?: string[];

  language?: string;

  pageCount?: number;

  wordCount?: number;

  characterCount?: number;

  width?: number;

  height?: number;

  duration?: number;

  encoding?: string;

  createdAt?: Date;

  modifiedAt?: Date;

  custom?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              FILE PROCESSING                               */
/* -------------------------------------------------------------------------- */

export interface FileProcessingResult {
  type: FileProcessingType;

  status: FileProcessingStatus;

  startedAt?: Date;

  completedAt?: Date;

  error?: string;

  metadata?: Record<string, unknown>;
}

export interface FileProcessingInfo {
  status: FileProcessingStatus;

  results: FileProcessingResult[];

  startedAt?: Date;

  completedAt?: Date;

  error?: string;
}

/* -------------------------------------------------------------------------- */
/*                              FILE STORAGE                                  */
/* -------------------------------------------------------------------------- */

export interface FileStorageLocation {
  provider: StorageProvider;

  bucket?: string;

  key: string;

  region?: string;

  url?: FileUrl;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               FILE PREVIEW                                 */
/* -------------------------------------------------------------------------- */

export interface FilePreview {
  url: FileUrl;

  mimeType?: FileMimeType;

  width?: number;

  height?: number;

  generatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                                FILE THUMBNAIL                              */
/* -------------------------------------------------------------------------- */

export interface FileThumbnail {
  url: FileUrl;

  width?: number;

  height?: number;

  size?: FileSize;

  generatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                                   FILE                                     */
/* -------------------------------------------------------------------------- */

export interface FileRecord {
  id: FileId;

  name: FileName;

  originalName: FileName;

  mimeType: FileMimeType;

  type: FileType;

  size: FileSize;

  checksum?: FileChecksum;

  status: FileStatus;

  visibility: FileVisibility;

  ownerId: string;

  workspaceId?: string;

  projectId?: string;

  storage: FileStorageLocation;

  metadata?: FileMetadata;

  processing?: FileProcessingInfo;

  preview?: FilePreview;

  thumbnail?: FileThumbnail;

  tags?: string[];

  createdAt: Date;

  updatedAt: Date;

  deletedAt?: Date;

  metadataRaw?: Record<string, unknown>;
}

/**
 * Backward-compatible alias.
 */
export type File = FileRecord;

/* -------------------------------------------------------------------------- */
/*                               FILE SUMMARY                                 */
/* -------------------------------------------------------------------------- */

export interface FileSummary {
  id: FileId;

  name: FileName;

  mimeType: FileMimeType;

  type: FileType;

  size: FileSize;

  status: FileStatus;

  visibility: FileVisibility;

  ownerId: string;

  workspaceId?: string;

  projectId?: string;

  thumbnailUrl?: FileUrl;

  createdAt: Date;

  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/*                             FILE CREATE INPUT                              */
/* -------------------------------------------------------------------------- */

export interface CreateFileInput {
  name: FileName;

  originalName?: FileName;

  mimeType: FileMimeType;

  size: FileSize;

  type?: FileType;

  checksum?: FileChecksum;

  visibility?: FileVisibility;

  ownerId: string;

  workspaceId?: string;

  projectId?: string;

  storage: FileStorageLocation;

  metadata?: FileMetadata;

  tags?: string[];

  metadataRaw?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             FILE UPDATE INPUT                              */
/* -------------------------------------------------------------------------- */

export interface UpdateFileInput {
  name?: FileName;

  mimeType?: FileMimeType;

  type?: FileType;

  status?: FileStatus;

  visibility?: FileVisibility;

  checksum?: FileChecksum;

  metadata?: FileMetadata;

  processing?: FileProcessingInfo;

  preview?: FilePreview;

  thumbnail?: FileThumbnail;

  tags?: string[];

  metadataRaw?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                             FILE UPLOAD INPUT                              */
/* -------------------------------------------------------------------------- */

export interface UploadFileInput {
  file: Uint8Array | ArrayBuffer;

  name: FileName;

  mimeType: FileMimeType;

  ownerId: string;

  workspaceId?: string;

  projectId?: string;

  visibility?: FileVisibility;

  metadata?: FileMetadata;

  tags?: string[];

  checksum?: FileChecksum;
}

/* -------------------------------------------------------------------------- */
/*                            FILE UPLOAD RESULT                              */
/* -------------------------------------------------------------------------- */

export interface FileUploadResult {
  file: FileRecord;

  uploaded: boolean;

  url?: FileUrl;

  storage: FileStorageLocation;
}

/* -------------------------------------------------------------------------- */
/*                             FILE DOWNLOAD RESULT                           */
/* -------------------------------------------------------------------------- */

export interface FileDownloadResult {
  file: FileRecord;

  data: Uint8Array;

  mimeType: FileMimeType;

  filename: FileName;
}

/* -------------------------------------------------------------------------- */
/*                               FILE LISTING                                 */
/* -------------------------------------------------------------------------- */

export interface FileListOptions {
  ownerId?: string;

  workspaceId?: string;

  projectId?: string;

  type?: FileType | FileType[];

  mimeType?: FileMimeType | FileMimeType[];

  status?: FileStatus | FileStatus[];

  visibility?: FileVisibility | FileVisibility[];

  tags?: string[];

  query?: string;

  limit?: number;

  offset?: number;

  sortBy?: FileSortField;

  sortOrder?: FileSortOrder;

  includeDeleted?: boolean;
}

export type FileSortField =
  | "name"
  | "size"
  | "createdAt"
  | "updatedAt"
  | "mimeType"
  | "type";

export type FileSortOrder =
  | "asc"
  | "desc";

export interface FileListResult {
  files: FileRecord[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/*                               FILE FILTER                                  */
/* -------------------------------------------------------------------------- */

export interface FileFilter {
  ownerId?: string;

  workspaceId?: string;

  projectId?: string;

  status?: FileStatus[];

  types?: FileType[];

  mimeTypes?: FileMimeType[];

  visibility?: FileVisibility[];

  tags?: string[];

  createdAfter?: Date;

  createdBefore?: Date;

  minSize?: number;

  maxSize?: number;
}

/* -------------------------------------------------------------------------- */
/*                              FILE PERMISSIONS                              */
/* -------------------------------------------------------------------------- */

export type FilePermission =
  | "read"
  | "write"
  | "delete"
  | "share"
  | "manage";

export interface FileAccess {
  userId: string;

  permissions: FilePermission[];

  grantedAt: Date;

  grantedBy?: string;

  expiresAt?: Date;
}

/* -------------------------------------------------------------------------- */
/*                              FILE SHARE                                    */
/* -------------------------------------------------------------------------- */

export interface FileShare {
  id: string;

  fileId: FileId;

  userId?: string;

  token?: string;

  permissions: FilePermission[];

  expiresAt?: Date;

  createdAt: Date;

  createdBy: string;

  revokedAt?: Date;
}

/* -------------------------------------------------------------------------- */
/*                             FILE VERSIONING                                */
/* -------------------------------------------------------------------------- */

export interface FileVersion {
  id: string;

  fileId: FileId;

  version: number;

  size: FileSize;

  checksum?: FileChecksum;

  storage: FileStorageLocation;

  createdAt: Date;

  createdBy: string;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              FILE VALIDATION                               */
/* -------------------------------------------------------------------------- */

export interface FileValidationRule {
  maxSize?: number;

  minSize?: number;

  allowedMimeTypes?: string[];

  blockedMimeTypes?: string[];

  allowedExtensions?: string[];

  blockedExtensions?: string[];
}

export interface FileValidationResult {
  valid: boolean;

  errors: string[];

  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/*                               FILE EVENTS                                  */
/* -------------------------------------------------------------------------- */

export type FileEventType =
  | "created"
  | "upload_started"
  | "uploaded"
  | "processing_started"
  | "processing_completed"
  | "processing_failed"
  | "updated"
  | "downloaded"
  | "shared"
  | "unshared"
  | "deleted"
  | "restored";

export interface FileEvent {
  id: string;

  type: FileEventType;

  fileId: FileId;

  actorId?: string;

  timestamp: Date;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                            DOCUMENT INFORMATION                            */
/* -------------------------------------------------------------------------- */

export interface DocumentFileInfo {
  fileId: FileId;

  mimeType: FileMimeType;

  pageCount?: number;

  wordCount?: number;

  characterCount?: number;

  extractedText?: string;

  language?: string;

  processedAt?: Date;
}

/* -------------------------------------------------------------------------- */
/*                              FILE CONSTANTS                                */
/* -------------------------------------------------------------------------- */

export const FILE_STATUS_VALUES = [
  "pending",
  "uploading",
  "uploaded",
  "processing",
  "ready",
  "failed",
  "deleted",
] as const satisfies readonly FileStatus[];

export const FILE_TYPE_VALUES = [
  "document",
  "image",
  "video",
  "audio",
  "archive",
  "spreadsheet",
  "presentation",
  "text",
  "code",
  "other",
] as const satisfies readonly FileType[];

export const FILE_VISIBILITY_VALUES = [
  "private",
  "workspace",
  "project",
  "public",
] as const satisfies readonly FileVisibility[];

export const FILE_PROCESSING_STATUS_VALUES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const satisfies readonly FileProcessingStatus[];

export const FILE_PROCESSING_TYPE_VALUES = [
  "text_extraction",
  "ocr",
  "thumbnail",
  "preview",
  "embedding",
  "virus_scan",
  "metadata_extraction",
  "transcription",
  "conversion",
  "custom",
] as const satisfies readonly FileProcessingType[];

export const FILE_PERMISSION_VALUES = [
  "read",
  "write",
  "delete",
  "share",
  "manage",
] as const satisfies readonly FilePermission[];

export const FILE_EVENT_TYPE_VALUES = [
  "created",
  "upload_started",
  "uploaded",
  "processing_started",
  "processing_completed",
  "processing_failed",
  "updated",
  "downloaded",
  "shared",
  "unshared",
  "deleted",
  "restored",
] as const satisfies readonly FileEventType[];

/* -------------------------------------------------------------------------- */
/*                               TYPE GUARDS                                  */
/* -------------------------------------------------------------------------- */

export function isFileStatus(
  value: unknown
): value is FileStatus {
  return (
    typeof value === "string" &&
    FILE_STATUS_VALUES.includes(
      value as FileStatus
    )
  );
}

export function isFileType(
  value: unknown
): value is FileType {
  return (
    typeof value === "string" &&
    FILE_TYPE_VALUES.includes(
      value as FileType
    )
  );
}

export function isFileVisibility(
  value: unknown
): value is FileVisibility {
  return (
    typeof value === "string" &&
    FILE_VISIBILITY_VALUES.includes(
      value as FileVisibility
    )
  );
}

export function isFilePermission(
  value: unknown
): value is FilePermission {
  return (
    typeof value === "string" &&
    FILE_PERMISSION_VALUES.includes(
      value as FilePermission
    )
  );
}

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

export function getFileExtension(
  filename: string
): string {
  const normalized =
    filename.trim();

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

export function getFileTypeFromMimeType(
  mimeType: string
): FileType {
  const normalized =
    mimeType.toLowerCase();

  if (
    normalized.startsWith(
      "image/"
    )
  ) {
    return "image";
  }

  if (
    normalized.startsWith(
      "video/"
    )
  ) {
    return "video";
  }

  if (
    normalized.startsWith(
      "audio/"
    )
  ) {
    return "audio";
  }

  if (
    normalized.startsWith(
      "text/"
    )
  ) {
    return "text";
  }

  if (
    normalized.includes(
      "pdf"
    ) ||
    normalized.includes(
      "word"
    ) ||
    normalized.includes(
      "document"
    )
  ) {
    return "document";
  }

  if (
    normalized.includes(
      "spreadsheet"
    ) ||
    normalized.includes(
      "excel"
    )
  ) {
    return "spreadsheet";
  }

  if (
    normalized.includes(
      "presentation"
    ) ||
    normalized.includes(
      "powerpoint"
    )
  ) {
    return "presentation";
  }

  if (
    normalized.includes(
      "zip"
    ) ||
    normalized.includes(
      "rar"
    ) ||
    normalized.includes(
      "tar"
    ) ||
    normalized.includes(
      "7z"
    )
  ) {
    return "archive";
  }

  if (
    normalized.includes(
      "javascript"
    ) ||
    normalized.includes(
      "typescript"
    ) ||
    normalized.includes(
      "json"
    ) ||
    normalized.includes(
      "xml"
    ) ||
    normalized.includes(
      "yaml"
    )
  ) {
    return "code";
  }

  return "other";
}

export function createFileSummary(
  file: FileRecord
): FileSummary {
  return {
    id: file.id,

    name: file.name,

    mimeType: file.mimeType,

    type: file.type,

    size: file.size,

    status: file.status,

    visibility:
      file.visibility,

    ownerId: file.ownerId,

    workspaceId:
      file.workspaceId,

    projectId:
      file.projectId,

    thumbnailUrl:
      file.thumbnail?.url,

    createdAt:
      new Date(
        file.createdAt
      ),

    updatedAt:
      new Date(
        file.updatedAt
      ),
  };
}

export function hasFilePermission(
  access: FileAccess,
  permission: FilePermission
): boolean {
  return access.permissions.includes(
    permission
  );
}