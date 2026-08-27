import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN CHAT API
   Production-ready AI gateway
================================================== */

type ChatRole =
  | "system"
  | "user"
  | "assistant";

type ChatMessage = {
  id?: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
};

type KnowledgeContext = {
  title?: string;
  content: string;
  source?: string;
};

type ChatRequestBody = {
  message?: string;
  messages?: ChatMessage[];
  conversationId?: string | null;

  model?: string;
  provider?: "auto" | "openai" | "groq";

  stream?: boolean;

  systemPrompt?: string;

  knowledge?: KnowledgeContext[];

  projectId?: string | null;
  workspaceId?: string | null;

  temperature?: number;
  maxTokens?: number;
};

type AIProvider =
  | "openai"
  | "groq";

type ProviderConfig = {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
};

/* ==================================================
   CONSTANTS
================================================== */

const DEFAULT_OPENAI_MODEL =
  process.env.OPENAI_MODEL ??
  "gpt-4o-mini";

const DEFAULT_GROQ_MODEL =
  process.env.GROQ_MODEL ??
  "llama-3.3-70b-versatile";

const MAX_MESSAGE_LENGTH = 100_000;
const MAX_MESSAGES = 100;
const MAX_KNOWLEDGE_ITEMS = 25;
const MAX_KNOWLEDGE_CONTENT = 12_000;

const encoder = new TextEncoder();

/* ==================================================
   RESPONSE HELPERS
================================================== */

function jsonError(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    }
  );
}

function createSSE(
  event: string,
  data: unknown
) {
  return encoder.encode(
    `event: ${event}\n` +
      `data: ${JSON.stringify(data)}\n\n`
  );
}

/* ==================================================
   VALIDATION
================================================== */

function isValidRole(
  value: unknown
): value is ChatRole {
  return (
    value === "system" ||
    value === "user" ||
    value === "assistant"
  );
}

function sanitizeMessages(
  messages: unknown
): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .slice(-MAX_MESSAGES)
    .filter(
      (
        item
      ): item is ChatMessage =>
        Boolean(
          item &&
            typeof item === "object" &&
            isValidRole(
              (
                item as ChatMessage
              ).role
            ) &&
            typeof (
              item as ChatMessage
            ).content === "string"
        )
    )
    .map(
      (item) => ({
        id:
          typeof item.id === "string"
            ? item.id
            : undefined,

        role: item.role,

        content: item.content
          .trim()
          .slice(
            0,
            MAX_MESSAGE_LENGTH
          ),

        createdAt:
          typeof item.createdAt === "string"
            ? item.createdAt
            : undefined,
      })
    )
    .filter(
      (item) =>
        item.content.length > 0
    );
}

function sanitizeKnowledge(
  knowledge: unknown
): KnowledgeContext[] {
  if (!Array.isArray(knowledge)) {
    return [];
  }

  return knowledge
    .slice(0, MAX_KNOWLEDGE_ITEMS)
    .filter(
      (
        item
      ): item is KnowledgeContext =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (
              item as KnowledgeContext
            ).content === "string"
        )
    )
    .map(
      (item) => ({
        title:
          typeof item.title === "string"
            ? item.title.slice(
                0,
                300
              )
            : undefined,

        source:
          typeof item.source === "string"
            ? item.source.slice(
                0,
                500
              )
            : undefined,

        content: item.content
          .trim()
          .slice(
            0,
            MAX_KNOWLEDGE_CONTENT
          ),
      })
    )
    .filter(
      (item) =>
        item.content.length > 0
    );
}

/* ==================================================
   SYSTEM PROMPT
================================================== */

