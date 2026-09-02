import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN FILE ANALYZE API
   Intelligent document analysis gateway
================================================== */

type AIProvider =
  | "openai"
  | "groq";

type AnalysisMode =
  | "summary"
  | "detailed"
  | "insights"
  | "structure"
  | "risks"
  | "actions"
  | "full";

type FileInput = {
  id?: string;
  name?: string;
  type?: string;
  size?: number;
  content?: string;
  extractedText?: string;
  metadata?: Record<string, unknown>;
};

type AnalyzeRequestBody = {
  file?: FileInput;
  files?: FileInput[];

  mode?: AnalysisMode;

  prompt?: string;

  language?: string;

  provider?:
    | "auto"
    | "openai"
    | "groq";

  model?: string;

  maxTokens?: number;

  temperature?: number;

  include:
    | {
        summary?: boolean;
        keyPoints?: boolean;
        insights?: boolean;
        actions?: boolean;
        risks?: boolean;
        questions?: boolean;
        structure?: boolean;
      }
    | undefined;

  projectId?: string | null;

  workspaceId?: string | null;
};

type ProviderConfig = {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
};

type AnalysisResult = {
  summary: string;
  keyPoints: string[];
  insights: string[];
  actions: string[];
  risks: string[];
  questions: string[];
  structure: {
    overview: string;
    sections: string[];
    entities: string[];
  };
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

const MAX_FILES = 20;
const MAX_FILE_NAME_LENGTH = 500;
const MAX_FILE_CONTENT_LENGTH = 120_000;

const encoder =
  new TextEncoder();

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

function safeString(
  value: unknown,
  maxLength = MAX_FILE_CONTENT_LENGTH
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(
      0,
      maxLength
    );
}

/* ==================================================
   VALIDATION
================================================== */

function isValidMode(
  value: unknown
): value is AnalysisMode {
  return [
    "summary",
    "detailed",
    "insights",
    "structure",
    "risks",
    "actions",
    "full",
  ].includes(
    String(value)
  );
}

function normalizeFile(
  input: unknown
): FileInput | null {
  if (
    !input ||
    typeof input !== "object"
  ) {
    return null;
  }

  const file =
    input as FileInput;

  const content =
    safeString(
      file.extractedText ||
        file.content
    );

  if (!content) {
    return null;
  }

  return {
    id:
      typeof file.id === "string"
        ? file.id
        : undefined,

    name:
      safeString(
        file.name,
        MAX_FILE_NAME_LENGTH
      ) ||
      "Untitled file",

    type:
      safeString(
        file.type,
        200
      ) ||
      "unknown",

    size:
      typeof file.size === "number" &&
      Number.isFinite(
        file.size
      )
        ? file.size
        : undefined,

    content,
    metadata:
      file.metadata &&
      typeof file.metadata ===
        "object"
        ? file.metadata
        : undefined,
  };
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

  const model =
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
        model ||
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
        model ||
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
        model ||
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
        model ||
        DEFAULT_GROQ_MODEL,
    };
  }

  return null;
}

/* ==================================================
   FALLBACK PROVIDER
================================================== */

function getFallbackProvider(
  current: ProviderConfig
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
        DEFAULT_OPENAI_MODEL,
    };
  }

  return null;
}

/* ==================================================
   ANALYSIS INSTRUCTIONS
================================================== */

function getModeInstructions(
  mode: AnalysisMode
) {
  switch (mode) {
    case "summary":
      return `
Focus on an excellent concise summary.
Extract only the most important information.
`;

    case "detailed":
      return `
Perform a deep and detailed analysis.
Explain major ideas, relationships,
important evidence and implications.
`;

    case "insights":
      return `
Focus on hidden patterns, opportunities,
important conclusions and non-obvious insights.
`;

    case "structure":
      return `
Focus on document organization,
major sections, concepts, entities
and information hierarchy.
`;

    case "risks":
      return `
Focus on risks, contradictions,
weak assumptions, missing information
and potential problems.
`;

    case "actions":
      return `
Focus on practical next steps,
recommendations and actionable decisions.
`;

    case "full":
    default:
      return `
Perform a comprehensive premium analysis.
Balance summary, insights, risks,
actions, structure and important questions.
`;
  }
}

/* ==================================================
   BUILD FILE CONTEXT
================================================== */

