import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type AgentVisibility = "private" | "public" | "unlisted";

type AgentStatus = "active" | "draft" | "archived";

type AgentCategory =
  | "general"
  | "research"
  | "coding"
  | "writing"
  | "design"
  | "marketing"
  | "business"
  | "finance"
  | "study"
  | "automation"
  | "news"
  | "website"
  | "data"
  | "personal"
  | "custom";

type CreateAgentBody = {
  name?: unknown;
  description?: unknown;
  systemPrompt?: unknown;
  category?: unknown;
  visibility?: unknown;
  status?: unknown;
  model?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  icon?: unknown;
  color?: unknown;
  tags?: unknown;
  metadata?: unknown;
};

type QueryOptions = {
  search: string;
  category: string | null;
  visibility: AgentVisibility | null;
  status: AgentStatus | null;
  limit: number;
  offset: number;
  mineOnly: boolean;
};

/* -------------------------------------------------------------------------- */
/*                                ENVIRONMENT                                 */
/* -------------------------------------------------------------------------- */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

/* -------------------------------------------------------------------------- */
/*                              RESPONSE HELPERS                              */
/* -------------------------------------------------------------------------- */

function errorResponse(
  message: string,
  status = 400,
  code = "REQUEST_ERROR"
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code,
      },
    },
    {
      status,
    }
  );
}

function successResponse(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    {
      status,
    }
  );
}

/* -------------------------------------------------------------------------- */
/*                              SUPABASE CLIENT                               */
/* -------------------------------------------------------------------------- */

function getSupabaseAdmin() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function getSupabaseAuthClient() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY
  ) {
    throw new Error(
      "Supabase authentication configuration is missing."
    );
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/* -------------------------------------------------------------------------- */
/*                              AUTHENTICATION                                */
/* -------------------------------------------------------------------------- */

async function getAuthenticatedUser(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const token = authorization
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return null;
  }

  const supabase =
    getSupabaseAuthClient();

  const {
    data,
    error,
  } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

/* -------------------------------------------------------------------------- */
/*                                VALIDATION                                  */
/* -------------------------------------------------------------------------- */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isValidCategory(
  value: string
): value is AgentCategory {
  return [
    "general",
    "research",
    "coding",
    "writing",
    "design",
    "marketing",
    "business",
    "finance",
    "study",
    "automation",
    "news",
    "website",
    "data",
    "personal",
    "custom",
  ].includes(value);
}

function isValidVisibility(
  value: string
): value is AgentVisibility {
  return [
    "private",
    "public",
    "unlisted",
  ].includes(value);
}

function isValidStatus(
  value: string
): value is AgentStatus {
  return [
    "active",
    "draft",
    "archived",
  ].includes(value);
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.min(
    Math.max(value, minimum),
    maximum
  );
}

function normalizeString(
  value: unknown,
  maxLength: number
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, maxLength);
}

function normalizeTags(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueTags = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const tag = item
      .trim()
      .toLowerCase()
      .slice(0, 50);

    if (tag) {
      uniqueTags.add(tag);
    }

    if (uniqueTags.size >= 20) {
      break;
    }
  }

  return Array.from(uniqueTags);
}

/* -------------------------------------------------------------------------- */
/*                              QUERY OPTIONS                                 */
/* -------------------------------------------------------------------------- */

