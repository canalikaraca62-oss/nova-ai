/**
 * SYRAVEN Storage Service
 *
 * Enterprise-grade storage abstraction.
 *
 * Features:
 * - Provider-based architecture
 * - In-memory provider
 * - Upload / download
 * - Metadata
 * - List
 * - Copy
 * - Move
 * - Delete
 * - Batch delete
 * - Signed URL abstraction
 * - File validation
 * - Path normalization
 * - Size limits
 * - Strict TypeScript
 *
 * Production providers can later include:
 * - Supabase Storage
 * - Amazon S3
 * - Cloudflare R2
 * - Google Cloud Storage
 * - Azure Blob Storage
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type StorageBody =
  | string
  | Uint8Array
  | ArrayBuffer;

export type StorageContentType =
  | string;

export interface StorageFile {
  path: string;

  size: number;

  contentType?: StorageContentType;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface StorageObject
  extends StorageFile {
  body: Uint8Array;
}

export interface StorageUploadInput {
  path: string;

  body: StorageBody;

  contentType?: StorageContentType;

  metadata?: Record<
    string,
    unknown
  >;

  overwrite?: boolean;
}

export interface StorageUploadResult {
  path: string;

  size: number;

  contentType?: StorageContentType;

  createdAt: Date;

  updatedAt: Date;
}

export interface StorageListOptions {
  prefix?: string;

  limit?: number;

  offset?: number;
}

export interface StorageListResult {
  files: StorageFile[];

  total: number;

  limit: number;

  offset: number;

  hasMore: boolean;
}

export interface StorageSignedUrlOptions {
  expiresIn?: number;

  method?: "GET" | "PUT";
}

export interface StorageSignedUrl {
  url: string;

  expiresAt: Date;

  method: "GET" | "PUT";

  path: string;
}

export interface StorageProvider {
  upload(
    input: StorageUploadInput
  ): Promise<StorageUploadResult>;

  download(
    path: string
  ): Promise<StorageObject>;

  getMetadata(
    path: string
  ): Promise<StorageFile | undefined>;

  exists(
    path: string
  ): Promise<boolean>;

  list(
    options?: StorageListOptions
  ): Promise<StorageListResult>;

  delete(
    path: string
  ): Promise<void>;

  deleteMany(
    paths: string[]
  ): Promise<void>;

  copy(
    sourcePath: string,
    destinationPath: string,
    overwrite?: boolean
  ): Promise<void>;

  move(
    sourcePath: string,
    destinationPath: string,
    overwrite?: boolean
  ): Promise<void>;

  createSignedUrl(
    path: string,
    options?: StorageSignedUrlOptions
  ): Promise<StorageSignedUrl>;

  clear(): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class StorageServiceError
  extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "StorageServiceError";
  }
}

export class StorageValidationError
  extends StorageServiceError {
  readonly errors: string[];

  constructor(
    errors: string[]
  ) {
    super(
      errors.join(" ")
    );

    this.name =
      "StorageValidationError";

    this.errors =
      errors;
  }
}

export class StorageNotFoundError
  extends StorageServiceError {
  constructor(
    path: string
  ) {
    super(
      `Storage object not found: ${path}`
    );

    this.name =
      "StorageNotFoundError";
  }
}

export class StorageConflictError
  extends StorageServiceError {
  constructor(
    path: string
  ) {
    super(
      `Storage object already exists: ${path}`
    );

    this.name =
      "StorageConflictError";
  }
}

export class StorageProviderError
  extends StorageServiceError {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "StorageProviderError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_STORAGE_LIST_LIMIT =
  100;

export const MAX_STORAGE_LIST_LIMIT =
  1_000;

export const DEFAULT_SIGNED_URL_EXPIRATION =
  60 * 60;

export const MAX_SIGNED_URL_EXPIRATION =
  60 * 60 * 24 * 7;

export const DEFAULT_MAX_FILE_SIZE =
  100 * 1024 * 1024;

/* -------------------------------------------------------------------------- */
/*                            IN-MEMORY PROVIDER                              */
/* -------------------------------------------------------------------------- */