function buildFileContext(
  files: FileInput[]
) {
  return files
    .map(
      (
        file,
        index
      ) => {
        return `
==================================================
FILE ${index + 1}

Name: ${file.name ?? "Untitled"}
Type: ${file.type ?? "unknown"}
Size: ${file.size ?? "unknown"}

CONTENT:
${file.content ?? ""}
==================================================
`;
      }
    )
    .join("\n");
}

/* ==================================================
   SYSTEM PROMPT
================================================== */

function buildSystemPrompt(
  mode: AnalysisMode,
  language?: string,
  customPrompt?: string,
  include?: AnalyzeRequestBody["include"]
) {
  const requestedLanguage =
    safeString(
      language,
      100
    ) || "Match the user's language.";

  const includeInstructions = `
Summary: ${
    include?.summary !== false
      ? "Include"
      : "Optional"
  }

Key points: ${
    include?.keyPoints !== false
      ? "Include"
      : "Optional"
  }

Insights: ${
    include?.insights !== false
      ? "Include"
      : "Optional"
  }

Actions: ${
    include?.actions !== false
      ? "Include"
      : "Optional"
  }

Risks: ${
    include?.risks !== false
      ? "Include"
      : "Optional"
  }

Questions: ${
    include?.questions !== false
      ? "Include"
      : "Optional"
  }

Structure: ${
    include?.structure !== false
      ? "Include"
      : "Optional"
  }
`;

  return `
You are SYRAVEN's premium document intelligence system.

Analyze only the information that is actually present
in the provided files.

Never invent facts, quotes, sources or file contents.

When something is uncertain, incomplete or unsupported,
state that clearly.

Your analysis should be useful for professionals,
creators, researchers, teams and enterprises.

Analysis mode:
${mode}

Mode instructions:
${getModeInstructions(mode)}

Requested output language:
${requestedLanguage}

Requested sections:
${includeInstructions}

Return ONLY valid JSON.

Use exactly this structure:

{
  "summary": "string",
  "keyPoints": ["string"],
  "insights": ["string"],
  "actions": ["string"],
  "risks": ["string"],
  "questions": ["string"],
  "structure": {
    "overview": "string",
    "sections": ["string"],
    "entities": ["string"]
  }
}

Additional user instruction:
${safeString(
  customPrompt,
  10_000
) || "No additional instruction."}
`.trim();
}

/* ==================================================
   AI REQUEST
================================================== */

async function callAI(
  provider: ProviderConfig,
  systemPrompt: string,
  fileContext: string,
  temperature: number,
  maxTokens: number
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
        model:
          provider.model,

        messages: [
          {
            role: "system",
            content:
              systemPrompt,
          },
          {
            role: "user",
            content:
              `Analyze these files:\n\n${fileContext}`,
          },
        ],

        temperature,

        max_tokens:
          maxTokens,

        response_format: {
          type:
            "json_object",
        },
      }),

      signal:
        AbortSignal.timeout(
          120_000
        ),
    }
  );
}

/* ==================================================
   PARSE RESULT
================================================== */

function stringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item
      ) =>
        typeof item ===
        "string"
    )
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean)
    .slice(
      0,
      100
    );
}

function normalizeResult(
  value: unknown
): AnalysisResult {
  const data =
    value &&
    typeof value === "object"
      ? value as Record<
          string,
          unknown
        >
      : {};

  const structure =
    data.structure &&
    typeof data.structure ===
      "object"
      ? data.structure as Record<
          string,
          unknown
        >
      : {};

  return {
    summary:
      safeString(
        data.summary,
        30_000
      ),

    keyPoints:
      stringArray(
        data.keyPoints
      ),

    insights:
      stringArray(
        data.insights
      ),

    actions:
      stringArray(
        data.actions
      ),

    risks:
      stringArray(
        data.risks
      ),

    questions:
      stringArray(
        data.questions
      ),

    structure: {
      overview:
        safeString(
          structure.overview,
          20_000
        ),

      sections:
        stringArray(
          structure.sections
        ),

      entities:
        stringArray(
          structure.entities
        ),
    },
  };
}

