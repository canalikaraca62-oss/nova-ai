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
const MAX_EXCERPT_LENGTH = 500;

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

type KnowledgeRow = {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  source_type?: unknown;
  source_id?: unknown;
  project_id?: unknown;
  workspace_id?: unknown;
  team_id?: unknown;
  metadata?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

/* ==================================================
   CONSTANTS
================================================== */

const VALID_SOURCE_TYPES = new Set<KnowledgeSourceType>([
  "file",
  "document",
  "note",
  "message",
  "web",
  "project",
  "memory",
  "other",
]);

/* ==================================================
   TYPE GUARDS
================================================== */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function toRecord(
  value: unknown
): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  return {};
}

function toStringValue(
  value: unknown,
  fallback = ""
): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return fallback;
}

function toNullableString(
  value: unknown
): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return null;
}

function normalizeMetadata(
  value: unknown
): Record<string, unknown> {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

/* ==================================================
   NORMALIZERS
================================================== */

function normalizeScope(
  value: unknown
): SearchScope {
  switch (value) {
    case "personal":
    case "project":
    case "workspace":
    case "team":
    case "all":
      return value;

    default:
      return "all";
  }
}

function normalizeSourceType(
  value: unknown
): KnowledgeSourceType {
  if (
    typeof value === "string" &&
    VALID_SOURCE_TYPES.has(
      value as KnowledgeSourceType
    )
  ) {
    return value as KnowledgeSourceType;
  }

  return "other";
}

function normalizeSourceTypes(
  value: unknown
): KnowledgeSourceType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: KnowledgeSourceType[] = [];

  for (const item of value) {
    if (
      typeof item === "string" &&
      VALID_SOURCE_TYPES.has(
        item as KnowledgeSourceType
      )
    ) {
      result.push(
        item as KnowledgeSourceType
      );
    }
  }

  return [...new Set(result)];
}

/* ==================================================
   LIMIT
================================================== */

function clampLimit(
  value: unknown
): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  if (!Number.isFinite(parsed)) {
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

/* ==================================================
   QUERY HELPERS
================================================== */

function normalizeQuery(
  value: string
): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(
      0,
      MAX_QUERY_LENGTH
    );
}

