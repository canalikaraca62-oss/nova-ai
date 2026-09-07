import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { enforceUsage } from "@/lib/api/usageGuard";
import { resolveAiPolicy } from "@/lib/api/aiPolicy";
import { AI_REQUEST_POLICY } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type AgentRole = "system" | "user" | "assistant";

type AgentMessage = {
  role: AgentRole;
  content: string;
};

type ExecuteAgentRequest = {
  agentId?: string;
  agentName?: string;
  prompt?: string;
  messages?: unknown[];
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
};

type AIResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

/* -------------------------------------------------------------------------- */
/*                              CONFIGURATION                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_MODEL =
  process.env.AI_DEFAULT_MODEL ||
  process.env.GROQ_MODEL ||
  "llama-3.3-70b-versatile";

const AI_BASE_URL =
  process.env.AI_BASE_URL ||
  process.env.GROQ_BASE_URL ||
  "https://api.groq.com/openai/v1";

const AI_API_KEY =
  process.env.AI_API_KEY ||
  process.env.GROQ_API_KEY ||
  process.env.OPENAI_API_KEY;

/* -------------------------------------------------------------------------- */
/*                                HELPERS                                     */
/* -------------------------------------------------------------------------- */

function jsonError(
  message: string,
  status: number,
  code?: string
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: code || "REQUEST_ERROR",
      },
    },
    { status }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeRole(role: unknown): AgentRole | null {
  if (
    role === "system" ||
    role === "user" ||
    role === "assistant"
  ) {
    return role;
  }

  return null;
}

function normalizeMessages(
  value: unknown
): AgentMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const messages: AgentMessage[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const role = normalizeRole(item.role);

    const content =
      typeof item.content === "string"
        ? item.content.trim()
        : "";

    if (!role || !content) {
      continue;
    }

    messages.push({
      role,
      content,
    });
  }

  return messages;
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
) {
  if (typeof value !== "number") {
    return fallback;
  }

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(
    Math.max(value, min),
    max
  );
}

