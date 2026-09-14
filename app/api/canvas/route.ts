import { NextResponse } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import { enforceUsage } from "@/lib/api/usageGuard";
import { chatCompletion } from "@/lib/ai/provider";
import { providerApiKey, selectModel } from "@/lib/ai/registry";
import { clampMaxTokens } from "@/lib/usage/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   TYPES
================================================== */

type CanvasBlockType =
  | "heading"
  | "paragraph"
  | "bullet_list"
  | "numbered_list"
  | "quote"
  | "code"
  | "table"
  | "divider";

type CanvasBlock = {
  id: string;
  type: CanvasBlockType;
  content: string;
  language?: string;
};

type CanvasDocument = {
  title: string;
  description: string;
  blocks: CanvasBlock[];
};

type CanvasRequest = {
  prompt?: string;
  content?: string;
  mode?:
    | "document"
    | "research"
    | "code"
    | "analysis"
    | "presentation"
    | "plan";
};

/* ==================================================
   HELPERS
================================================== */

function createId() {
  return crypto.randomUUID();
}

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function sanitizeBlockType(
  value: unknown
): CanvasBlockType {
  const allowed: CanvasBlockType[] = [
    "heading",
    "paragraph",
    "bullet_list",
    "numbered_list",
    "quote",
    "code",
    "table",
    "divider",
  ];

  return allowed.includes(
    value as CanvasBlockType
  )
    ? (value as CanvasBlockType)
    : "paragraph";
}

function normalizeCanvas(
  value: unknown
): CanvasDocument {
  const fallback: CanvasDocument = {
    title: "Untitled Canvas",
    description: "",
    blocks: [],
  };

  if (
    !value ||
    typeof value !== "object"
  ) {
    return fallback;
  }

  const raw =
    value as Partial<CanvasDocument>;

  const rawBlocks =
    Array.isArray(raw.blocks)
      ? raw.blocks
      : [];

  return {
    title:
      cleanText(raw.title) ||
      "Untitled Canvas",

    description:
      cleanText(raw.description),

    blocks: rawBlocks
      .filter(
        (
          block
        ) =>
          block &&
          typeof block === "object"
      )
      .map(
        (
          block
        ) => {
          const item =
            block as Partial<CanvasBlock>;

          return {
            id:
              cleanText(item.id) ||
              createId(),

            type:
              sanitizeBlockType(
                item.type
              ),

            content:
              cleanText(
                item.content
              ),

            ...(cleanText(
              item.language
            )
              ? {
                  language:
                    cleanText(
                      item.language
                    ),
                }
              : {}),
          };
        }
      )
      .filter(
        (
          block
        ) =>
          block.type ===
            "divider" ||
          Boolean(
            block.content
          )
      ),
  };
}

function extractJson(
  content: string
): unknown {
  const cleaned =
    content
      .trim()
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  try {
    return JSON.parse(
      cleaned
    );
  } catch {
    const start =
      cleaned.indexOf("{");

    const end =
      cleaned.lastIndexOf("}");

    if (
      start === -1 ||
      end === -1 ||
      end <= start
    ) {
      throw new Error(
        "Canvas response is not valid JSON."
      );
    }

    return JSON.parse(
      cleaned.slice(
        start,
        end + 1
      )
    );
  }
}