function escapeSearchTerm(
  value: string
): string {
  return value
    .replace(/[,%()']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ==================================================
   EXCERPT
================================================== */

function createExcerpt(
  content: string,
  query: string
): string {
  const normalizedContent =
    content
      .replace(/\s+/g, " ")
      .trim();

  if (!normalizedContent) {
    return "";
  }

  const normalizedQuery =
    query
      .trim()
      .toLowerCase();

  if (!normalizedQuery) {
    return normalizedContent.slice(
      0,
      MAX_EXCERPT_LENGTH
    );
  }

  const index =
    normalizedContent
      .toLowerCase()
      .indexOf(
        normalizedQuery
      );

  if (index === -1) {
    return normalizedContent.slice(
      0,
      MAX_EXCERPT_LENGTH
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
    start > 0
      ? "…"
      : "";

  const suffix =
    end < normalizedContent.length
      ? "…"
      : "";

  return `${prefix}${normalizedContent.slice(
    start,
    end
  )}${suffix}`;
}

/* ==================================================
   AUTH
================================================== */

function getBearerToken(
  request: NextRequest
): string | null {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (!authorization) {
    return null;
  }

  const parts =
    authorization
      .trim()
      .split(/\s+/);

  if (parts.length !== 2) {
    return null;
  }

  const scheme =
    parts[0];

  const token =
    parts[1];

  if (
    typeof scheme !== "string" ||
    typeof token !== "string"
  ) {
    return null;
  }

  if (
    scheme.toLowerCase() !==
    "bearer"
  ) {
    return null;
  }

  const normalizedToken =
    token.trim();

  if (!normalizedToken) {
    return null;
  }

  return normalizedToken;
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
    const url =
      new URL(request.url);

    const sourceTypesParam =
      url.searchParams.get(
        "sourceTypes"
      );

    return {
      query:
        url.searchParams.get("query") ??
        url.searchParams.get("q") ??
        "",

      limit:
        clampLimit(
          url.searchParams.get(
            "limit"
          )
        ),

      projectId:
        url.searchParams.get(
          "projectId"
        ) ?? undefined,

      workspaceId:
        url.searchParams.get(
          "workspaceId"
        ) ?? undefined,

      teamId:
        url.searchParams.get(
          "teamId"
        ) ?? undefined,

      scope:
        normalizeScope(
          url.searchParams.get(
            "scope"
          )
        ),

      sourceTypes:
        sourceTypesParam
          ? normalizeSourceTypes(
              sourceTypesParam
                .split(",")
                .map(
                  (item) =>
                    item.trim()
                )
                .filter(Boolean)
            )
          : [],
    };
  }

  const body: unknown =
    await request.json();

  const payload =
    toRecord(body);

  return {
    query:
      toStringValue(
        payload.query
      ),

    limit:
      payload.limit === undefined
        ? undefined
        : clampLimit(
            payload.limit
          ),

    projectId:
      toNullableString(
        payload.projectId
      ) ?? undefined,

    workspaceId:
      toNullableString(
        payload.workspaceId
      ) ?? undefined,

    teamId:
      toNullableString(
        payload.teamId
      ) ?? undefined,

    scope:
      normalizeScope(
        payload.scope
      ),

    sourceTypes:
      normalizeSourceTypes(
        payload.sourceTypes
      ),
  };
}

/* ==================================================
   SEARCH SCORE
================================================== */

function calculateSearchScore(
  title: string,
  content: string,
  query: string
): number {
  const normalizedQuery =
    query
      .trim()
      .toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  const lowerTitle =
    title.toLowerCase();

  const lowerContent =
    content.toLowerCase();

  let score = 0;

  if (
    lowerTitle.includes(
      normalizedQuery
    )
  ) {
    score += 100;
  }

  if (
    lowerTitle.trim() ===
    normalizedQuery
  ) {
    score += 100;
  }

  if (
    lowerContent.includes(
      normalizedQuery
    )
  ) {
    score += 25;
  }

  const occurrences =
    lowerContent
      .split(
        normalizedQuery
      )
      .length - 1;

  score += Math.min(
    occurrences * 5,
    50
  );

  return score;
}

/* ==================================================
   ROW NORMALIZATION
================================================== */

function normalizeKnowledgeRow(
  value: unknown,
  query: string
): KnowledgeSearchResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const row =
    value as KnowledgeRow;

  const id =
    toStringValue(
      row.id
    ).trim();

  if (!id) {
    return null;
  }

  const title =
    toStringValue(
      row.title
    ).trim() ||
    "Untitled knowledge";

  const content =
    toStringValue(
      row.content
    );

  const sourceType =
    normalizeSourceType(
      row.source_type
    );

  return {
    id,
    title,
    content,

    excerpt:
      createExcerpt(
        content,
        query
      ),

    sourceType,

    sourceId:
      toNullableString(
        row.source_id
      ),

    projectId:
      toNullableString(
        row.project_id
      ),

    workspaceId:
      toNullableString(
        row.workspace_id
      ),

    teamId:
      toNullableString(
        row.team_id
      ),

    metadata:
      normalizeMetadata(
        row.metadata
      ),

    score:
      calculateSearchScore(
        title,
        content,
        query
      ),

    createdAt:
      toNullableString(
        row.created_at
      ),

    updatedAt:
      toNullableString(
        row.updated_at
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
}): Promise<KnowledgeSearchResult[]> {
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

  /* ================================================
     SCOPE FILTERS
  ================================================= */

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

  /* ================================================
     OPTIONAL CONTEXT FILTERS
  ================================================= */

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

  /* ================================================
     SOURCE TYPE FILTER
  ================================================= */

  if (
    sourceTypes.length > 0
  ) {
    databaseQuery =
      databaseQuery.in(
        "source_type",
        sourceTypes
      );
  }

  /* ================================================
     TEXT SEARCH
  ================================================= */

  if (safeQuery) {
    databaseQuery =
      databaseQuery.or(
        [
          `title.ilike.%${safeQuery}%`,
          `content.ilike.%${safeQuery}%`,
        ].join(",")
      );
  }

  const fetchLimit =
    Math.min(
      Math.max(
        limit * 3,
        limit
      ),
      MAX_LIMIT * 3
    );

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
        fetchLimit
      );

  if (error) {
    console.error(
      "SYRAVEN KNOWLEDGE SEARCH ERROR:",
      error
    );

    throw error;
  }

  const results =
    (data ?? [])
      .map(
        (item) =>
          normalizeKnowledgeRow(
            item,
            safeQuery
          )
      )
      .filter(
        (
          item
        ): item is KnowledgeSearchResult =>
          item !== null
      )
      .sort(
        (a, b) => {
          const scoreDifference =
            b.score - a.score;

          if (
            scoreDifference !== 0
          ) {
            return scoreDifference;
          }

          const aTime =
            a.updatedAt
              ? Date.parse(
                  a.updatedAt
                )
              : 0;

          const bTime =
            b.updatedAt
              ? Date.parse(
                  b.updatedAt
                )
              : 0;

          return bTime - aTime;
        }
      )
      .slice(
        0,
        limit
      );

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
   COMMON SEARCH HANDLER
================================================== */

async function handleSearch(
  request: NextRequest
) {
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
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  const payload =
    await parseRequest(
      request
    );

  const query =
    normalizeQuery(
      payload.query
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
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  const limit =
    clampLimit(
      payload.limit
    );

  const results =
    await searchKnowledge({
      userId:
        user.id,

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
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

/* ==================================================
   GET
================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    return await handleSearch(
      request
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
    return await handleSearch(
      request
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

/* ==================================================
   METHOD NOT ALLOWED
================================================== */

function methodNotAllowed() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Method not allowed.",
    },
    {
      status: 405,
      headers: {
        Allow: "GET, POST",
        "Cache-Control":
          "no-store",
      },
    }
  );
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}