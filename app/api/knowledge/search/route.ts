import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN KNOWLEDGE SEARCH API
================================================== */

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 1000;

/* ==================================================
   TYPES
================================================== */

type SearchScope =
  | "all"
  | "personal"
  | "project"
  | "workspace"
  | "team";

type KnowledgeSourceType =
  | "file"
  | "document"
  | "note"
  | "message"
  | "web"
  | "project"
  | "memory"
  | "other";

type KnowledgeSearchRequest = {
  query: string;
  limit?: number;
  projectId?: string;
  workspaceId?: string;
  teamId?: string;
  scope?: SearchScope;
  sourceTypes?: KnowledgeSourceType[];
};

type KnowledgeSearchResult = {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  sourceType: KnowledgeSourceType;
  sourceId: string | null;
  projectId: string | null;
  workspaceId: string | null;
  teamId: string | null;
  metadata: Record<string, unknown>;
  score: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type AuthenticatedUser = {
  id: string;
  email: string | null;
};

/* ==================================================
   HELPERS
================================================== */

function clampLimit(
  value: unknown
) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.max(
      Math.floor(parsed),
      1
    ),
    MAX_LIMIT
  );
}

function normalizeScope(
  value: unknown
): SearchScope {
  switch (value) {
    case "personal":
    case "project":
    case "workspace":
    case "team":
      return value;

    default:
      return "all";
  }
}

function normalizeSourceTypes(
  value: unknown
): KnowledgeSourceType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed =
    new Set<KnowledgeSourceType>([
      "file",
      "document",
      "note",
      "message",
      "web",
      "project",
      "memory",
      "other",
    ]);

  return value.filter(
    (
      item
    ): item is KnowledgeSourceType =>
      typeof item === "string" &&
      allowed.has(
        item as KnowledgeSourceType
      )
  );
}

function createExcerpt(
  content: string,
  query: string
) {
  const normalizedContent =
    content.replace(/\s+/g, " ").trim();

  if (!normalizedContent) {
    return "";
  }

  const normalizedQuery =
    query.trim().toLowerCase();

  const index =
    normalizedContent
      .toLowerCase()
      .indexOf(normalizedQuery);

  if (index === -1) {
    return normalizedContent.slice(
      0,
      500
    );
  }

  const start =
    Math.max(
      0,
      index - 180
    );

  const end =
    Math.min(
      normalizedContent.length,
      index +
        normalizedQuery.length +
        320
    );

  const prefix =
    start > 0 ? "…" : "";

  const suffix =
    end <
    normalizedContent.length
      ? "…"
      : "";

  return `${prefix}${normalizedContent.slice(
    start,
    end
  )}${suffix}`;
}

