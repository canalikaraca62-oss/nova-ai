/**
 * SYRAVEN — Approved AI model registry
 * lib/ai/registry.ts
 *
 * Phase 7 (see IMPLEMENTATION_PLAN.md).
 *
 * SECURITY / COST BOUNDARY.
 *
 * The single place that decides which models exist and which provider
 * serves them.
 *
 * WHY THIS EXISTS
 *
 * Before Phase 7, model identifiers were scattered across seven routes
 * and five environment variables, and four routes accepted `body.model`
 * and passed it straight to the provider with no validation:
 *
 *     const cleanModel = requestedModel?.trim();
 *     model: cleanModel || DEFAULT_OPENAI_MODEL
 *
 * Phase 5 clamps how MANY tokens a caller may request, but nothing
 * clamped WHICH model spends them — so a free-tier caller could name an
 * expensive model and pay free-tier prices for it.
 *
 * THE RULE
 *
 *   A model is usable only if it appears in APPROVED_MODELS.
 *   An unrecognised model is REFUSED, never silently substituted.
 *
 * That last part matters: falling back to a default on an unknown name
 * would let a typo silently bill against a different model, and would
 * let an attacker probe for which names are accepted.
 */

import "server-only";

import type { PlanId } from "@/lib/plans";

/* -------------------------------------------------------------------------- */
/*                                 PROVIDERS                                  */
/* -------------------------------------------------------------------------- */

/**
 * Providers this application can talk to.
 *
 * OpenAI is the production provider. Groq is retained because several
 * routes already fall back to it and it is API-compatible; adding a
 * third would mean one new adapter, not changes to business logic.
 */
export const PROVIDER_IDS = ["openai", "groq"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: unknown): value is ProviderId {
  return (
    typeof value === "string" &&
    (PROVIDER_IDS as readonly string[]).includes(value)
  );
}

/* -------------------------------------------------------------------------- */
/*                                CAPABILITIES                                */
/* -------------------------------------------------------------------------- */

/**
 * What a model is FOR.
 *
 * Prevents a chat model being used for transcription, or a text-to-speech
 * model being billed as a chat completion.
 */
export type ModelCapability =
  | "chat"
  | "vision"
  | "transcription"
  | "speech";

export interface ModelDefinition {
  /** The identifier sent to the provider. */
  readonly id: string;

  readonly provider: ProviderId;

  readonly capability: ModelCapability;

  /**
   * Hard ceiling on completion tokens for this model, independent of
   * plan. The effective ceiling is the LOWER of this and the caller's
   * plan ceiling (lib/usage/entitlements.ts).
   */
  readonly maxOutputTokens: number;

  /**
   * Minimum plan permitted to select this model.
   *
   * `free` means anyone may use it. A model marked `pro` cannot be
   * chosen by a free-tier caller even if they name it explicitly — this
   * is the control that was missing before Phase 7.
   */
  readonly minimumPlan: PlanId;
}

/* -------------------------------------------------------------------------- */
/*                             APPROVED MODELS                                */
/* -------------------------------------------------------------------------- */

/**
 * Every model this application will call.
 *
 * Adding an entry is a cost decision: it becomes selectable by any caller
 * whose plan meets `minimumPlan`.
 *
 * The ids below are exactly those already in use across the routes this
 * phase consolidates — no new models are introduced.
 */
export const APPROVED_MODELS: Readonly<Record<string, ModelDefinition>> = {
  /* ---------------------------------------------------------------- */
  /* Chat                                                              */
  /* ---------------------------------------------------------------- */

  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    capability: "chat",
    maxOutputTokens: 16_000,
    minimumPlan: "free",
  },

  "llama-3.3-70b-versatile": {
    id: "llama-3.3-70b-versatile",
    provider: "groq",
    capability: "chat",
    maxOutputTokens: 32_000,
    minimumPlan: "free",
  },

  "llama-3.1-8b-instant": {
    id: "llama-3.1-8b-instant",
    provider: "groq",
    capability: "chat",
    maxOutputTokens: 8_000,
    minimumPlan: "free",
  },

  /* ---------------------------------------------------------------- */
  /* Vision — chat models used for image/document analysis             */
  /* ---------------------------------------------------------------- */

  "gpt-4o-mini-vision": {
    id: "gpt-4o-mini",
    provider: "openai",
    capability: "vision",
    maxOutputTokens: 16_000,
    minimumPlan: "free",
  },

  /* ---------------------------------------------------------------- */
  /* Speech                                                            */
  /* ---------------------------------------------------------------- */

  "gpt-4o-mini-tts": {
    id: "gpt-4o-mini-tts",
    provider: "openai",
    capability: "speech",
    maxOutputTokens: 0,
    minimumPlan: "free",
  },

  /* ---------------------------------------------------------------- */
  /* Transcription                                                     */
  /* ---------------------------------------------------------------- */

  "whisper-1": {
    id: "whisper-1",
    provider: "openai",
    capability: "transcription",
    maxOutputTokens: 0,
    minimumPlan: "free",
  },

  "gpt-4o-mini-transcribe": {
    id: "gpt-4o-mini-transcribe",
    provider: "openai",
    capability: "transcription",
    maxOutputTokens: 0,
    minimumPlan: "free",
  },
};