interface InMemoryStorageEntry {
  body: Uint8Array;

  contentType?: StorageContentType;

  createdAt: Date;

  updatedAt: Date;

  metadata?: Record<
    string,
    unknown
  >;
}

export class InMemoryStorageProvider
  implements StorageProvider {
  private readonly objects =
    new Map<
      string,
      InMemoryStorageEntry
    >();

  async upload(
    input: StorageUploadInput
  ): Promise<StorageUploadResult> {
    const path =
      normalizeStoragePath(
        input.path
      );

    const body =
      storageBodyToUint8Array(
        input.body
      );

    const existing =
      this.objects.get(
        path
      );

    if (
      existing &&
      input.overwrite !== true
    ) {
      throw new StorageConflictError(
        path
      );
    }

    const now =
      new Date();

    const entry:
      InMemoryStorageEntry = {
        body:
          new Uint8Array(
            body
          ),

        contentType:
          input.contentType,

        createdAt:
          existing?.createdAt ??
          now,

        updatedAt:
          now,

        metadata:
          input.metadata
            ? {
                ...input.metadata,
              }
            : undefined,
      };

    this.objects.set(
      path,
      entry
    );

    return {
      path,

      size:
        entry.body.byteLength,

      contentType:
        entry.contentType,

      createdAt:
        new Date(
          entry.createdAt
        ),

      updatedAt:
        new Date(
          entry.updatedAt
        ),
    };
  }

  async download(
    inputPath: string
  ): Promise<StorageObject> {
    const path =
      normalizeStoragePath(
        inputPath
      );

    const entry =
      this.objects.get(
        path
      );

    if (!entry) {
      throw new StorageNotFoundError(
        path
      );
    }

    return {
      path,

      size:
        entry.body.byteLength,

      body:
        new Uint8Array(
          entry.body
        ),

      contentType:
        entry.contentType,

      createdAt:
        new Date(
          entry.createdAt
        ),

      updatedAt:
        new Date(
          entry.updatedAt
        ),

      metadata:
        entry.metadata
          ? {
              ...entry.metadata,
            }
          : undefined,
    };
  }

  async getMetadata(
    inputPath: string
  ): Promise<
    StorageFile | undefined
  > {
    const path =
      normalizeStoragePath(
        inputPath
      );

    const entry =
      this.objects.get(
        path
      );

    if (!entry) {
      return undefined;
    }

    return {
      path,

      size:
        entry.body.byteLength,

      contentType:
        entry.contentType,

      createdAt:
        new Date(
          entry.createdAt
        ),

      updatedAt:
        new Date(
          entry.updatedAt
        ),

      metadata:
        entry.metadata
          ? {
              ...entry.metadata,
            }
          : undefined,
    };
  }

  async exists(
    inputPath: string
  ): Promise<boolean> {
    const path =
      normalizeStoragePath(
        inputPath
      );

    return this.objects.has(
      path
    );
  }

  async list(
    options: StorageListOptions = {}
  ): Promise<StorageListResult> {
    const prefix =
      options.prefix
        ? normalizeStoragePrefix(
            options.prefix
          )
        : "";

    const limit =
      normalizeListLimit(
        options.limit
      );

    const offset =
      normalizeOffset(
        options.offset
      );

    const files =
      Array.from(
        this.objects.entries()
      )
        .filter(
          ([path]) =>
            !prefix ||
            path.startsWith(
              prefix
            )
        )
        .map(
          ([
            path,
            entry,
          ]) => ({
            path,

            size:
              entry.body.byteLength,

            contentType:
              entry.contentType,

            createdAt:
              new Date(
                entry.createdAt
              ),

            updatedAt:
              new Date(
                entry.updatedAt
              ),

            metadata:
              entry.metadata
                ? {
                    ...entry.metadata,
                  }
                : undefined,
          })
        )
        .sort(
          (a, b) =>
            a.path.localeCompare(
              b.path
            )
        );

    const total =
      files.length;

    const paginated =
      files.slice(
        offset,
        offset + limit
      );

    return {
      files:
        paginated,

      total,

      limit,

      offset,

      hasMore:
        offset + limit <
        total,
    };
  }

  async delete(
    inputPath: string
  ): Promise<void> {
    const path =
      normalizeStoragePath(
        inputPath
      );

    this.objects.delete(
      path
    );
  }

  async deleteMany(
    paths: string[]
  ): Promise<void> {
    for (
      const path of paths
    ) {
      await this.delete(
        path
      );
    }
  }

  async copy(
    sourceInputPath: string,
    destinationInputPath: string,
    overwrite = false
  ): Promise<void> {
    const sourcePath =
      normalizeStoragePath(
        sourceInputPath
      );

    const destinationPath =
      normalizeStoragePath(
        destinationInputPath
      );

    const source =
      this.objects.get(
        sourcePath
      );

    if (!source) {
      throw new StorageNotFoundError(
        sourcePath
      );
    }

    const destination =
      this.objects.get(
        destinationPath
      );

    if (
      destination &&
      !overwrite
    ) {
      throw new StorageConflictError(
        destinationPath
      );
    }

    const now =
      new Date();

    this.objects.set(
      destinationPath,
      {
        body:
          new Uint8Array(
            source.body
          ),

        contentType:
          source.contentType,

        createdAt:
          destination?.createdAt ??
          now,

        updatedAt:
          now,

        metadata:
          source.metadata
            ? {
                ...source.metadata,
              }
            : undefined,
      }
    );
  }

  async move(
    sourceInputPath: string,
    destinationInputPath: string,
    overwrite = false
  ): Promise<void> {
    const sourcePath =
      normalizeStoragePath(
        sourceInputPath
      );

    const destinationPath =
      normalizeStoragePath(
        destinationInputPath
      );

    await this.copy(
      sourcePath,
      destinationPath,
      overwrite
    );

    this.objects.delete(
      sourcePath
    );
  }

  async createSignedUrl(
    inputPath: string,
    options: StorageSignedUrlOptions = {}
  ): Promise<StorageSignedUrl> {
    const path =
      normalizeStoragePath(
        inputPath
      );

    const exists =
      this.objects.has(
        path
      );

    const method =
      options.method ??
      "GET";

    if (
      method === "GET" &&
      !exists
    ) {
      throw new StorageNotFoundError(
        path
      );
    }

    const expiresIn =
      normalizeSignedUrlExpiration(
        options.expiresIn
      );

    const expiresAt =
      new Date(
        Date.now() +
          expiresIn * 1000
      );

    const token =
      createStorageToken(
        path,
        expiresAt
      );

    const encodedPath =
      encodeURIComponent(
        path
      );

    return {
      url:
        `memory://storage/${encodedPath}?token=${token}&expires=${expiresAt.getTime()}`,

      expiresAt,

      method,

      path,
    };
  }

  async clear(): Promise<void> {
    this.objects.clear();
  }
}

