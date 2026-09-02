import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import OpenAI from "openai";

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
   FALLBACK CANVAS
================================================== */

function createFallbackCanvas(
  prompt: string,
  content: string,
  mode: string
): CanvasDocument {
  const source =
    content || prompt;

  return {
    title:
      prompt
        .slice(0, 80)
        .trim() ||
      "New SYRAVEN Canvas",

    description:
      `SYRAVEN ${mode} workspace`,

    blocks: [
      {
        id: createId(),
        type: "heading",
        content:
          "SYRAVEN Canvas",
      },
      {
        id: createId(),
        type: "paragraph",
        content:
          source ||
          "Start creating your workspace.",
      },
    ],
  };
}

/* ==================================================
   POST
================================================== */

export async function POST(
  request: NextRequest
) {
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
            "Canvas için içerik gerekli.",
        },
        {
          status: 400,
        }
      );
    }

    const apiKey =
      process.env.OPENAI_API_KEY;

    /*
      API key yoksa uygulama hata vermez.
      Canvas temel fallback ile çalışır.
    */

    if (!apiKey) {
      return NextResponse.json(
        {
          success: true,
          source: "fallback",
          canvas:
            createFallbackCanvas(
              prompt,
              content,
              mode
            ),
        },
        {
          status: 200,
        }
      );
    }

    const openai =
      new OpenAI({
        apiKey,
      });

    const sourceText =
      content || prompt;

    const response =
      await openai.chat.completions.create({
        model:
          process.env
            .OPENAI_CANVAS_MODEL ||
          "gpt-4o-mini",

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

    const aiContent =
      response.choices[0]
        ?.message
        ?.content;

    if (!aiContent) {
      return NextResponse.json(
        {
          success: true,
          source: "fallback",

          canvas:
            createFallbackCanvas(
              prompt,
              content,
              mode
            ),
        },
        {
          status: 200,
        }
      );
    }

    const parsed =
      extractJson(
        aiContent
      );

    const canvas =
      normalizeCanvas(
        parsed
      );

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
    console.error(
      "SYRAVEN CANVAS API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Canvas oluşturulurken bir hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}

/* ==================================================
   GET
================================================== */

export async function GET() {
  return NextResponse.json(
    {
      service:
        "SYRAVEN Canvas API",

      status:
        "operational",

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