function buildSystemPrompt(
  customPrompt?: string,
  knowledge?: KnowledgeContext[]
) {
  const basePrompt = `
You are SYRAVEN, a premium, intelligent, reliable AI system.

Your purpose is to help users think, create, research, analyze, build, plan and execute high-quality work.

Core behavior:
- Be helpful, precise and practical.
- Adapt your depth to the user's request.
- Give direct answers before unnecessary explanation.
- Use structured formatting when it improves clarity.
- Never pretend to have completed an external action unless it actually happened.
- Be transparent about uncertainty.
- Never invent sources, files, actions, results or integrations.
- Treat user-provided context as important.
- When information conflicts, clearly explain the conflict.
- Protect privacy and avoid exposing secrets or credentials.
- For consequential actions, require clear user confirmation before claiming execution.
- Aim for premium quality, strong reasoning and excellent usability.

SYRAVEN is more than a chatbot. It is an AI workspace capable of helping with research, coding, analysis, planning, creativity, automation and knowledge work.
`.trim();

  const custom =
    typeof customPrompt === "string" &&
    customPrompt.trim().length > 0
      ? `\n\nAdditional instructions:\n${customPrompt.trim()}`
      : "";

  const knowledgeBlock =
    knowledge &&
    knowledge.length > 0
      ? `\n\nRelevant user context:\n${knowledge
          .map(
            (
              item,
              index
            ) => {
              const header =
                item.title ??
                item.source ??
                `Context ${index + 1}`;

              return [
                `[${header}]`,
                item.content,
              ].join("\n");
            }
          )
          .join("\n\n---\n\n")}`
      : "";

  return (
    basePrompt +
    custom +
    knowledgeBlock
  );
}

/* ==================================================
   PROVIDER RESOLUTION
================================================== */

function getProvider(
  preferred:
    | "auto"
    | "openai"
    | "groq"
    | undefined,
  requestedModel?: string
): ProviderConfig | null {
  const openaiKey =
    process.env.OPENAI_API_KEY;

  const groqKey =
    process.env.GROQ_API_KEY;

  const cleanModel =
    requestedModel?.trim();

  if (
    preferred === "openai" &&
    openaiKey
  ) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseUrl:
        "https://api.openai.com/v1",
      model:
        cleanModel ||
        DEFAULT_OPENAI_MODEL,
    };
  }

  if (
    preferred === "groq" &&
    groqKey
  ) {
    return {
      provider: "groq",
      apiKey: groqKey,
      baseUrl:
        "https://api.groq.com/openai/v1",
      model:
        cleanModel ||
        DEFAULT_GROQ_MODEL,
    };
  }

  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseUrl:
        "https://api.openai.com/v1",
      model:
        cleanModel ||
        DEFAULT_OPENAI_MODEL,
    };
  }

  if (groqKey) {
    return {
      provider: "groq",
      apiKey: groqKey,
      baseUrl:
        "https://api.groq.com/openai/v1",
      model:
        cleanModel ||
        DEFAULT_GROQ_MODEL,
    };
  }

  return null;
}

/* ==================================================
   BUILD AI MESSAGES
================================================== */

function buildAIMessages(
  systemPrompt: string,
  messages: ChatMessage[]
) {
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    ...messages.map(
      (message) => ({
        role: message.role,
        content: message.content,
      })
    ),
  ];
}

/* ==================================================
   AI REQUEST
================================================== */