/* -------------------------------------------------------------------------- */
/*                               STORAGE SERVICE                              */
/* -------------------------------------------------------------------------- */

export class StorageService {
  private provider:
    StorageProvider;

  private maxFileSize =
    DEFAULT_MAX_FILE_SIZE;

  constructor(
    provider: StorageProvider =
      new InMemoryStorageProvider()
  ) {
    this.provider =
      provider;
  }

  setProvider(
    provider: StorageProvider
  ): void {
    if (!provider) {
      throw new StorageValidationError([
        "Storage provider is required.",
      ]);
    }

    this.provider =
      provider;
  }

  getProvider(): StorageProvider {
    return this.provider;
  }

  setMaxFileSize(
    bytes: number
  ): void {
    if (
      !Number.isFinite(
        bytes
      ) ||
      bytes <= 0
    ) {
      throw new StorageValidationError([
        "Maximum file size must be a positive finite number.",
      ]);
    }

    this.maxFileSize =
      Math.floor(
        bytes
      );
  }

  getMaxFileSize(): number {
    return this.maxFileSize;
  }

  async upload(
    input: StorageUploadInput
  ): Promise<StorageUploadResult> {
    this.validateUploadInput(
      input
    );

    const body =
      storageBodyToUint8Array(
        input.body
      );

    if (
      body.byteLength >
      this.maxFileSize
    ) {
      throw new StorageValidationError([
        `File exceeds maximum size of ${this.maxFileSize} bytes.`,
      ]);
    }

    return this.provider.upload({
      ...input,

      path:
        normalizeStoragePath(
          input.path
        ),

      body,
    });
  }

