/**
 * SYRAVEN Voice Service
 *
 * Enterprise-grade voice infrastructure.
 *
 * Features:
 * - Provider abstraction
 * - Text-to-Speech (TTS)
 * - Speech-to-Text (STT)
 * - Audio transcription
 * - Translation-ready transcription
 * - Multiple audio input formats
 * - Voice configuration
 * - Provider registry
 * - Timeout handling
 * - AbortSignal support
 * - Usage tracking
 * - Strict TypeScript
 * - Provider-agnostic architecture
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type VoiceProviderName = string;

export type VoiceTask =
  | "synthesize"
  | "transcribe"
  | "translate"
  | "custom";

export type AudioSource =
  | string
  | Uint8Array
  | ArrayBuffer;

export type AudioMimeType =
  | "audio/mpeg"
  | "audio/mp3"
  | "audio/wav"
  | "audio/x-wav"
  | "audio/ogg"
  | "audio/webm"
  | "audio/mp4"
  | "audio/m4a"
  | string;

export type AudioFormat =
  | "mp3"
  | "wav"
  | "opus"
  | "aac"
  | "flac"
  | "pcm"
  | string;

export interface VoiceAudio {
  source: AudioSource;

  mimeType?: AudioMimeType;

  name?: string;

  metadata?: Record<string, unknown>;
}

export interface VoiceConfig {
  voice?: string;

  language?: string;

  speed?: number;

  pitch?: number;

  volume?: number;

  format?: AudioFormat;

  sampleRate?: number;

  metadata?: Record<string, unknown>;
}

export interface VoiceWord {
  text: string;

  start?: number;

  end?: number;

  confidence?: number;

  metadata?: Record<string, unknown>;
}

export interface VoiceSegment {
  text: string;

  start?: number;

  end?: number;

  confidence?: number;

  speaker?: string;

  words?: VoiceWord[];

  metadata?: Record<string, unknown>;
}

export interface VoiceUsage {
  inputCharacters?: number;

  inputSeconds?: number;

  outputBytes?: number;

  processingTimeMs?: number;

  provider?: VoiceProviderName;

  model?: string;
}

export interface VoiceResult<TData = unknown> {
  id: string;

  task: VoiceTask;

  provider: VoiceProviderName;

  model?: string;

  createdAt: Date;

  text?: string;

  audio?: Uint8Array;

  audioFormat?: AudioFormat;

  language?: string;

  durationSeconds?: number;

  segments?: VoiceSegment[];

  data?: TData;

  usage?: VoiceUsage;

  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               SYNTHESIS TYPES                              */
/* -------------------------------------------------------------------------- */

export interface VoiceSynthesizeInput {
  text: string;

  voice?: string;

  language?: string;

  speed?: number;

  pitch?: number;

  volume?: number;

  format?: AudioFormat;

  sampleRate?: number;

  model?: string;

  metadata?: Record<string, unknown>;

  signal?: AbortSignal;

  timeoutMs?: number;
}

/* -------------------------------------------------------------------------- */
/*                             TRANSCRIPTION TYPES                            */
/* -------------------------------------------------------------------------- */

export interface VoiceTranscribeInput {
  audio: VoiceAudio;

  language?: string;

  prompt?: string;

  model?: string;

  timestamps?: boolean;

  diarization?: boolean;

  metadata?: Record<string, unknown>;

  signal?: AbortSignal;

  timeoutMs?: number;
}

/* -------------------------------------------------------------------------- */
/*                               PROVIDER TYPES                               */
/* -------------------------------------------------------------------------- */

export interface VoiceSynthesisRequest {
  text: string;

  config: VoiceConfig;

  model?: string;

  metadata?: Record<string, unknown>;

  signal?: AbortSignal;
}

export interface VoiceTranscriptionRequest {
  audio: VoiceAudio;

  language?: string;

  prompt?: string;

  model?: string;

  timestamps?: boolean;

  diarization?: boolean;

  metadata?: Record<string, unknown>;

  signal?: AbortSignal;
}

export interface VoiceProviderResponse<TData = unknown> {
  text?: string;

  audio?: Uint8Array;

  audioFormat?: AudioFormat;

  language?: string;

  durationSeconds?: number;

  segments?: VoiceSegment[];

  data?: TData;

  model?: string;

  usage?: Partial<VoiceUsage>;

  metadata?: Record<string, unknown>;
}

export interface VoiceProvider {
  readonly name: VoiceProviderName;

  synthesize?<TData = unknown>(
    input: VoiceSynthesisRequest
  ): Promise<VoiceProviderResponse<TData>>;