/* -------------------------------------------------------------------------- */
/*                            DEFAULTS PER TASK                               */
/* -------------------------------------------------------------------------- */

/**
 * The model used when a caller expresses no preference.
 *
 * Chosen server-side per capability, so a route never has to embed a
 * model identifier of its own.
 */
export const DEFAULT_MODEL_BY_CAPABILITY: Readonly<
  Record<ModelCapability, string>
> = {
  chat: "gpt-4o-mini",
  vision: "gpt-4o-mini-vision",
  speech: "gpt-4o-mini-tts",
  transcription: "whisper-1",
};

/* -------------------------------------------------------------------------- */
/*                              MODEL SELECTION                               */
/* -------------------------------------------------------------------------- */

export type ModelSelection =
  | { ok: true; model: ModelDefinition }
  | {
      ok: false;
      reason:
        | "UNKNOWN_MODEL"
        | "WRONG_CAPABILITY"
        | "PLAN_NOT_PERMITTED"
        | "MISCONFIGURED_DEFAULT";
    };

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
};

/**
 * Resolves a model for a request.
 *
 * @param requested   A caller-supplied model name, or null/undefined for
 *                    the server default. NEVER trusted — it is looked up
 *                    in APPROVED_MODELS and refused if absent.
 * @param capability  What the call is for. A model registered for a
 *                    different capability is refused.
 * @param plan        The caller's EFFECTIVE plan, resolved server-side by
 *                    lib/usage/entitlements.ts.
 */
export function selectModel(
  requested: unknown,
  capability: ModelCapability,
  plan: PlanId,
): ModelSelection {
  const requestedName =
    typeof requested === "string" && requested.trim().length > 0
      ? requested.trim()
      : null;

  if (requestedName === null) {
    const defaultName = DEFAULT_MODEL_BY_CAPABILITY[capability];

    const fallback = APPROVED_MODELS[defaultName];

    if (!fallback) {
      /*
       * The registry's own default is missing. Refuse rather than
       * improvise: a misconfiguration must not select an arbitrary
       * model and bill for it.
       */
      console.error("SYRAVEN AI: default model is not registered.", {
        capability,
        defaultName,
      });

      return { ok: false, reason: "MISCONFIGURED_DEFAULT" };
    }

    return { ok: true, model: fallback };
  }

  const model = APPROVED_MODELS[requestedName];

  if (!model) {
    /*
     * Unknown model names are REFUSED, not silently replaced with a
     * default. Substituting would bill a caller for a model they did not
     * ask for and would hide typos in production.
     */
    return { ok: false, reason: "UNKNOWN_MODEL" };
  }

  if (model.capability !== capability) {
    return { ok: false, reason: "WRONG_CAPABILITY" };
  }

  if (PLAN_RANK[plan] < PLAN_RANK[model.minimumPlan]) {
    return { ok: false, reason: "PLAN_NOT_PERMITTED" };
  }

  return { ok: true, model };
}

/* -------------------------------------------------------------------------- */
/*                             PROVIDER ENDPOINTS                             */
/* -------------------------------------------------------------------------- */

export interface ProviderEndpoint {
  readonly baseUrl: string;
  readonly apiKeyEnv: string;
}

/**
 * Where each provider lives, and which environment variable holds its
 * key. Base URLs are constants, not caller input.
 */
export const PROVIDER_ENDPOINTS: Readonly<
  Record<ProviderId, ProviderEndpoint>
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
  },
};

/**
 * Returns the API key for a provider, or null when unconfigured.
 *
 * The key itself is never logged or returned to a caller.
 */
export function providerApiKey(
  provider: ProviderId,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const value = env[PROVIDER_ENDPOINTS[provider].apiKeyEnv];

  if (typeof value !== "string") return null;

  const key = value.trim();

  return key.length > 0 ? key : null;
}