async function callAI(
  provider: ProviderConfig,
  messages: ChatMessage[],
  systemPrompt: string,
  options: {
    temperature: number;
    maxTokens: number;
    stream: boolean;
  }
) {
  return fetch(
    `${provider.baseUrl}/chat/completions`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${provider.apiKey}`,

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        model: provider.model,

        messages:
          buildAIMessages(
            systemPrompt,
            messages
          ),

        temperature:
          options.temperature,

        max_tokens:
          options.maxTokens,

        stream:
          options.stream,
      }),

      signal:
        AbortSignal.timeout(
          120_000
        ),
    }
  );
}

/* ==================================================
   FALLBACK PROVIDER
================================================== */

function getFallbackProvider(
  current: ProviderConfig,
  requestedModel?: string
): ProviderConfig | null {
  if (
    current.provider === "openai" &&
    process.env.GROQ_API_KEY
  ) {
    return {
      provider: "groq",

      apiKey:
        process.env.GROQ_API_KEY,

      baseUrl:
        "https://api.groq.com/openai/v1",

      model:
        requestedModel ||
        DEFAULT_GROQ_MODEL,
    };
  }

  if (
    current.provider === "groq" &&
    process.env.OPENAI_API_KEY
  ) {
    return {
      provider: "openai",

      apiKey:
        process.env.OPENAI_API_KEY,

      baseUrl:
        "https://api.openai.com/v1",

      model:
        requestedModel ||
        DEFAULT_OPENAI_MODEL,
    };
  }

  return null;
}

/* ==================================================
   STREAM RESPONSE
================================================== */

function createStreamingResponse(
  upstream: Response,
  provider: ProviderConfig,
  model: string
) {
  if (!upstream.body) {
    return new Response(
      createSSE(
        "error",
        {
          message:
            "AI provider returned an empty stream.",
        }
      ),
      {
        status: 502,

        headers: {
          "Content-Type":
            "text/event-stream",

          "Cache-Control":
            "no-cache, no-transform",

          Connection:
            "keep-alive",

          "X-Accel-Buffering":
            "no",
        },
      }
    );
  }

  const reader =
    upstream.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";

  const stream =
    new ReadableStream({
      async start(
        controller
      ) {
        controller.enqueue(
          createSSE(
            "meta",
            {
              provider:
                provider.provider,

              model,
            }
          )
        );

        try {
          while (true) {
            const {
              done,
              value,
            } =
              await reader.read();

            if (done) {
              break;
            }

            buffer +=
              decoder.decode(
                value,
                {
                  stream: true,
                }
              );

            const lines =
              buffer.split("\n");

            buffer =
              lines.pop() ?? "";

            for (
              const rawLine of lines
            ) {
              const line =
                rawLine.trim();

              if (
                !line ||
                !line.startsWith(
                  "data:"
                )
              ) {
                continue;
              }

              const payload =
                line.slice(5).trim();

              if (
                payload === "[DONE]"
              ) {
                continue;
              }

              try {
                const parsed =
                  JSON.parse(
                    payload
                  );

                const content =
                  parsed?.choices?.[0]
                    ?.delta?.content;

                if (
                  typeof content ===
                    "string" &&
                  content.length > 0
                ) {
                  controller.enqueue(
                    createSSE(
                      "token",
                      {
                        content,
                      }
                    )
                  );
                }
              } catch {
                // Ignore malformed provider chunks.
              }
            }
          }

          controller.enqueue(
            createSSE(
              "done",
              {
                provider:
                  provider.provider,

                model,
              }
            )
          );

          controller.close();
        } catch (error) {
          controller.enqueue(
            createSSE(
              "error",
              {
                message:
                  error instanceof Error
                    ? error.message
                    : "Streaming failed.",
              }
            )
          );

          controller.close();
        } finally {
          reader.releaseLock();
        }
      },
    });

  return new Response(
    stream,
    {
      status: 200,

      headers: {
        "Content-Type":
          "text/event-stream",

        "Cache-Control":
          "no-cache, no-transform",

        Connection:
          "keep-alive",

        "X-Accel-Buffering":
          "no",
      },
    }
  );
}

/* ==================================================
   POST
================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    let body:
      ChatRequestBody;

    try {
      body =
        await request.json();
    } catch {
      return jsonError(
        "Invalid JSON request body.",
        400
      );
    }

    const incomingMessages =
      sanitizeMessages(
        body.messages
      );

    const directMessage =
      typeof body.message === "string"
        ? body.message
            .trim()
            .slice(
              0,
              MAX_MESSAGE_LENGTH
            )
        : "";

    if (
      incomingMessages.length === 0 &&
      !directMessage
    ) {
      return jsonError(
        "A message is required.",
        400
      );
    }

    const messages =
      directMessage
        ? [
            ...incomingMessages,
            {
              role: "user" as const,
              content:
                directMessage,
            },
          ]
        : incomingMessages;

    const knowledge =
      sanitizeKnowledge(
        body.knowledge
      );

    const provider =
      getProvider(
        body.provider,
        body.model
      );

    if (!provider) {
      return jsonError(
        "No AI provider is configured. Add OPENAI_API_KEY or GROQ_API_KEY to your environment.",
        503
      );
    }

    const temperature =
      typeof body.temperature ===
        "number"
        ? Math.min(
            2,
            Math.max(
              0,
              body.temperature
            )
          )
        : 0.7;

    const maxTokens =
      typeof body.maxTokens ===
        "number"
        ? Math.min(
            16_000,
            Math.max(
              1,
              Math.floor(
                body.maxTokens
              )
            )
          )
        : 4_000;

    const shouldStream =
      body.stream === true;

    const systemPrompt =
      buildSystemPrompt(
        body.systemPrompt,
        knowledge
      );

    let response =
      await callAI(
        provider,
        messages,
        systemPrompt,
        {
          temperature,
          maxTokens,
          stream:
            shouldStream,
        }
      );

    let activeProvider =
      provider;

    /*
      Provider fallback:
      If one configured provider fails,
      SYRAVEN can continue through
      the other configured provider.
    */
    if (!response.ok) {
      const fallback =
        getFallbackProvider(
          provider
        );

      if (fallback) {
        const fallbackResponse =
          await callAI(
            fallback,
            messages,
            systemPrompt,
            {
              temperature,
              maxTokens,
              stream:
                shouldStream,
            }
          );

        if (
          fallbackResponse.ok
        ) {
          response =
            fallbackResponse;

          activeProvider =
            fallback;
        }
      }
    }

    if (!response.ok) {
      const errorText =
        await response
          .text()
          .catch(
            () => ""
          );

      console.error(
        "SYRAVEN CHAT PROVIDER ERROR:",
        {
          provider:
            activeProvider.provider,

          status:
            response.status,

          error:
            errorText,
        }
      );

      return jsonError(
        "The AI provider could not complete this request.",
        502
      );
    }

    if (shouldStream) {
      return createStreamingResponse(
        response,
        activeProvider,
        activeProvider.model
      );
    }

    const data =
      await response.json();

    const content =
      data?.choices?.[0]
        ?.message?.content;

    if (
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return jsonError(
        "The AI provider returned an empty response.",
        502
      );
    }

    return NextResponse.json(
      {
        success: true,

        conversationId:
          body.conversationId ??
          null,

        projectId:
          body.projectId ??
          null,

        workspaceId:
          body.workspaceId ??
          null,

        message: {
          role:
            "assistant",

          content:
            content.trim(),
        },

        provider:
          activeProvider.provider,

        model:
          activeProvider.model,

        usage:
          data?.usage ?? null,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      error.name ===
        "TimeoutError";

    console.error(
      "SYRAVEN CHAT API ERROR:",
      error
    );

    return jsonError(
      isTimeout
        ? "The AI request timed out. Please try again."
        : "An unexpected error occurred while processing the chat request.",
      isTimeout
        ? 504
        : 500
    );
  }
}

/* ==================================================
   GET
   Lightweight API status endpoint
================================================== */

export async function GET() {
  const providers = {
    openai: Boolean(
      process.env.OPENAI_API_KEY
    ),

    groq: Boolean(
      process.env.GROQ_API_KEY
    ),
  };

  return NextResponse.json(
    {
      success: true,

      service:
        "SYRAVEN Chat API",

      status:
        providers.openai ||
        providers.groq
          ? "operational"
          : "not_configured",

      providers,

      streaming: true,

      features: [
        "multi_provider",
        "provider_fallback",
        "streaming",
        "conversation_context",
        "knowledge_context",
        "custom_system_prompts",
        "model_selection",
      ],
    },
    {
      status: 200,
    }
  );
}