  transcribe?<TData = unknown>(
    input: VoiceTranscriptionRequest
  ): Promise<VoiceProviderResponse<TData>>;
}

export interface VoiceServiceOptions {
  defaultProvider?: VoiceProviderName;

  defaultTimeoutMs?: number;

  maxTextLength?: number;

  maxAudioBytes?: number;
}

/* -------------------------------------------------------------------------- */
/*                                   ERRORS                                   */
/* -------------------------------------------------------------------------- */

export class VoiceError extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name = "VoiceError";
  }
}

export class VoiceValidationError
  extends VoiceError {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "VoiceValidationError";
  }
}

export class VoiceProviderNotFoundError
  extends VoiceError {
  constructor(
    provider: string
  ) {
    super(
      `Voice provider not found: ${provider}`
    );

    this.name =
      "VoiceProviderNotFoundError";
  }
}

export class VoiceCapabilityError
  extends VoiceError {
  constructor(
    provider: string,
    capability: string
  ) {
    super(
      `Voice provider "${provider}" does not support "${capability}".`
    );

    this.name =
      "VoiceCapabilityError";
  }
}

export class VoiceTimeoutError
  extends VoiceError {
  constructor(
    timeoutMs: number
  ) {
    super(
      `Voice request timed out after ${timeoutMs}ms.`
    );

    this.name =
      "VoiceTimeoutError";
  }
}

