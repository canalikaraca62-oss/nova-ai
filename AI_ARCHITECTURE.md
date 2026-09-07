# SYRAVEN — AI ARCHITECTURE

**Last updated:** 2026-09-04 (Phase 7)
**Scope:** provider abstraction, model policy, failure behaviour.

---

## 1. Layers

```
route handler                 app/api/*/route.ts
  ├── withAuth                lib/api/withAuth.ts      — who is calling
  ├── enforceUsage            lib/api/usageGuard.ts    — may they act at all
  ├── resolveAiPolicy         lib/api/aiPolicy.ts      — what may the call look like
  │     └── selectModel       lib/ai/registry.ts       — which model, which provider
  └── provider adapter        lib/ai/provider.ts       — transport, timeout, retry
```

Each layer answers one question. A route calls them in order; skipping
one is a security or cost defect, and tests assert the ordering.

---

## 2. Model registry

`lib/ai/registry.ts` is the single source of truth for which models
exist.

```ts
"gpt-4o-mini": {
  id: "gpt-4o-mini",
  provider: "openai",
  capability: "chat",
  maxOutputTokens: 16_000,
  minimumPlan: "free",
}
```

| Field | Meaning |
|---|---|
| `id` | Sent to the provider verbatim |
| `provider` | Which adapter serves it |
| `capability` | `chat` / `vision` / `transcription` / `speech` |
| `maxOutputTokens` | Hard per-request ceiling for this model |
| `minimumPlan` | Lowest plan permitted to select it |

**Adding a model is a cost decision.** Once registered it becomes
selectable by every caller whose plan meets `minimumPlan`.

### Selection rules

`selectModel(requested, capability, plan)` returns a model or a reason:

| Situation | Result |
|---|---|
| No model requested | Server default for that capability |
| Model not in registry | `UNKNOWN_MODEL` — **refused** |
| Registered for another capability | `WRONG_CAPABILITY` |
| Plan below `minimumPlan` | `PLAN_NOT_PERMITTED` |
| Registry default missing | `MISCONFIGURED_DEFAULT` |

An unknown model is **refused, never substituted**. Falling back to a
default would bill a caller for a model they did not request and would
hide typos in production.

---

## 3. Request policy

`resolveAiPolicy()` produces the three parameters a provider call needs.
All are server-authoritative.

**Token ceiling** is the **lower** of:
- the caller's plan ceiling (`clampMaxTokens`, Phase 5), and
- the model's own `maxOutputTokens`.

Taking either alone would let one bound be escaped by changing the other
— selecting a high-ceiling model must not lift a free-tier plan cap.

**Temperature** is clamped to `[0, 2]`. It is not a billing lever, so a
caller may set it, but a non-finite value must never reach the provider.

**Model** comes from the registry, never from `body.model` directly.

---

## 4. Provider adapter

`lib/ai/provider.ts` is the only code that talks to a provider.

| Policy | Value | Why |
|---|---|---|
| Timeout | 120 s | Server-owned. Previously `/api/agents/execute` passed the caller's `AbortSignal`, so a client could hold a paid connection open indefinitely |
| Retries | **1** | Bounded. An unbounded retry against a paid provider multiplies cost during an outage, and a completion that reached the model may be billed even if the response never arrived |
| Retryable | 429, 500, 502, 503, 504 | Transient only. A 400/401 is deterministic — retrying wastes a paid call |

OpenAI and Groq share the OpenAI-compatible `/chat/completions` schema,
so one adapter serves both.

---

## 5. Failure behaviour

Provider errors are normalised so routes handle a fixed set:

| Kind | HTTP | Notes |
|---|---|---|
| `NOT_CONFIGURED` | 503 | No API key |
| `AUTHENTICATION` | **503** | Provider rejected *our* key — a server fault. Deliberately **not** 401, which would wrongly imply the caller's session is invalid |
| `RATE_LIMITED` | 503 | Provider-side, distinct from our own 429 |
| `TIMEOUT` | 504 | |
| `INVALID_REQUEST` | 400 | |
| `PROVIDER_ERROR` | 502 | |
| `EMPTY_RESPONSE` | 502 | |

**Provider response bodies are never forwarded to clients.** They can
contain organisation ids, quota details, and echoes of the request. They
are logged server-side and truncated to 500 characters.

### Token usage honesty

When a provider omits usage, the adapter reports `null`, **not `0`**.
Zero is a false measurement; `null` says *not measured*. Streaming
responses carry no usage up front, so streamed calls are recorded
**without** token counts rather than with invented ones — the operation
still counts against quota.

---

## 6. Adding a provider

1. Add it to `PROVIDER_IDS` and `PROVIDER_ENDPOINTS` in `registry.ts`.
2. If it is OpenAI-compatible, nothing else is needed.
3. If not, add a sibling adapter in `lib/ai/` returning the same
   `ChatCompletionResult`.
4. Register its models with capability, ceiling and `minimumPlan`.

No route changes. Business logic stays provider-agnostic.

**Do not add a provider speculatively.** Each is a live credential, a
billing relationship, and a failure mode.

---

## 7. What is deliberately not abstracted

- **`/api/canvas`** uses the OpenAI SDK directly. It is a single
  structured-output call; routing it through the adapter would add
  indirection without removing duplication.
- **Voice routes** call `/audio/speech` and `/audio/transcriptions`,
  which are not chat completions. Their models are validated through the
  registry, but their transport stays local.
- **`services/` AI modules** remain disconnected — see
  `services/README.md`. They are in-memory stores with no provider access.

The abstraction covers what was genuinely duplicated: chat completion
transport, model selection, and error normalisation.

---

## 8. Cost controls, end to end

A single AI request passes:

1. **Authentication** — verified session (Phase 1/3)
2. **Usage quota** — plan limits from the database (Phase 5)
3. **Rate limit** — sliding window in Postgres (Phase 5)
4. **Model gate** — registry + plan minimum (Phase 7)
5. **Token ceiling** — min(plan, model) (Phases 5 + 7)
6. **Timeout / bounded retry** — server-owned (Phase 7)
7. **Usage recording** — provider-reported tokens (Phase 5)

Nothing in that chain is client-controllable. The caller may *request* a
model and a token count; both are validated, and a request that exceeds
either bound is refused rather than silently reduced to the maximum.