/* ==================================================
   POST
================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    let body:
      AnalyzeRequestBody;

    try {
      body =
        await request.json();
    } catch {
      return jsonError(
        "Invalid JSON request body.",
        400
      );
    }

    const normalizedFiles =
      Array.isArray(
        body.files
      )
        ? body.files
            .slice(
              0,
              MAX_FILES
            )
            .map(
              normalizeFile
            )
            .filter(
              (
                file
              ): file is FileInput =>
                Boolean(file)
            )
        : [];

    const singleFile =
      normalizeFile(
        body.file
      );

    const files =
      normalizedFiles.length > 0
        ? normalizedFiles
        : singleFile
          ? [singleFile]
          : [];

    if (
      files.length === 0
    ) {
      return jsonError(
        "At least one file with extracted text is required.",
        400
      );
    }

    const mode =
      isValidMode(
        body.mode
      )
        ? body.mode
        : "full";

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
            1.5,
            Math.max(
              0,
              body.temperature
            )
          )
        : 0.3;

    const maxTokens =
      typeof body.maxTokens ===
        "number"
        ? Math.min(
            16_000,
            Math.max(
              500,
              Math.floor(
                body.maxTokens
              )
            )
          )
        : 5_000;

    const systemPrompt =
      buildSystemPrompt(
        mode,
        body.language,
        body.prompt,
        body.include
      );

    const fileContext =
      buildFileContext(
        files
      );

    let activeProvider =
      provider;

    let response =
      await callAI(
        activeProvider,
        systemPrompt,
        fileContext,
        temperature,
        maxTokens
      );

    if (!response.ok) {
      const fallback =
        getFallbackProvider(
          activeProvider
        );

      if (fallback) {
        const fallbackResponse =
          await callAI(
            fallback,
            systemPrompt,
            fileContext,
            temperature,
            maxTokens
          );

        if (
          fallbackResponse.ok
        ) {
          activeProvider =
            fallback;

          response =
            fallbackResponse;
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
        "SYRAVEN FILE ANALYSIS ERROR:",
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
        "The AI provider could not analyze the file.",
        502
      );
    }

    const data =
      await response.json();

    const content =
      data?.choices?.[0]
        ?.message?.content;

    if (
      typeof content !== "string" ||
      !content.trim()
    ) {
      return jsonError(
        "The AI provider returned an empty analysis.",
        502
      );
    }

    let parsedResult:
      unknown;

    try {
      parsedResult =
        JSON.parse(
          content
        );
    } catch {
      console.error(
        "SYRAVEN FILE ANALYSIS JSON ERROR:",
        content
      );

      return jsonError(
        "The AI provider returned an invalid analysis format.",
        502
      );
    }

    const analysis =
      normalizeResult(
        parsedResult
      );

    return NextResponse.json(
      {
        success: true,

        analysis,

        meta: {
          mode,

          provider:
            activeProvider.provider,

          model:
            activeProvider.model,

          files: files.map(
            (file) => ({
              id:
                file.id ??
                null,

              name:
                file.name ??
                "Untitled file",

              type:
                file.type ??
                "unknown",

              size:
                file.size ??
                null,
            })
          ),

          projectId:
            body.projectId ??
            null,

          workspaceId:
            body.workspaceId ??
            null,

          analyzedAt:
            new Date()
              .toISOString(),

          usage:
            data?.usage ??
            null,
        },
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
      "SYRAVEN FILE ANALYZE API ERROR:",
      error
    );

    return jsonError(
      isTimeout
        ? "File analysis timed out. Please try again."
        : "An unexpected error occurred while analyzing the file.",
      isTimeout
        ? 504
        : 500
    );
  }
}

/* ==================================================
   GET
================================================== */

export async function GET() {
  return NextResponse.json(
    {
      success: true,

      service:
        "SYRAVEN File Analysis API",

      status:
        process.env.OPENAI_API_KEY ||
        process.env.GROQ_API_KEY
          ? "operational"
          : "not_configured",

      capabilities: [
        "single_file_analysis",
        "multi_file_analysis",
        "document_summary",
        "deep_analysis",
        "insights",
        "risk_detection",
        "action_items",
        "question_generation",
        "document_structure",
        "provider_fallback",
      ],

      limits: {
        maxFiles:
          MAX_FILES,

        maxContentCharacters:
          MAX_FILE_CONTENT_LENGTH,
      },
    },
    {
      status: 200,
    }
  );
}