export class VoiceAbortedError
  extends VoiceError {
  constructor() {
    super(
      "Voice request was aborted."
    );

    this.name =
      "VoiceAbortedError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                 CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_VOICE_TIMEOUT_MS =
  60_000;

export const MIN_VOICE_TIMEOUT_MS =
  1_000;

export const MAX_VOICE_TIMEOUT_MS =
  10 * 60 * 1000;

export const DEFAULT_MAX_TEXT_LENGTH =
  100_000;

export const DEFAULT_MAX_AUDIO_BYTES =
  100 * 1024 * 1024;

export const MIN_VOICE_SPEED =
  0.25;

export const MAX_VOICE_SPEED =
  4;

export const MIN_VOICE_PITCH =
  -20;

export const MAX_VOICE_PITCH =
  20;

export const MIN_VOICE_VOLUME =
  0;

export const MAX_VOICE_VOLUME =
  2;

/* -------------------------------------------------------------------------- */
/*                               VOICE SERVICE                                */
/* -------------------------------------------------------------------------- */

export class VoiceService {
  private readonly providers =
    new Map<
      VoiceProviderName,
      VoiceProvider
    >();

  private defaultProvider?:
    VoiceProviderName;

  private readonly defaultTimeoutMs:
    number;

  private readonly maxTextLength:
    number;

  private readonly maxAudioBytes:
    number;

  constructor(
    options: VoiceServiceOptions = {}
  ) {
    this.defaultProvider =
      options.defaultProvider;

    this.defaultTimeoutMs =
      normalizeTimeout(
        options.defaultTimeoutMs ??
          DEFAULT_VOICE_TIMEOUT_MS
      );

    this.maxTextLength =
      normalizePositiveInteger(
        options.maxTextLength ??
          DEFAULT_MAX_TEXT_LENGTH,
        "maxTextLength"
      );

    this.maxAudioBytes =
      normalizePositiveInteger(
        options.maxAudioBytes ??
          DEFAULT_MAX_AUDIO_BYTES,
        "maxAudioBytes"
      );
  }

  /* ------------------------------------------------------------------------ */
  /*                                PROVIDERS                                 */
  /* ------------------------------------------------------------------------ */

  registerProvider(
    provider: VoiceProvider
  ): void {
    if (
      !provider ||
      typeof provider !== "object"
    ) {
      throw new VoiceValidationError(
        "Voice provider is required."
      );
    }

    if (
      typeof provider.name !== "string" ||
      !provider.name.trim()
    ) {
      throw new VoiceValidationError(
        "Voice provider name is required."
      );
    }

    if (
      typeof provider.synthesize !== "function" &&
      typeof provider.transcribe !== "function"
    ) {
      throw new VoiceValidationError(
        `Voice provider "${provider.name}" must implement synthesize() or transcribe().`
      );
    }

    this.providers.set(
      normalizeProviderName(
        provider.name
      ),
      provider
    );
  }

  unregisterProvider(
    name: VoiceProviderName
  ): boolean {
    return this.providers.delete(
      normalizeProviderName(
        name
      )
    );
  }

  hasProvider(
    name: VoiceProviderName
  ): boolean {
    return this.providers.has(
      normalizeProviderName(
        name
      )
    );
  }

  getProvider(
    name?: VoiceProviderName
  ): VoiceProvider {
    const providerName =
      name ??
      this.defaultProvider;

    if (!providerName) {
      throw new VoiceProviderNotFoundError(
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
      throw new VoiceProviderNotFoundError(
        providerName
      );
    }

    return provider;
  }

  getProviders():
    VoiceProviderName[] {
    return Array.from(
      this.providers.keys()
    );
  }

  setDefaultProvider(
    name: VoiceProviderName
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
      throw new VoiceProviderNotFoundError(
        normalized
      );
    }

    this.defaultProvider =
      normalized;
  }

  getDefaultProvider():
    | VoiceProviderName
    | undefined {
    return this.defaultProvider;
  }

  /* ------------------------------------------------------------------------ */
  /*                             TEXT TO SPEECH                               */
  /* ------------------------------------------------------------------------ */

  async synthesize<TData = unknown>(
    input: VoiceSynthesizeInput,
    providerName?: VoiceProviderName
  ): Promise<VoiceResult<TData>> {
    this.validateSynthesisInput(
      input
    );

    const provider =
      this.getProvider(
        providerName
      );

    if (
      typeof provider.synthesize !==
      "function"
    ) {
      throw new VoiceCapabilityError(
        provider.name,
        "synthesize"
      );
    }

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
      throwIfAborted(
        signal
      );

      const response =
        await executeWithTimeout(
          provider.synthesize<TData>({
            text:
              input.text,

            config: {
              voice:
                input.voice,

              language:
                input.language,

              speed:
                input.speed,

              pitch:
                input.pitch,

              volume:
                input.volume,

              format:
                input.format,

              sampleRate:
                input.sampleRate,
            },

            model:
              input.model,

            metadata:
              cloneMetadata(
                input.metadata
              ),

            signal,
          }),
          timeoutMs,
          () => {
            controller.abort();
          }
        );

      return {
        id:
          generateVoiceId(),

        task:
          "synthesize",

        provider:
          provider.name,

        model:
          response.model ??
          input.model,

        createdAt:
          new Date(),

        text:
          input.text,

        audio:
          response.audio
            ? new Uint8Array(
                response.audio
              )
            : undefined,

        audioFormat:
          response.audioFormat ??
          input.format,

        language:
          response.language ??
          input.language,

        durationSeconds:
          response.durationSeconds,

        segments:
          response.segments
            ? response.segments.map(
                cloneSegment
              )
            : undefined,

        data:
          response.data,

        usage: {
          inputCharacters:
            input.text.length,

          outputBytes:
            response.audio
              ? response.audio.byteLength
              : undefined,

          processingTimeMs:
            Date.now() -
            startedAt,

          provider:
            provider.name,

          model:
            response.model ??
            input.model,

          ...response.usage,
        },

        metadata:
          response.metadata
            ? cloneMetadata(
                response.metadata
              )
            : cloneMetadata(
                input.metadata
              ),
      };
    } finally {
      controller.abort();
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                            SPEECH TO TEXT                                */
  /* ------------------------------------------------------------------------ */

  async transcribe<TData = unknown>(
    input: VoiceTranscribeInput,
    providerName?: VoiceProviderName
  ): Promise<VoiceResult<TData>> {
    this.validateTranscriptionInput(
      input
    );

    const provider =
      this.getProvider(
        providerName
      );

    if (
      typeof provider.transcribe !==
      "function"
    ) {
      throw new VoiceCapabilityError(
        provider.name,
        "transcribe"
      );
    }

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
      throwIfAborted(
        signal
      );

      const response =
        await executeWithTimeout(
          provider.transcribe<TData>({
            audio:
              cloneAudio(
                input.audio
              ),

            language:
              input.language,

            prompt:
              input.prompt,

            model:
              input.model,

            timestamps:
              input.timestamps,

            diarization:
              input.diarization,

            metadata:
              cloneMetadata(
                input.metadata
              ),

            signal,
          }),
          timeoutMs,
          () => {
            controller.abort();
          }
        );

      const inputBytes =
        getAudioByteLength(
          input.audio.source
        );

      return {
        id:
          generateVoiceId(),

        task:
          "transcribe",

        provider:
          provider.name,

        model:
          response.model ??
          input.model,

        createdAt:
          new Date(),

        text:
          response.text,

        language:
          response.language ??
          input.language,

        durationSeconds:
          response.durationSeconds,

        segments:
          response.segments
            ? response.segments.map(
                cloneSegment
              )
            : undefined,

        data:
          response.data,

        usage: {
          inputSeconds:
            response.durationSeconds,

          processingTimeMs:
            Date.now() -
            startedAt,

          provider:
            provider.name,

          model:
            response.model ??
            input.model,

          ...response.usage,

          ...(inputBytes !== undefined
            ? {
                inputBytes,
              }
            : {}),
        } as VoiceUsage,

        metadata:
          response.metadata
            ? cloneMetadata(
                response.metadata
              )
            : cloneMetadata(
                input.metadata
              ),
      };
    } finally {
      controller.abort();
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                              CONVENIENCE API                             */
  /* ------------------------------------------------------------------------ */

  async textToSpeech(
    text: string,
    options: Omit<
      VoiceSynthesizeInput,
      "text"
    > = {},
    providerName?: VoiceProviderName
  ): Promise<VoiceResult> {
    return this.synthesize(
      {
        text,
        ...options,
      },
      providerName
    );
  }

  async speechToText(
    audio: VoiceAudio,
    options: Omit<
      VoiceTranscribeInput,
      "audio"
    > = {},
    providerName?: VoiceProviderName
  ): Promise<VoiceResult> {
    return this.transcribe(
      {
        audio,
        ...options,
      },
      providerName
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                VALIDATION                                */
  /* ------------------------------------------------------------------------ */

  private validateSynthesisInput(
    input: VoiceSynthesizeInput
  ): void {
    if (
      !input ||
      typeof input !== "object"
    ) {
      throw new VoiceValidationError(
        "Voice synthesis input is required."
      );
    }

    if (
      typeof input.text !== "string" ||
      !input.text.trim()
    ) {
      throw new VoiceValidationError(
        "Voice synthesis text is required."
      );
    }

    if (
      input.text.length >
      this.maxTextLength
    ) {
      throw new VoiceValidationError(
        `Text exceeds maximum length of ${this.maxTextLength} characters.`
      );
    }

    validateVoiceConfig(
      input
    );
  }

  private validateTranscriptionInput(
    input: VoiceTranscribeInput
  ): void {
    if (
      !input ||
      typeof input !== "object"
    ) {
      throw new VoiceValidationError(
        "Voice transcription input is required."
      );
    }

    if (
      !input.audio ||
      typeof input.audio !== "object"
    ) {
      throw new VoiceValidationError(
        "Audio input is required."
      );
    }

    const source =
      input.audio.source;

    if (
      source === undefined ||
      source === null
    ) {
      throw new VoiceValidationError(
        "Audio source is required."
      );
    }

    if (
      typeof source === "string" &&
      !source.trim()
    ) {
      throw new VoiceValidationError(
        "Audio source cannot be empty."
      );
    }

    const byteLength =
      getAudioByteLength(
        source
      );

    if (
      byteLength !== undefined &&
      byteLength >
        this.maxAudioBytes
    ) {
      throw new VoiceValidationError(
        `Audio exceeds maximum size of ${this.maxAudioBytes} bytes.`
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
    throw new VoiceValidationError(
      "Voice provider name is required."
    );
  }

  return value.trim();
}

function normalizeTimeout(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    value < MIN_VOICE_TIMEOUT_MS
  ) {
    throw new VoiceValidationError(
      `Timeout must be at least ${MIN_VOICE_TIMEOUT_MS}ms.`
    );
  }

  return Math.min(
    Math.floor(value),
    MAX_VOICE_TIMEOUT_MS
  );
}

function normalizePositiveInteger(
  value: number,
  name: string
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new VoiceValidationError(
      `${name} must be a positive finite number.`
    );
  }

  return Math.floor(
    value
  );
}

function validateVoiceConfig(
  input: VoiceSynthesizeInput
): void {
  if (
    input.speed !== undefined &&
    (
      !Number.isFinite(
        input.speed
      ) ||
      input.speed <
        MIN_VOICE_SPEED ||
      input.speed >
        MAX_VOICE_SPEED
    )
  ) {
    throw new VoiceValidationError(
      `Voice speed must be between ${MIN_VOICE_SPEED} and ${MAX_VOICE_SPEED}.`
    );
  }

  if (
    input.pitch !== undefined &&
    (
      !Number.isFinite(
        input.pitch
      ) ||
      input.pitch <
        MIN_VOICE_PITCH ||
      input.pitch >
        MAX_VOICE_PITCH
    )
  ) {
    throw new VoiceValidationError(
      `Voice pitch must be between ${MIN_VOICE_PITCH} and ${MAX_VOICE_PITCH}.`
    );
  }

  if (
    input.volume !== undefined &&
    (
      !Number.isFinite(
        input.volume
      ) ||
      input.volume <
        MIN_VOICE_VOLUME ||
      input.volume >
        MAX_VOICE_VOLUME
    )
  ) {
    throw new VoiceValidationError(
      `Voice volume must be between ${MIN_VOICE_VOLUME} and ${MAX_VOICE_VOLUME}.`
    );
  }

  if (
    input.sampleRate !== undefined &&
    (
      !Number.isFinite(
        input.sampleRate
      ) ||
      input.sampleRate <= 0
    )
  ) {
    throw new VoiceValidationError(
      "sampleRate must be a positive number."
    );
  }
}

function generateVoiceId(): string {
  const random =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `voice_${Date.now()}_${random}`;
}

function cloneAudio(
  audio: VoiceAudio
): VoiceAudio {
  return {
    ...audio,

    source:
      cloneAudioSource(
        audio.source
      ),

    metadata:
      cloneMetadata(
        audio.metadata
      ),
  };
}

function cloneAudioSource(
  source: AudioSource
): AudioSource {
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

function cloneMetadata(
  metadata?: Record<
    string,
    unknown
  >
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  return {
    ...metadata,
  };
}

function cloneSegment(
  segment: VoiceSegment
): VoiceSegment {
  return {
    ...segment,

    words:
      segment.words
        ? segment.words.map(
            (word) => ({
              ...word,

              metadata:
                cloneMetadata(
                  word.metadata
                ),
            })
          )
        : undefined,

    metadata:
      cloneMetadata(
        segment.metadata
      ),
  };
}

function getAudioByteLength(
  source: AudioSource
): number | undefined {
  if (
    source instanceof Uint8Array
  ) {
    return source.byteLength;
  }

  if (
    source instanceof ArrayBuffer
  ) {
    return source.byteLength;
  }

  return undefined;
}

function throwIfAborted(
  signal?: AbortSignal
): void {
  if (
    signal?.aborted
  ) {
    throw new VoiceAbortedError();
  }
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
                new VoiceTimeoutError(
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

  const controller =
    new AbortController();

  const abort = () => {
    if (
      !controller.signal.aborted
    ) {
      controller.abort();
    }
  };

  if (
    first.aborted ||
    second.aborted
  ) {
    abort();

    return controller.signal;
  }

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

export const voiceService =
  new VoiceService();

/* -------------------------------------------------------------------------- */
/*                           CONVENIENCE EXPORTS                              */
/* -------------------------------------------------------------------------- */

export function registerVoiceProvider(
  provider: VoiceProvider
): void {
  voiceService.registerProvider(
    provider
  );
}

export function unregisterVoiceProvider(
  name: VoiceProviderName
): boolean {
  return voiceService.unregisterProvider(
    name
  );
}

export function getVoiceProvider(
  name?: VoiceProviderName
): VoiceProvider {
  return voiceService.getProvider(
    name
  );
}

export function getVoiceProviders():
  VoiceProviderName[] {
  return voiceService.getProviders();
}

export function setDefaultVoiceProvider(
  name: VoiceProviderName
): void {
  voiceService.setDefaultProvider(
    name
  );
}

export async function synthesizeVoice<
  TData = unknown
>(
  input: VoiceSynthesizeInput,
  providerName?: VoiceProviderName
): Promise<VoiceResult<TData>> {
  return voiceService.synthesize<TData>(
    input,
    providerName
  );
}

export async function transcribeVoice<
  TData = unknown
>(
  input: VoiceTranscribeInput,
  providerName?: VoiceProviderName
): Promise<VoiceResult<TData>> {
  return voiceService.transcribe<TData>(
    input,
    providerName
  );
}

export async function textToSpeech(
  text: string,
  options: Omit<
    VoiceSynthesizeInput,
    "text"
  > = {},
  providerName?: VoiceProviderName
): Promise<VoiceResult> {
  return voiceService.textToSpeech(
    text,
    options,
    providerName
  );
}

export async function speechToText(
  audio: VoiceAudio,
  options: Omit<
    VoiceTranscribeInput,
    "audio"
  > = {},
  providerName?: VoiceProviderName
): Promise<VoiceResult> {
  return voiceService.speechToText(
    audio,
    options,
    providerName
  );
}

export default voiceService;