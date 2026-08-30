/**
 * SYRAVEN Vision Server
 *
 * Enterprise-grade server-side vision service.
 *
 * Features:
 * - Provider abstraction
 * - Image analysis
 * - OCR-ready requests
 * - Object detection-ready requests
 * - Image description
 * - Structured JSON responses
 * - Multiple image inputs
 * - AbortSignal support
 * - Timeout handling
 * - Provider registry
 * - Strict TypeScript
 * - Server-only architecture
 */

import "server-only";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type VisionProviderName = string;

export type VisionImageSource =
  | string
  | Uint8Array
  | ArrayBuffer;

export type VisionImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | string;

export type VisionTask =
  | "analyze"
  | "describe"
  | "ocr"
  | "detect"
  | "classify"
  | "custom";

export interface VisionImage {
  source: VisionImageSource;

  mimeType?: VisionImageMimeType;

  name?: string;

  metadata?: Record<string, unknown>;
}

export interface VisionBoundingBox {
  x: number;

  y: number;

  width: number;

  height: number;
}

export interface VisionDetectedObject {
  label: string;

  confidence?: number;

  boundingBox?: VisionBoundingBox;

  metadata?: Record<string, unknown>;
}

export interface VisionOcrBlock {
  text: string;

  confidence?: number;

  boundingBox?: VisionBoundingBox;

  metadata?: Record<string, unknown>;
}

export interface VisionUsage {
  inputImages: number;

  inputBytes?: number;

  processingTimeMs?: number;

  provider?: VisionProviderName;

  model?: string;
}

export interface VisionResult<TData = unknown> {
  id: string;

  task: VisionTask;

  provider: VisionProviderName;

  model?: string;

  createdAt: Date;

  text?: string;

  description?: string;

  objects?: VisionDetectedObject[];

  ocr?: VisionOcrBlock[];

  data?: TData;

  usage?: VisionUsage;

  metadata?: Record<string, unknown>;
}

export interface VisionAnalyzeInput {
  images: VisionImage[];

  prompt?: string;

  task?: VisionTask;

  model?: string;

  temperature?: number;

  maxTokens?: number;

  metadata?: Record<string, unknown>;

  signal?: AbortSignal;

  timeoutMs?: number;
}

export interface VisionProviderRequest {
  images: VisionImage[];

  prompt?: string;

  task: VisionTask;

  model?: string;

  temperature?: number;

  maxTokens?: number;

  metadata?: Record<string, unknown>;

  signal?: AbortSignal;
}

export interface VisionProviderResponse<TData = unknown> {
  text?: string;

  description?: string;

  objects?: VisionDetectedObject[];

  ocr?: VisionOcrBlock[];

  data?: TData;

  model?: string;

  usage?: Partial<VisionUsage>;

  metadata?: Record<string, unknown>;
}

export interface VisionProvider {
  readonly name: VisionProviderName;

  analyze<TData = unknown>(
    input: VisionProviderRequest
  ): Promise<VisionProviderResponse<TData>>;
}

export interface VisionServiceOptions {
  defaultProvider?: VisionProviderName;

  defaultTimeoutMs?: number;

  maxImages?: number;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class VisionError extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name = "VisionError";
  }
}

export class VisionValidationError extends VisionError {
  constructor(
    message: string
  ) {
    super(message);

    this.name = "VisionValidationError";
  }
}

export class VisionProviderNotFoundError extends VisionError {
  constructor(
    provider: string
  ) {
    super(
      `Vision provider not found: ${provider}`
    );

    this.name =
      "VisionProviderNotFoundError";
  }
}