  async uploadText(
    path: string,
    text: string,
    options?: Omit<
      StorageUploadInput,
      "path" | "body"
    >
  ): Promise<StorageUploadResult> {
    return this.upload({
      path,

      body: text,

      contentType:
        options?.contentType ??
        "text/plain; charset=utf-8",

      metadata:
        options?.metadata,

      overwrite:
        options?.overwrite,
    });
  }

  async download(
    path: string
  ): Promise<StorageObject> {
    return this.provider.download(
      normalizeStoragePath(
        path
      )
    );
  }

  async downloadBytes(
    path: string
  ): Promise<Uint8Array> {
    const object =
      await this.download(
        path
      );

    return new Uint8Array(
      object.body
    );
  }

  async downloadText(
    path: string
  ): Promise<string> {
    const body =
      await this.downloadBytes(
        path
      );

    return new TextDecoder().decode(
      body
    );
  }

  async getMetadata(
    path: string
  ): Promise<
    StorageFile | undefined
  > {
    return this.provider.getMetadata(
      normalizeStoragePath(
        path
      )
    );
  }

  async requireMetadata(
    path: string
  ): Promise<StorageFile> {
    const normalizedPath =
      normalizeStoragePath(
        path
      );

    const metadata =
      await this.getMetadata(
        normalizedPath
      );

    if (!metadata) {
      throw new StorageNotFoundError(
        normalizedPath
      );
    }

    return metadata;
  }

  async exists(
    path: string
  ): Promise<boolean> {
    return this.provider.exists(
      normalizeStoragePath(
        path
      )
    );
  }

  async list(
    options: StorageListOptions = {}
  ): Promise<StorageListResult> {
    return this.provider.list({
      ...options,

      prefix:
        options.prefix
          ? normalizeStoragePrefix(
              options.prefix
            )
          : undefined,

      limit:
        normalizeListLimit(
          options.limit
        ),

      offset:
        normalizeOffset(
          options.offset
        ),
    });
  }

  async delete(
    path: string
  ): Promise<void> {
    await this.provider.delete(
      normalizeStoragePath(
        path
      )
    );
  }

  async deleteMany(
    paths: string[]
  ): Promise<void> {
    const normalizedPaths =
      paths.map(
        normalizeStoragePath
      );

    await this.provider.deleteMany(
      normalizedPaths
    );
  }

  async copy(
    sourcePath: string,
    destinationPath: string,
    overwrite = false
  ): Promise<void> {
    await this.provider.copy(
      normalizeStoragePath(
        sourcePath
      ),
      normalizeStoragePath(
        destinationPath
      ),
      overwrite
    );
  }

  async move(
    sourcePath: string,
    destinationPath: string,
    overwrite = false
  ): Promise<void> {
    await this.provider.move(
      normalizeStoragePath(
        sourcePath
      ),
      normalizeStoragePath(
        destinationPath
      ),
      overwrite
    );
  }

  async createSignedUrl(
    path: string,
    options?: StorageSignedUrlOptions
  ): Promise<StorageSignedUrl> {
    return this.provider.createSignedUrl(
      normalizeStoragePath(
        path
      ),
      options
    );
  }

  async clear(): Promise<void> {
    await this.provider.clear();
  }