function escapeSearchTerm(
  value: string
) {
  return value
    .replace(/[,%()']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ==================================================
   AUTH
================================================== */

function getBearerToken(
  request: NextRequest
) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (!authorization) {
    return null;
  }

  const [scheme, token] =
    authorization.split(" ");

  if (
    scheme?.toLowerCase() !==
      "bearer" ||
    !token
  ) {
    return null;
  }

  return token.trim();
}

async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const token =
    getBearerToken(request);

  if (!token) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin.auth.getUser(
      token
    );

  if (
    error ||
    !data.user
  ) {
    return null;
  }

  return {
    id: data.user.id,
    email:
      data.user.email ?? null,
  };
}

/* ==================================================
   REQUEST PARSER
================================================== */

async function parseRequest(
  request: NextRequest
): Promise<KnowledgeSearchRequest> {
  if (
    request.method === "GET"
  ) {
    const {
      searchParams,
    } = new URL(request.url);

    return {
      query:
        searchParams.get("query") ??
        searchParams.get("q") ??
        "",
      limit:
        Number(
          searchParams.get("limit")
        ) || DEFAULT_LIMIT,
      projectId:
        searchParams.get(
          "projectId"
        ) ?? undefined,
      workspaceId:
        searchParams.get(
          "workspaceId"
        ) ?? undefined,
      teamId:
        searchParams.get(
          "teamId"
        ) ?? undefined,
      scope:
        normalizeScope(
          searchParams.get("scope")
        ),
      sourceTypes:
        searchParams
          .get("sourceTypes")
          ?.split(",")
          .map(
            (value) =>
              value.trim()
          )
          .filter(Boolean) as
          | KnowledgeSourceType[]
          | undefined,
    };
  }

  const body =
    await request.json();

  return {
    query:
      typeof body?.query ===
      "string"
        ? body.query
        : "",
    limit: body?.limit,
    projectId:
      typeof body?.projectId ===
      "string"
        ? body.projectId
        : undefined,
    workspaceId:
      typeof body?.workspaceId ===
      "string"
        ? body.workspaceId
        : undefined,
    teamId:
      typeof body?.teamId ===
      "string"
        ? body.teamId
        : undefined,
    scope:
      normalizeScope(
        body?.scope
      ),
    sourceTypes:
      normalizeSourceTypes(
        body?.sourceTypes
      ),
  };
}

/* ==================================================
   KNOWLEDGE SEARCH
================================================== */

async function searchKnowledge({
  userId,
  query,
  limit,
  projectId,
  workspaceId,
  teamId,
  scope,
  sourceTypes,
}: {
  userId: string;
  query: string;
  limit: number;
  projectId?: string;
  workspaceId?: string;
  teamId?: string;
  scope: SearchScope;
  sourceTypes: KnowledgeSourceType[];
}) {
  const safeQuery =
    escapeSearchTerm(query);

  let databaseQuery =
    supabaseAdmin
      .from("knowledge")
      .select(
        `
          id,
          user_id,
          title,
          content,
          source_type,
          source_id,
          project_id,
          workspace_id,
          team_id,
          metadata,
          created_at,
          updated_at
        `
      )
      .eq(
        "user_id",
        userId
      );

  /*
    Scope filters
  */

  if (
    scope === "personal"
  ) {
    databaseQuery =
      databaseQuery
        .is(
          "project_id",
          null
        )
        .is(
          "workspace_id",
          null
        )
        .is(
          "team_id",
          null
        );
  }

  if (
    scope === "project" &&
    projectId
  ) {
    databaseQuery =
      databaseQuery.eq(
        "project_id",
        projectId
      );
  }

  if (
    scope === "workspace" &&
    workspaceId
  ) {
    databaseQuery =
      databaseQuery.eq(
        "workspace_id",
        workspaceId
      );
  }

  if (
    scope === "team" &&
    teamId
  ) {
    databaseQuery =
      databaseQuery.eq(
        "team_id",
        teamId
      );
  }

  /*
    Optional context filters
  */

  if (
    projectId &&
    scope !== "project"
  ) {
    databaseQuery =
      databaseQuery.eq(
        "project_id",
        projectId
      );
  }

  if (
    workspaceId &&
    scope !== "workspace"
  ) {
    databaseQuery =
      databaseQuery.eq(
        "workspace_id",
        workspaceId
      );
  }

  if (
    teamId &&
    scope !== "team"
  ) {
    databaseQuery =
      databaseQuery.eq(
        "team_id",
        teamId
      );
  }

  /*
    Source type filter
  */

  if (
    sourceTypes.length > 0
  ) {
    databaseQuery =
      databaseQuery.in(
        "source_type",
        sourceTypes
      );
  }

  /*
    Full-text style fallback search.

    Supabase/PostgREST tarafında özel
    vector/RPC sistemi olmasa bile
    title + content üzerinde arama yapar.
  */

  if (safeQuery) {
    databaseQuery =
      databaseQuery.or(
        [
          `title.ilike.%${safeQuery}%`,
          `content.ilike.%${safeQuery}%`,
        ].join(",")
      );
  }

  const {
    data,
    error,
  } =
    await databaseQuery
      .order(
        "updated_at",
        {
          ascending: false,
        }
      )
      .limit(
        Math.max(
          limit * 3,
          limit
        )
      );

  if (error) {
    console.error(
      "SYRAVEN KNOWLEDGE SEARCH ERROR:",
      error
    );

    throw error;
  }

  const results:
    KnowledgeSearchResult[] =
    (data ?? [])
      .map((item) => {
        const title =
          typeof item.title ===
          "string"
            ? item.title
            : "Untitled knowledge";

        const content =
          typeof item.content ===
          "string"
            ? item.content
            : "";

        /*
          Basit relevance score.
          İleride vector search/RPC
          eklendiğinde aynı response
          formatı korunabilir.
        */

        const lowerQuery =
          safeQuery.toLowerCase();

        const lowerTitle =
          title.toLowerCase();

        const lowerContent =
          content.toLowerCase();

        let score = 0;

        if (
          lowerTitle.includes(
            lowerQuery
          )
        ) {
          score += 100;
        }

        if (
          lowerContent.includes(
            lowerQuery
          )
        ) {
          score += 25;
        }

        const occurrences =
          lowerQuery
            ? lowerContent
                .split(lowerQuery)
                .length - 1
            : 0;

        score += Math.min(
          occurrences * 5,
          50
        );

        return {
          id: item.id,
          title,
          content,
          excerpt:
            createExcerpt(
              content,
              safeQuery
            ),
          sourceType:
            (
              item.source_type ??
              "other"
            ) as KnowledgeSourceType,
          sourceId:
            item.source_id ??
            null,
          projectId:
            item.project_id ??
            null,
          workspaceId:
            item.workspace_id ??
            null,
          teamId:
            item.team_id ??
            null,
          metadata:
            item.metadata &&
            typeof item.metadata ===
              "object"
              ? item.metadata
              : {},
          score,
          createdAt:
            item.created_at ??
            null,
          updatedAt:
            item.updated_at ??
            null,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .slice(0, limit);

  return results;
}

/* ==================================================
   RESPONSE BUILDER
================================================== */

function buildResponse(
  query: string,
  results: KnowledgeSearchResult[],
  limit: number
) {
  return {
    success: true,
    query,
    count: results.length,
    limit,
    results,
    searchedAt:
      new Date().toISOString(),
  };
}

/* ==================================================
   GET
================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    const user =
      await getAuthenticatedUser(
        request
      );

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const payload =
      await parseRequest(
        request
      );

    const query =
      payload.query
        .trim()
        .slice(
          0,
          MAX_QUERY_LENGTH
        );

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A search query is required.",
        },
        {
          status: 400,
        }
      );
    }

    const limit =
      clampLimit(
        payload.limit
      );

    const results =
      await searchKnowledge({
        userId: user.id,
        query,
        limit,
        projectId:
          payload.projectId,
        workspaceId:
          payload.workspaceId,
        teamId:
          payload.teamId,
        scope:
          normalizeScope(
            payload.scope
          ),
        sourceTypes:
          normalizeSourceTypes(
            payload.sourceTypes
          ),
      });

    return NextResponse.json(
      buildResponse(
        query,
        results,
        limit
      ),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN KNOWLEDGE SEARCH GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Knowledge search failed.",
      },
      {
        status: 500,
      }
    );
  }
}

/* ==================================================
   POST
================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    const user =
      await getAuthenticatedUser(
        request
      );

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    let payload:
      KnowledgeSearchRequest;

    try {
      payload =
        await parseRequest(
          request
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const query =
      payload.query
        .trim()
        .slice(
          0,
          MAX_QUERY_LENGTH
        );

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A search query is required.",
        },
        {
          status: 400,
        }
      );
    }

    const limit =
      clampLimit(
        payload.limit
      );

    const results =
      await searchKnowledge({
        userId: user.id,
        query,
        limit,
        projectId:
          payload.projectId,
        workspaceId:
          payload.workspaceId,
        teamId:
          payload.teamId,
        scope:
          normalizeScope(
            payload.scope
          ),
        sourceTypes:
          normalizeSourceTypes(
            payload.sourceTypes
          ),
      });

    return NextResponse.json(
      buildResponse(
        query,
        results,
        limit
      ),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN KNOWLEDGE SEARCH POST ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Knowledge search failed.",
      },
      {
        status: 500,
      }
    );
  }
}