function createExecutionId() {
  return `agent_exec_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function buildSystemMessage(
  agentName?: string,
  customSystemPrompt?: string
): AgentMessage | null {
  const parts: string[] = [];

  parts.push(
    "You are SYRAVEN, an advanced AI system operating as part of a premium multi-agent platform."
  );

  parts.push(
    "Provide accurate, useful, structured and actionable responses."
  );

  parts.push(
    "Do not pretend to have completed external actions unless they were actually completed."
  );

  parts.push(
    "When important information is uncertain, clearly communicate the uncertainty."
  );

  if (agentName?.trim()) {
    parts.push(
      `You are currently executing as the ${agentName.trim()} agent.`
    );
  }

  if (customSystemPrompt?.trim()) {
    parts.push(customSystemPrompt.trim());
  }

  const content = parts
    .filter(Boolean)
    .join("\n\n");

  if (!content.trim()) {
    return null;
  }

  return {
    role: "system",
    content,
  };
}

/* -------------------------------------------------------------------------- */
/*                                OPTIONS                                     */
/* -------------------------------------------------------------------------- */

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                   POST                                     */
/* -------------------------------------------------------------------------- */

export const POST = withAuth(async (
  request,
  session
) => {
  /*
    USAGE ENFORCEMENT (Phase 5)

    Entitlement, burst rate limit and plan quota are all checked before
    any paid provider call. Identity and plan come from the verified
    session and public.profiles — never from the request
    (ARCHITECTURE_AUDIT.md §17, §8.2).
  */
  const guard = await enforceUsage(
    session,
    "ai:agent",
    "agentRun"
  );

  if (guard.denied) {
    return guard.response;
  }
  const executionId = createExecutionId();

  try {
    if (!AI_API_KEY) {
      console.error(
        "[SYRAVEN AGENT EXECUTE] Missing AI API key"
      );

      return jsonError(
        "AI service is not configured.",
        500,
        "AI_NOT_CONFIGURED"
      );
    }

    let body: ExecuteAgentRequest;

    try {
      body = (await request.json()) as ExecuteAgentRequest;
    } catch {
      return jsonError(
        "Invalid JSON request body.",
        400,
        "INVALID_JSON"
      );
    }

    const {
      agentId,
      agentName,
      prompt,
      messages: rawMessages,
      systemPrompt,
      model,
      temperature,
      maxTokens,
      stream,
      metadata,
    } = body;

    /*
     * ----------------------------------------------------------------------
     * MESSAGE NORMALIZATION
     * ----------------------------------------------------------------------
     *
     * Buradaki yapı özellikle TypeScript hatasını çözüyor.
     *
     * rawMessages içinden gelen role değeri "string" kabul edilmiyor.
     * normalizeRole() sadece:
     *
     * "system"
     * "user"
     * "assistant"
     *
     * değerlerini AgentRole olarak geçiriyor.
     */

    const messages: AgentMessage[] =
      normalizeMessages(rawMessages);

    const systemMessage =
      buildSystemMessage(
        agentName,
        systemPrompt
      );

    if (systemMessage) {
      const hasSystemMessage =
        messages.some(
          (message) =>
            message.role === "system"
        );

      if (!hasSystemMessage) {
        messages.unshift(systemMessage);
      }
    }

    if (
      typeof prompt === "string" &&
      prompt.trim()
    ) {
      messages.push({
        role: "user",
        content: prompt.trim(),
      });
    }

    const userMessages =
      messages.filter(
        (message) =>
          message.role === "user"
      );

    if (userMessages.length === 0) {
      return jsonError(
        "A prompt or user message is required.",
        400,
        "MISSING_MESSAGE"
      );
    }

    /*
      AI POLICY (Phase 7)

      Model validated against the approved registry and token budget
      clamped by plan. This route previously allowed ANY model string
      and up to 32,768 tokens regardless of plan.
    */
    const policy =
      resolveAiPolicy({
        capability: "chat",
        entitlement: guard.entitlement,
        requestedModel: model,
        requestedTokens: maxTokens,
        requestedTemperature: temperature,
      });

    if (!policy.ok) {
      return policy.response;
    }

    const selectedModel =
      policy.policy.model.id;

    const selectedTemperature =
      policy.policy.temperature;

    const selectedMaxTokens =
      policy.policy.maxTokens;

    const requestPayload = {
      model: selectedModel,
      messages,
      temperature:
        selectedTemperature,
      max_tokens:
        selectedMaxTokens,
      stream: Boolean(stream),
    };

    /*
     * ----------------------------------------------------------------------
     * STREAMING
     * ----------------------------------------------------------------------
     */

    if (stream) {
      const aiResponse = await fetch(
        `${AI_BASE_URL}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${AI_API_KEY}`,
            "Content-Type":
              "application/json",
            Accept:
              "text/event-stream",
          },
          body: JSON.stringify(
            requestPayload
          ),
          /*
            SECURITY/RELIABILITY: a SERVER-owned timeout. Passing the
            caller's signal let a client hold a provider connection
            open indefinitely.
          */
          signal: AbortSignal.timeout(
            AI_REQUEST_POLICY.timeoutMs
          ),
        }
      );

      if (!aiResponse.ok) {
        const errorText =
          await aiResponse.text();

        /* Phase 11: provider bodies echo the request; bound to 300. */
        console.error(
          "[SYRAVEN AGENT STREAM ERROR]",
          {
            executionId,
            status:
              aiResponse.status,
            detail: errorText.slice(0, 300),
          }
        );

        return jsonError(
          "The AI service could not process the request.",
          aiResponse.status,
          "AI_EXECUTION_FAILED"
        );
      }

      if (!aiResponse.body) {
        return jsonError(
          "The AI service returned an empty stream.",
          502,
          "EMPTY_STREAM"
        );
      }

      const headers = new Headers();

      headers.set(
        "Content-Type",
        "text/event-stream; charset=utf-8"
      );

      headers.set(
        "Cache-Control",
        "no-cache, no-transform"
      );

      headers.set(
        "Connection",
        "keep-alive"
      );

      headers.set(
        "X-Accel-Buffering",
        "no"
      );

      headers.set(
        "X-SYRAVEN-Execution-Id",
        executionId
      );

      return new Response(
        aiResponse.body,
        {
          status: 200,
          headers,
        }
      );
    }

    /*
     * ----------------------------------------------------------------------
     * STANDARD RESPONSE
     * ----------------------------------------------------------------------
     */

    const aiResponse = await fetch(
      `${AI_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${AI_API_KEY}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          requestPayload
        ),
        /*
            SECURITY/RELIABILITY: a SERVER-owned timeout. Passing the
            caller's signal let a client hold a provider connection
            open indefinitely.
          */
          signal: AbortSignal.timeout(
            AI_REQUEST_POLICY.timeoutMs
          ),
      }
    );

    if (!aiResponse.ok) {
      const errorText =
        await aiResponse.text();

      /* Phase 11: provider bodies echo the request; bound to 300. */
      console.error(
        "[SYRAVEN AGENT EXECUTION ERROR]",
        {
          executionId,
          status: aiResponse.status,
          agentId,
          agentName,
          detail: errorText.slice(0, 300),
        }
      );

      return jsonError(
        "The AI service could not process the request.",
        aiResponse.status,
        "AI_EXECUTION_FAILED"
      );
    }

    let data: AIResponse;

    try {
      data =
        (await aiResponse.json()) as AIResponse;
    } catch {
      return jsonError(
        "Invalid response received from the AI service.",
        502,
        "INVALID_AI_RESPONSE"
      );
    }

    const content =
      data.choices?.[0]?.message?.content?.trim() ||
      "";

    if (!content) {
      console.error(
        "[SYRAVEN AGENT EMPTY RESPONSE]",
        {
          executionId,
          agentId,
          agentName,
          response: data,
        }
      );

      return jsonError(
        "The AI returned an empty response.",
        502,
        "EMPTY_AI_RESPONSE"
      );
    }

    /*
      Record the agent run. Token counts come from the provider
      response, so a caller cannot under-report consumption.
    */
    await guard.record({
      model: selectedModel,
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
      totalTokens: data.usage?.total_tokens ?? null,
    });

    return NextResponse.json(
      {
        success: true,

        execution: {
          id: executionId,
          agentId:
            agentId || null,
          agentName:
            agentName || null,
          model:
            selectedModel,
          status:
            "completed",
        },

        message: {
          role:
            "assistant" as const,
          content,
        },

        usage: {
          promptTokens:
            data.usage
              ?.prompt_tokens || 0,

          completionTokens:
            data.usage
              ?.completion_tokens || 0,

          totalTokens:
            data.usage
              ?.total_tokens || 0,
        },

        metadata:
          metadata || {},
      },
      {
        status: 200,
        headers: {
          "X-SYRAVEN-Execution-Id":
            executionId,
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown execution error";

    console.error(
      "[SYRAVEN AGENT EXECUTE FATAL ERROR]",
      {
        executionId,
        error: message,
      }
    );

    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      return jsonError(
        "The request was cancelled.",
        499,
        "REQUEST_ABORTED"
      );
    }

    return jsonError(
      "An unexpected error occurred while executing the agent.",
      500,
      "INTERNAL_ERROR"
    );
  }
});
