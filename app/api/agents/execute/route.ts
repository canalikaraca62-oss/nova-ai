import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { enforceUsage } from "@/lib/api/usageGuard";
import { resolveAiPolicy } from "@/lib/api/aiPolicy";
import { chatCompletion, chatCompletionStream } from "@/lib/ai/provider";

/*
  SYRAVEN — /api/agents/execute

  WHAT THIS ROUTE IS

  A single chat completion with an agent-flavoured system message. It
  runs no tools, writes nothing and changes nothing outside the reply.
  Work that acts -- plans, tools, approvals -- runs through
  /api/agents/run and the orchestration registry, the one execution
  path (ARCHITECTURE_NORTH_STAR.md). `agentId` / `agentName` here are
  labels for the system message; they grant no capability.

  WHY IT GOES THROUGH THE PROVIDER ADAPTER

  This route used to call a provider itself, choosing the key as
  AI_API_KEY || GROQ_API_KEY || OPENAI_API_KEY and the endpoint as
  AI_BASE_URL || GROQ_BASE_URL || api.groq.com. With only an OpenAI key
  configured, every call sent the OpenAI secret key to Groq's endpoint,
  with an OpenAI model name. lib/ai/provider.ts picks the key and the
  endpoint from the SAME provider -- the one that owns the model the
  policy selected -- so a key can only ever go to its own provider.

  Token counts are reported as the provider gave them, and null when it
  did not. They used to fall back to 0, a measurement nobody made.
*/

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
      clamped by plan. The resolved model also decides the provider --
      and therefore the key -- in the adapter below.
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

    const completionRequest = {
      model: policy.policy.model,
      messages,
      maxTokens: policy.policy.maxTokens,
      temperature: policy.policy.temperature,
    };

    /* ------------------------------------------------------------------ */
    /* STREAMING                                                           */
    /* ------------------------------------------------------------------ */

    if (stream) {
      const streamed =
        await chatCompletionStream(completionRequest);

      if (!streamed.ok) {
        console.error(
          "[SYRAVEN AGENT STREAM ERROR]",
          { executionId, kind: streamed.error.kind }
        );

        return jsonError(
          streamed.error.clientMessage,
          streamed.error.status,
          "AI_EXECUTION_FAILED"
        );
      }

      /*
        A stream reports no token counts up front. The call is recorded
        as not measured -- never as zero, and never skipped: an
        unrecorded stream would be a paid call that counts against
        nothing.
      */
      await guard.record({
        model: streamed.modelId,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      });

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
        streamed.body,
        {
          status: 200,
          headers,
        }
      );
    }

    /* ------------------------------------------------------------------ */
    /* STANDARD RESPONSE                                                   */
    /* ------------------------------------------------------------------ */

    const completion =
      await chatCompletion(completionRequest);

    if (!completion.ok) {
      console.error(
        "[SYRAVEN AGENT EXECUTION ERROR]",
        {
          executionId,
          kind: completion.error.kind,
          agentId,
          agentName,
        }
      );

      return jsonError(
        completion.error.clientMessage,
        completion.error.status,
        "AI_EXECUTION_FAILED"
      );
    }

    /*
      Record the agent run. Token counts come from the provider
      response, so a caller cannot under-report consumption.
    */
    await guard.record({
      model: completion.modelId,
      promptTokens: completion.usage.promptTokens,
      completionTokens: completion.usage.completionTokens,
      totalTokens: completion.usage.totalTokens,
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
            completion.modelId,
          status:
            "completed",
        },

        message: {
          role:
            "assistant" as const,
          content: completion.content,
        },

        /* As measured by the provider; null where it measured nothing. */
        usage: completion.usage,

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
    console.error(
      "[SYRAVEN AGENT EXECUTE FATAL ERROR]",
      {
        executionId,
        name: error instanceof Error ? error.name : "unknown",
      }
    );

    return jsonError(
      "An unexpected error occurred while executing the agent.",
      500,
      "INTERNAL_ERROR"
    );
  }
});