export class VisionTimeoutError extends VisionError {
  constructor(
    timeoutMs: number
  ) {
    super(
      `Vision request timed out after ${timeoutMs}ms.`
    );

    this.name =
      "VisionTimeoutError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_VISION_TIMEOUT_MS =
  60_000;

export const MAX_VISION_IMAGES =
  20;

export const MIN_VISION_TIMEOUT_MS =
  1_000;

export const MAX_VISION_TIMEOUT_MS =
  5 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*                              VISION SERVICE                                */
/* -------------------------------------------------------------------------- */

export class VisionService {
  private readonly providers =
    new Map<
      VisionProviderName,
      VisionProvider
    >();

  private defaultProvider?: VisionProviderName;

  private readonly defaultTimeoutMs: number;

  private readonly maxImages: number;

  constructor(
    options: VisionServiceOptions = {}
  ) {
    this.defaultProvider =
      options.defaultProvider;

    this.defaultTimeoutMs =
      normalizeTimeout(
        options.defaultTimeoutMs ??
          DEFAULT_VISION_TIMEOUT_MS
      );

    this.maxImages =
      normalizeMaxImages(
        options.maxImages ??
          MAX_VISION_IMAGES
      );
  }

  /* ------------------------------------------------------------------------ */
  /*                                PROVIDERS                                 */
  /* ------------------------------------------------------------------------ */

  registerProvider(
    provider: VisionProvider
  ): void {
    if (
      !provider ||
      typeof provider !== "object"
    ) {
      throw new VisionValidationError(
        "Vision provider is required."
      );
    }

    if (
      typeof provider.name !== "string" ||
      !provider.name.trim()
    ) {
      throw new VisionValidationError(
        "Vision provider name is required."
      );
    }

    if (
      typeof provider.analyze !== "function"
    ) {
      throw new VisionValidationError(
        `Vision provider "${provider.name}" must implement analyze().`
      );
    }

    this.providers.set(
      provider.name.trim(),
      provider
    );
  }

  unregisterProvider(
    name: VisionProviderName
  ): boolean {
    return this.providers.delete(
      normalizeProviderName(name)
    );
  }

  hasProvider(
    name: VisionProviderName
  ): boolean {
    return this.providers.has(
      normalizeProviderName(name)
    );
  }

  getProvider(
    name?: VisionProviderName
  ): VisionProvider {
    const providerName =
      name ??
      this.defaultProvider;

    if (!providerName) {
      throw new VisionProviderNotFoundError(
        "default"
      );
    }

    const provider =
      this.providers.get(
        normalizeProviderName(
          providerName
        )
      );

    if (!provider) {
      throw new VisionProviderNotFoundError(
        providerName
      );
    }

    return provider;
  }

  getProviders(): VisionProviderName[] {
    return Array.from(
      this.providers.keys()
    );
  }

  setDefaultProvider(
    name: VisionProviderName
  ): void {
    const normalized =
      normalizeProviderName(
        name
      );

    if (
      !this.providers.has(
        normalized
      )
    ) {
      throw new VisionProviderNotFoundError(
        normalized
      );
    }

    this.defaultProvider =
      normalized;
  }

  getDefaultProvider():
    | VisionProviderName
    | undefined {
    return this.defaultProvider;
  }

  /* ------------------------------------------------------------------------ */
  /*                                  ANALYZE                                 */
  /* ------------------------------------------------------------------------ */

  async analyze<TData = unknown>(
    input: VisionAnalyzeInput,
    providerName?: VisionProviderName
  ): Promise<VisionResult<TData>> {
    this.validateInput(
      input
    );

    const provider =
      this.getProvider(
        providerName
      );

    const startedAt =
      Date.now();

    const timeoutMs =
      input.timeoutMs === undefined
        ? this.defaultTimeoutMs
        : normalizeTimeout(
            input.timeoutMs
          );

    const controller =
      new AbortController();

    const signal =
      mergeAbortSignals(
        input.signal,
        controller.signal
      );

    try {
      const response =
        await executeWithTimeout(
          provider.analyze<TData>({
            images:
              input.images.map(
                cloneImage
              ),

            prompt:
              input.prompt,

            task:
              input.task ??
              "analyze",

            model:
              input.model,

            temperature:
              input.temperature,

            maxTokens:
              input.maxTokens,

            metadata:
              input.metadata
                ? {
                    ...input.metadata,
                  }
                : undefined,

            signal,
          }),
          timeoutMs,
          () => {
            controller.abort();
          }
        );

      const processingTimeMs =
        Date.now() -
        startedAt;

      return {
        id:
          generateVisionId(),

        task:
          input.task ??
          "analyze",

        provider:
          provider.name,

        model:
          response.model ??
          input.model,

        createdAt:
          new Date(),

        text:
          response.text,

        description:
          response.description,

        objects:
          response.objects
            ? response.objects.map(
                cloneDetectedObject
              )
            : undefined,

        ocr:
          response.ocr
            ? response.ocr.map(
                cloneOcrBlock
              )
            : undefined,

        data:
          response.data,

        usage: {
          inputImages:
            input.images.length,

          inputBytes:
            calculateInputBytes(
              input.images
            ),

          processingTimeMs,

          provider:
            provider.name,

          model:
            response.model ??
            input.model,

          ...response.usage,
        },

        metadata:
          response.metadata
            ? {
                ...response.metadata,
              }
            : input.metadata
              ? {
                  ...input.metadata,
                }
              : undefined,
      };
    } finally {
      controller.abort();
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                              CONVENIENCE API                             */
  /* ------------------------------------------------------------------------ */

  async describe(
    images:
      | VisionImage
      | VisionImage[],
    prompt?: string,
    providerName?: VisionProviderName
  ): Promise<VisionResult> {
    return this.analyze(
      {
        images:
          normalizeImages(
            images
          ),

        prompt:
          prompt ??
          "Describe this image in detail.",

        task:
          "describe",
      },
      providerName
    );
  }

  async extractText(
    images:
      | VisionImage
      | VisionImage[],
    providerName?: VisionProviderName
  ): Promise<VisionResult> {
    return this.analyze(
      {
        images:
          normalizeImages(
            images
          ),

        prompt:
          "Extract all visible text accurately.",

        task:
          "ocr",
      },
      providerName
    );
  }

  async detectObjects(
    images:
      | VisionImage
      | VisionImage[],
    providerName?: VisionProviderName
  ): Promise<VisionResult> {
    return this.analyze(
      {
        images:
          normalizeImages(
            images
          ),

        prompt:
          "Detect and identify visible objects.",

        task:
          "detect",
      },
      providerName
    );
  }

  async classify(
    images:
      | VisionImage
      | VisionImage[],
    prompt?: string,
    providerName?: VisionProviderName
  ): Promise<VisionResult> {
    return this.analyze(
      {
        images:
          normalizeImages(
            images
          ),

        prompt:
          prompt ??
          "Classify the primary content of this image.",

        task:
          "classify",
      },
      providerName
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                VALIDATION                                */
  /* ------------------------------------------------------------------------ */

  private validateInput(
    input: VisionAnalyzeInput
  ): void {
    if (
      !input ||
      typeof input !== "object"
    ) {
      throw new VisionValidationError(
        "Vision input is required."
      );
    }

    if (
      !Array.isArray(
        input.images
      ) ||
      input.images.length === 0
    ) {
      throw new VisionValidationError(
        "At least one image is required."
      );
    }

    if (
      input.images.length >
      this.maxImages
    ) {
      throw new VisionValidationError(
        `Maximum ${this.maxImages} images are allowed per request.`
      );
    }

    for (
      const image of input.images
    ) {
      if (
        !image ||
        typeof image !== "object"
      ) {
        throw new VisionValidationError(
          "Invalid image input."
        );
      }

      if (
        image.source ===
          undefined ||
        image.source === null
      ) {
        throw new VisionValidationError(
          "Image source is required."
        );
      }

      if (
        typeof image.source ===
          "string" &&
        !image.source.trim()
      ) {
        throw new VisionValidationError(
          "Image source cannot be empty."
        );
      }
    }

    if (
      input.temperature !==
        undefined &&
      (
        !Number.isFinite(
          input.temperature
        ) ||
        input.temperature < 0 ||
        input.temperature > 2
      )
    ) {
      throw new VisionValidationError(
        "Temperature must be between 0 and 2."
      );
    }

    if (
      input.maxTokens !==
        undefined &&
      (
        !Number.isFinite(
          input.maxTokens
        ) ||
        input.maxTokens <= 0
      )
    ) {
      throw new VisionValidationError(
        "maxTokens must be a positive number."
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                              HELPER FUNCTIONS                              */
/* -------------------------------------------------------------------------- */

function normalizeProviderName(
  value: string
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new VisionValidationError(
      "Vision provider name is required."
    );
  }

  return value.trim();
}

function normalizeTimeout(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    value < MIN_VISION_TIMEOUT_MS
  ) {
    throw new VisionValidationError(
      `Timeout must be at least ${MIN_VISION_TIMEOUT_MS}ms.`
    );
  }

  return Math.min(
    Math.floor(value),
    MAX_VISION_TIMEOUT_MS
  );
}

function normalizeMaxImages(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new VisionValidationError(
      "maxImages must be a positive number."
    );
  }

  return Math.floor(value);
}

function normalizeImages(
  images:
    | VisionImage
    | VisionImage[]
): VisionImage[] {
  return Array.isArray(
    images
  )
    ? images
    : [images];
}

function generateVisionId(): string {
  const random =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `vision_${Date.now()}_${random}`;
}

function cloneImage(
  image: VisionImage
): VisionImage {
  return {
    ...image,

    source:
      cloneImageSource(
        image.source
      ),

    metadata:
      image.metadata
        ? {
            ...image.metadata,
          }
        : undefined,
  };
}

function cloneImageSource(
  source: VisionImageSource
): VisionImageSource {
  if (
    source instanceof Uint8Array
  ) {
    return new Uint8Array(
      source
    );
  }

  if (
    source instanceof ArrayBuffer
  ) {
    return source.slice(0);
  }

  return source;
}

function cloneDetectedObject(
  object: VisionDetectedObject
): VisionDetectedObject {
  return {
    ...object,

    boundingBox:
      object.boundingBox
        ? {
            ...object.boundingBox,
          }
        : undefined,

    metadata:
      object.metadata
        ? {
            ...object.metadata,
          }
        : undefined,
  };
}

function cloneOcrBlock(
  block: VisionOcrBlock
): VisionOcrBlock {
  return {
    ...block,

    boundingBox:
      block.boundingBox
        ? {
            ...block.boundingBox,
          }
        : undefined,

    metadata:
      block.metadata
        ? {
            ...block.metadata,
          }
        : undefined,
  };
}

function calculateInputBytes(
  images: VisionImage[]
): number | undefined {
  let total = 0;

  let hasKnownSize = false;

  for (
    const image of images
  ) {
    if (
      image.source instanceof
      Uint8Array
    ) {
      total +=
        image.source.byteLength;

      hasKnownSize = true;

      continue;
    }

    if (
      image.source instanceof
      ArrayBuffer
    ) {
      total +=
        image.source.byteLength;

      hasKnownSize = true;
    }
  }

  return hasKnownSize
    ? total
    : undefined;
}

async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void
): Promise<T> {
  let timeoutId:
    | ReturnType<typeof setTimeout>
    | undefined;

  const timeout =
    new Promise<never>(
      (
        _resolve,
        reject
      ) => {
        timeoutId =
          setTimeout(
            () => {
              onTimeout();

              reject(
                new VisionTimeoutError(
                  timeoutMs
                )
              );
            },
            timeoutMs
          );
      }
    );

  try {
    return await Promise.race([
      promise,
      timeout,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(
        timeoutId
      );
    }
  }
}

function mergeAbortSignals(
  first?: AbortSignal,
  second?: AbortSignal
): AbortSignal | undefined {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  if (
    first.aborted ||
    second.aborted
  ) {
    const controller =
      new AbortController();

    controller.abort();

    return controller.signal;
  }

  const controller =
    new AbortController();

  const abort = () => {
    controller.abort();
  };

  first.addEventListener(
    "abort",
    abort,
    { once: true }
  );

  second.addEventListener(
    "abort",
    abort,
    { once: true }
  );

  return controller.signal;
}

/* -------------------------------------------------------------------------- */
/*                                SINGLETON                                   */
/* -------------------------------------------------------------------------- */

export const visionService =
  new VisionService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function registerVisionProvider(
  provider: VisionProvider
): void {
  visionService.registerProvider(
    provider
  );
}

export function unregisterVisionProvider(
  name: VisionProviderName
): boolean {
  return visionService.unregisterProvider(
    name
  );
}

export function setDefaultVisionProvider(
  name: VisionProviderName
): void {
  visionService.setDefaultProvider(
    name
  );
}

export function getVisionProvider(
  name?: VisionProviderName
): VisionProvider {
  return visionService.getProvider(
    name
  );
}

export function getVisionProviders():
  VisionProviderName[] {
  return visionService.getProviders();
}

export async function analyzeImage<
  TData = unknown
>(
  input: VisionAnalyzeInput,
  providerName?: VisionProviderName
): Promise<VisionResult<TData>> {
  return visionService.analyze<TData>(
    input,
    providerName
  );
}

export async function describeImage(
  images:
    | VisionImage
    | VisionImage[],
  prompt?: string,
  providerName?: VisionProviderName
): Promise<VisionResult> {
  return visionService.describe(
    images,
    prompt,
    providerName
  );
}

export async function extractTextFromImage(
  images:
    | VisionImage
    | VisionImage[],
  providerName?: VisionProviderName
): Promise<VisionResult> {
  return visionService.extractText(
    images,
    providerName
  );
}

export async function detectImageObjects(
  images:
    | VisionImage
    | VisionImage[],
  providerName?: VisionProviderName
): Promise<VisionResult> {
  return visionService.detectObjects(
    images,
    providerName
  );
}

export async function classifyImage(
  images:
    | VisionImage
    | VisionImage[],
  prompt?: string,
  providerName?: VisionProviderName
): Promise<VisionResult> {
  return visionService.classify(
    images,
    prompt,
    providerName
  );
}

export default visionService;