/* ==================================================
   POST
================================================== */

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
    "ai:canvas",
    "chatMessage",
      ["chatMessageMonthly"]
  );

  if (guard.denied) {
    return guard.response;
  }
  try {
    const body =
      (await request.json()) as CanvasRequest;

    const prompt =
      cleanText(body.prompt);

    const content =
      cleanText(body.content);

    const mode =
      cleanText(body.mode) ||
      "document";

    if (
      !prompt &&
      !content
    ) {
      return NextResponse.json(
        {
          error:
            "Canvas content is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      The registry chooses the model for the caller's plan and the
      provider adapter carries the call, as for every other generation
      route. This route used to build its own OpenAI SDK client and send
      whatever OPENAI_CANVAS_MODEL named -- a model no plan check had
      approved, on a transport the AI policy never saw.

      A missing capability says so. This route also once answered
      success: true with a template built from the caller's own text
      (ARCHITECTURE_NORTH_STAR.md §9).
    */
    const model = selectModel(
      null,
      "chat",
      guard.entitlement.effectivePlan
    );

    if (!model.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI canvas generation is not configured on this deployment.",
        },
        {
          status: 503,
        }
      );
    }

    const sourceText =
      content || prompt;

    const completion =
      await chatCompletion({
        model: model.model,

        maxTokens: Math.min(
          clampMaxTokens(guard.entitlement, null),
          model.model.maxOutputTokens
        ),

        temperature: 0.4,

        messages: [
          {
            role: "system",

            content: `
You are the SYRAVEN Canvas Engine.

Transform the user's request into a structured,
high-quality editable canvas.

Return ONLY valid JSON.

Use exactly this structure:

{
  "title": "string",
  "description": "string",
  "blocks": [
    {
      "id": "unique-string",
      "type": "heading | paragraph | bullet_list | numbered_list | quote | code | table | divider",
      "content": "string",
      "language": "optional string"
    }
  ]
}

Rules:

- Never use markdown code fences.
- Never add explanations outside JSON.
- Use clear logical sections.
- Create useful, editable content.
- Preserve important information.
- If code is requested, use code blocks with a language.
- Keep tables as structured text content.
            `.trim(),
          },

          {
            role: "user",

            content: `
MODE:
${mode}

REQUEST:
${prompt || "Convert the provided content into a useful canvas."}

CONTENT:
${sourceText}
            `.trim(),
          },
        ],
      });

    if (!completion.ok) {
      /*
        Normalised by the adapter -- including an empty answer -- so no
        provider internals reach the client.
      */
      return NextResponse.json(
        {
          success: false,
          error: completion.error.clientMessage,
        },
        {
          status: completion.error.status,
        }
      );
    }

    /*
      The call succeeded, so it is metered -- with the counts the provider
      reported -- whether or not its answer parses into a canvas.
    */
    await guard.record({
      model: completion.modelId,
      promptTokens: completion.usage.promptTokens,
      completionTokens: completion.usage.completionTokens,
      totalTokens: completion.usage.totalTokens,
    });

    const parsed =
      extractJson(
        completion.content
      );

    const canvas =
      normalizeCanvas(
        parsed
      );

    /*
      A reply that parses into no blocks is not a canvas. It used to be
      returned as success: true with an empty "Untitled Canvas"
      (docs/engineering/PURIFICATION_EVIDENCE.md P2-E07). The call was
      still made, so it stays metered above.
    */
    if (canvas.blocks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The model did not return a usable canvas.",
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        source: "ai",
        canvas,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    /* Name only: a provider error message can carry request internals. */
    console.error("[SYRAVEN_CANVAS_ERROR]", {
      userId: session.userId,
      name: error instanceof Error ? error.name : "unknown",
    });

    return NextResponse.json(
      {
        success: false,
        error: "The canvas could not be created.",
      },
      {
        status: 500,
      }
    );
  }
});

/* ==================================================
   GET
================================================== */

export async function GET() {
  /*
    Reports what this deployment can do, from the same registry the POST
    path uses. It used to answer "operational" unconditionally while POST
    answered 503 whenever no provider was configured
    (docs/engineering/PURIFICATION_EVIDENCE.md P2-E07).
  */
  const model = selectModel(null, "chat", "free");

  const configured =
    model.ok &&
    providerApiKey(model.model.provider) !== null;

  return NextResponse.json(
    {
      service:
        "SYRAVEN Canvas API",

      status:
        configured
          ? "operational"
          : "not_configured",

      capabilities: [
        "document",
        "research",
        "code",
        "analysis",
        "presentation",
        "plan",
      ],
    },
    {
      status: 200,
    }
  );
}