  private validateUploadInput(
    input: StorageUploadInput
  ): void {
    const errors: string[] =
      [];

    try {
      normalizeStoragePath(
        input.path
      );
    } catch (
      error
    ) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Invalid storage path."
      );
    }

    if (
      input.body === undefined ||
      input.body === null
    ) {
      errors.push(
        "Storage body is required."
      );
    }

    if (
      input.contentType !== undefined &&
      !input.contentType.trim()
    ) {
      errors.push(
        "Storage content type cannot be empty."
      );
    }

    if (
      errors.length > 0
    ) {
      throw new StorageValidationError(
        errors
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                PATH UTILS                                  */
/* -------------------------------------------------------------------------- */

export function normalizeStoragePath(
  input: string
): string {
  if (
    typeof input !== "string"
  ) {
    throw new StorageValidationError([
      "Storage path must be a string.",
    ]);
  }

  const trimmed =
    input.trim();

  if (!trimmed) {
    throw new StorageValidationError([
      "Storage path is required.",
    ]);
  }

  const normalized =
    trimmed
      .replace(
        /\\/g,
        "/"
      )
      .replace(
        /\/+/g,
        "/"
      )
      .replace(
        /^\/+/,
        ""
      );

  if (
    !normalized
  ) {
    throw new StorageValidationError([
      "Storage path is invalid.",
    ]);
  }

  const segments =
    normalized.split(
      "/"
    );

  for (
    const segment of segments
  ) {
    if (
      !segment ||
      segment === "." ||
      segment === ".."
    ) {
      throw new StorageValidationError([
        "Storage path contains invalid segments.",
      ]);
    }
  }

  return normalized;
}

export function normalizeStoragePrefix(
  input: string
): string {
  if (
    typeof input !== "string"
  ) {
    throw new StorageValidationError([
      "Storage prefix must be a string.",
    ]);
  }

  const trimmed =
    input.trim();

  if (!trimmed) {
    return "";
  }

  const normalized =
    trimmed
      .replace(
        /\\/g,
        "/"
      )
      .replace(
        /\/+/g,
        "/"
      )
      .replace(
        /^\/+/,
        ""
      );

  const segments =
    normalized
      .split("/")
      .filter(Boolean);

  if (
    segments.some(
      (segment) =>
        segment === "." ||
        segment === ".."
    )
  ) {
    throw new StorageValidationError([
      "Storage prefix contains invalid segments.",
    ]);
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/*                                BODY UTILS                                  */
/* -------------------------------------------------------------------------- */

export function storageBodyToUint8Array(
  body: StorageBody
): Uint8Array {
  if (
    typeof body === "string"
  ) {
    return new TextEncoder().encode(
      body
    );
  }

  if (
    body instanceof Uint8Array
  ) {
    return new Uint8Array(
      body
    );
  }

  if (
    body instanceof ArrayBuffer
  ) {
    return new Uint8Array(
      body.slice(0)
    );
  }

  throw new StorageValidationError([
    "Unsupported storage body type.",
  ]);
}

export function storageBodyToText(
  body: StorageBody
): string {
  return new TextDecoder().decode(
    storageBodyToUint8Array(
      body
    )
  );
}

/* -------------------------------------------------------------------------- */
/*                              PAGINATION UTILS                              */
/* -------------------------------------------------------------------------- */

function normalizeListLimit(
  value?: number
): number {
  if (
    value === undefined
  ) {
    return DEFAULT_STORAGE_LIST_LIMIT;
  }

  if (
    !Number.isFinite(
      value
    ) ||
    value <= 0
  ) {
    throw new StorageValidationError([
      "Storage list limit must be a positive finite number.",
    ]);
  }

  return Math.min(
    Math.floor(
      value
    ),
    MAX_STORAGE_LIST_LIMIT
  );
}

function normalizeOffset(
  value?: number
): number {
  if (
    value === undefined
  ) {
    return 0;
  }

  if (
    !Number.isFinite(
      value
    ) ||
    value < 0
  ) {
    throw new StorageValidationError([
      "Storage list offset must be a non-negative finite number.",
    ]);
  }

  return Math.floor(
    value
  );
}

/* -------------------------------------------------------------------------- */
/*                              SIGNED URL UTILS                              */
/* -------------------------------------------------------------------------- */

function normalizeSignedUrlExpiration(
  value?: number
): number {
  const expiration =
    value ??
    DEFAULT_SIGNED_URL_EXPIRATION;

  if (
    !Number.isFinite(
      expiration
    ) ||
    expiration <= 0
  ) {
    throw new StorageValidationError([
      "Signed URL expiration must be a positive finite number.",
    ]);
  }

  return Math.min(
    Math.floor(
      expiration
    ),
    MAX_SIGNED_URL_EXPIRATION
  );
}

function createStorageToken(
  path: string,
  expiresAt: Date
): string {
  const source =
    `${path}:${expiresAt.getTime()}:${Math.random()}:${Date.now()}`;

  let hash =
    0;

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    hash =
      (
        (hash << 5) -
        hash
      ) +
      source.charCodeAt(
        index
      );

    hash |= 0;
  }

  return Math.abs(
    hash
  )
    .toString(36)
    .padStart(
      8,
      "0"
    );
}

/* -------------------------------------------------------------------------- */
/*                                SINGLETON                                   */
/* -------------------------------------------------------------------------- */

export const storageService =
  new StorageService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function setStorageProvider(
  provider: StorageProvider
): void {
  storageService.setProvider(
    provider
  );
}

export function getStorageProvider(): StorageProvider {
  return storageService.getProvider();
}

export function setStorageMaxFileSize(
  bytes: number
): void {
  storageService.setMaxFileSize(
    bytes
  );
}

export function getStorageMaxFileSize(): number {
  return storageService.getMaxFileSize();
}

export async function uploadFile(
  input: StorageUploadInput
): Promise<StorageUploadResult> {
  return storageService.upload(
    input
  );
}

export async function uploadText(
  path: string,
  text: string,
  options?: Omit<
    StorageUploadInput,
    "path" | "body"
  >
): Promise<StorageUploadResult> {
  return storageService.uploadText(
    path,
    text,
    options
  );
}

export async function downloadFile(
  path: string
): Promise<StorageObject> {
  return storageService.download(
    path
  );
}

export async function downloadFileBytes(
  path: string
): Promise<Uint8Array> {
  return storageService.downloadBytes(
    path
  );
}

export async function downloadFileText(
  path: string
): Promise<string> {
  return storageService.downloadText(
    path
  );
}

export async function getStorageMetadata(
  path: string
): Promise<
  StorageFile | undefined
> {
  return storageService.getMetadata(
    path
  );
}

export async function requireStorageMetadata(
  path: string
): Promise<StorageFile> {
  return storageService.requireMetadata(
    path
  );
}

export async function storageFileExists(
  path: string
): Promise<boolean> {
  return storageService.exists(
    path
  );
}

export async function listStorageFiles(
  options?: StorageListOptions
): Promise<StorageListResult> {
  return storageService.list(
    options
  );
}

export async function deleteStorageFile(
  path: string
): Promise<void> {
  await storageService.delete(
    path
  );
}

export async function deleteStorageFiles(
  paths: string[]
): Promise<void> {
  await storageService.deleteMany(
    paths
  );
}

export async function copyStorageFile(
  sourcePath: string,
  destinationPath: string,
  overwrite = false
): Promise<void> {
  await storageService.copy(
    sourcePath,
    destinationPath,
    overwrite
  );
}

export async function moveStorageFile(
  sourcePath: string,
  destinationPath: string,
  overwrite = false
): Promise<void> {
  await storageService.move(
    sourcePath,
    destinationPath,
    overwrite
  );
}

export async function createStorageSignedUrl(
  path: string,
  options?: StorageSignedUrlOptions
): Promise<StorageSignedUrl> {
  return storageService.createSignedUrl(
    path,
    options
  );
}

export async function clearStorage(): Promise<void> {
  await storageService.clear();
}

export default storageService;