function getQueryOptions(
  request: NextRequest
): QueryOptions {
  const { searchParams } =
    new URL(request.url);

  const search =
    searchParams
      .get("search")
      ?.trim()
      .slice(0, 100) || "";

  const rawCategory =
    searchParams.get("category");

  const rawVisibility =
    searchParams.get("visibility");

  const rawStatus =
    searchParams.get("status");

  const rawLimit =
    Number(
      searchParams.get("limit")
    );

  const rawOffset =
    Number(
      searchParams.get("offset")
    );

  const mineOnly =
    searchParams.get("mine") === "true";

  const category =
    rawCategory &&
    isValidCategory(rawCategory)
      ? rawCategory
      : null;

  const visibility =
    rawVisibility &&
    isValidVisibility(rawVisibility)
      ? rawVisibility
      : null;

  const status =
    rawStatus &&
    isValidStatus(rawStatus)
      ? rawStatus
      : null;

  return {
    search,
    category,
    visibility,
    status,
    limit: clampNumber(
      rawLimit,
      1,
      100,
      30
    ),
    offset: clampNumber(
      rawOffset,
      0,
      100000,
      0
    ),
    mineOnly,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  OPTIONS                                   */
/* -------------------------------------------------------------------------- */

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                    GET                                     */
/* -------------------------------------------------------------------------- */

export async function GET(
  request: NextRequest
) {
  try {
    const options =
      getQueryOptions(request);

    const user =
      await getAuthenticatedUser(
        request
      );

    if (
      options.mineOnly &&
      !user
    ) {
      return errorResponse(
        "Authentication is required to view your agents.",
        401,
        "UNAUTHORIZED"
      );
    }

    const supabase =
      getSupabaseAdmin();

    let query = supabase
      .from("agents")
      .select(
        `
          id,
          user_id,
          name,
          description,
          system_prompt,
          category,
          visibility,
          status,
          model,
          temperature,
          max_tokens,
          icon,
          color,
          tags,
          metadata,
          created_at,
          updated_at
        `,
        {
          count: "exact",
        }
      )
      .order(
        "updated_at",
        {
          ascending: false,
        }
      );

    /*
     * Kullanıcının kendi agentları
     */

    if (
      options.mineOnly &&
      user
    ) {
      query = query.eq(
        "user_id",
        user.id
      );
    }

    /*
     * Genel Agent Store
     */

    if (
      !options.mineOnly
    ) {
      if (user) {
        query = query.or(
          `visibility.eq.public,user_id.eq.${user.id}`
        );
      } else {
        query = query.eq(
          "visibility",
          "public"
        );
      }
    }

    /*
     * Category filter
     */

    if (options.category) {
      query = query.eq(
        "category",
        options.category
      );
    }

    /*
     * Visibility filter
     */

    if (
      options.visibility &&
      options.mineOnly
    ) {
      query = query.eq(
        "visibility",
        options.visibility
      );
    }

    /*
     * Status filter
     */

    if (options.status) {
      query = query.eq(
        "status",
        options.status
      );
    } else if (
      !options.mineOnly
    ) {
      query = query.eq(
        "status",
        "active"
      );
    }

    /*
     * Search
     */

    if (options.search) {
      const sanitizedSearch =
        options.search.replace(
          /[%_(),]/g,
          ""
        );

      if (sanitizedSearch) {
        query = query.or(
          `name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`
        );
      }
    }

    query = query.range(
      options.offset,
      options.offset +
        options.limit -
        1
    );

    const {
      data,
      error,
      count,
    } = await query;

    if (error) {
      console.error(
        "[SYRAVEN AGENTS GET ERROR]",
        {
          error,
          userId:
            user?.id || null,
        }
      );

      return errorResponse(
        "Agents could not be loaded.",
        500,
        "AGENTS_FETCH_FAILED"
      );
    }

    const total =
      count || 0;

    const hasMore =
      options.offset +
        (data?.length || 0) <
      total;

    return successResponse({
      agents: data || [],

      pagination: {
        total,
        limit:
          options.limit,
        offset:
          options.offset,
        hasMore,
      },

      filters: {
        search:
          options.search || null,
        category:
          options.category,
        visibility:
          options.visibility,
        status:
          options.status,
        mine:
          options.mineOnly,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error(
      "[SYRAVEN AGENTS GET FATAL ERROR]",
      {
        error: message,
      }
    );

    return errorResponse(
      "An unexpected error occurred while loading agents.",
      500,
      "INTERNAL_ERROR"
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: NextRequest
) {
  try {
    const user =
      await getAuthenticatedUser(
        request
      );

    if (!user) {
      return errorResponse(
        "Authentication is required to create an agent.",
        401,
        "UNAUTHORIZED"
      );
    }

    let body: CreateAgentBody;

    try {
      body =
        (await request.json()) as CreateAgentBody;
    } catch {
      return errorResponse(
        "Invalid JSON request body.",
        400,
        "INVALID_JSON"
      );
    }

    const name =
      normalizeString(
        body.name,
        100
      );

    const description =
      normalizeString(
        body.description,
        2000
      );

    const systemPrompt =
      normalizeString(
        body.systemPrompt,
        20000
      );

    if (!name) {
      return errorResponse(
        "Agent name is required.",
        400,
        "NAME_REQUIRED"
      );
    }

    if (name.length < 2) {
      return errorResponse(
        "Agent name must contain at least 2 characters.",
        400,
        "INVALID_NAME"
      );
    }

    if (!description) {
      return errorResponse(
        "Agent description is required.",
        400,
        "DESCRIPTION_REQUIRED"
      );
    }

    if (!systemPrompt) {
      return errorResponse(
        "Agent instructions are required.",
        400,
        "SYSTEM_PROMPT_REQUIRED"
      );
    }

    const rawCategory =
      normalizeString(
        body.category,
        50
      );

    const category =
      isValidCategory(rawCategory)
        ? rawCategory
        : "custom";

    const rawVisibility =
      normalizeString(
        body.visibility,
        50
      );

    const visibility =
      isValidVisibility(
        rawVisibility
      )
        ? rawVisibility
        : "private";

    const rawStatus =
      normalizeString(
        body.status,
        50
      );

    const status =
      isValidStatus(rawStatus)
        ? rawStatus
        : "active";

    const model =
      normalizeString(
        body.model,
        150
      ) ||
      process.env.AI_DEFAULT_MODEL ||
      process.env.GROQ_MODEL ||
      "llama-3.3-70b-versatile";

    const temperature =
      clampNumber(
        body.temperature,
        0,
        2,
        0.7
      );

    const maxTokens =
      clampNumber(
        body.maxTokens,
        1,
        32768,
        4096
      );

    const icon =
      normalizeString(
        body.icon,
        50
      ) || null;

    const color =
      normalizeString(
        body.color,
        50
      ) || null;

    const tags =
      normalizeTags(
        body.tags
      );

    const metadata =
      isRecord(body.metadata)
        ? body.metadata
        : {};

    const supabase =
      getSupabaseAdmin();

    const {
      data,
      error,
    } = await supabase
      .from("agents")
      .insert({
        user_id: user.id,

        name,
        description,

        system_prompt:
          systemPrompt,

        category,

        visibility,

        status,

        model,

        temperature,

        max_tokens:
          maxTokens,

        icon,

        color,

        tags,

        metadata,
      })
      .select(
        `
          id,
          user_id,
          name,
          description,
          system_prompt,
          category,
          visibility,
          status,
          model,
          temperature,
          max_tokens,
          icon,
          color,
          tags,
          metadata,
          created_at,
          updated_at
        `
      )
      .single();

    if (error) {
      console.error(
        "[SYRAVEN AGENT CREATE ERROR]",
        {
          error,
          userId:
            user.id,
        }
      );

      return errorResponse(
        "The agent could not be created.",
        500,
        "AGENT_CREATE_FAILED"
      );
    }

    return successResponse(
      {
        agent: data,
      },
      201
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error(
      "[SYRAVEN AGENT CREATE FATAL ERROR]",
      {
        error: message,
      }
    );

    return errorResponse(
      "An unexpected error occurred while creating the agent.",
      500,
      "INTERNAL_ERROR"
    );
  }
}