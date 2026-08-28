import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==================================================
   SYRAVEN GLOBAL SEARCH API

   Searches:
   - Chats
   - Projects
   - Agents
   - Knowledge

   Designed as the central search layer so future
   resources can be added without changing clients.
================================================== */

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 200;

/* ==================================================
   TYPES
================================================== */

type SearchType =
  | "all"
  | "chats"
  | "projects"
  | "agents"
  | "knowledge";

type SearchResult = {
  id: string;
  type: Exclude<SearchType, "all">;
  title: string;
  description: string | null;
  href: string;
  metadata: Record<string, unknown>;
  updatedAt: string | null;
};

type SearchResponse = {
  success: boolean;
  query: string;
  results: SearchResult[];
  counts: {
    chats: number;
    projects: number;
    agents: number;
    knowledge: number;
    total: number;
  };
};

/* ==================================================
   HELPERS
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
      status
    }
  );
}

function normalizeLimit(
  value: string | null
) {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.floor(parsed),
    MAX_LIMIT
  );
}

function normalizeSearchType(
  value: string | null
): SearchType {
  switch (value) {
    case "chats":
    case "projects":
    case "agents":
    case "knowledge":
      return value;

    default:
      return "all";
  }
}

/*
  PostgREST .or() filter protection.

  Prevents special filter syntax from changing
  the intended search expression.
*/
function sanitizeSearchQuery(
  value: string
) {
  return value
    .replace(/[(),]/g, " ")
    .replace(/\./g, " ")
    .replace(/[%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(
      0,
      MAX_QUERY_LENGTH
    );
}

function normalizeDescription(
  value: unknown,
  maxLength = 500
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const text =
    value.trim();

  if (!text) {
    return null;
  }

  return text.slice(
    0,
    maxLength
  );
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return String(error);
}

/* ==================================================
   SEARCH CHATS
================================================== */

async function searchChats(
  userId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("chats")
        .select(`
          id,
          title,
          created_at,
          updated_at
        `)
        .eq(
          "user_id",
          userId
        )
        .ilike(
          "title",
          `%${query}%`
        )
        .order(
          "updated_at",
          {
            ascending: false,
          }
        )
        .limit(limit);

    if (error) {
      console.error(
        "SYRAVEN SEARCH CHATS ERROR:",
        error
      );

      return [];
    }

    return (
      data ?? []
    ).map(
      (
        chat
      ): SearchResult => ({
        id: String(chat.id),

        type: "chats",

        title:
          normalizeDescription(
            chat.title,
            500
          ) ??
          "Untitled chat",

        description:
          "SYRAVEN conversation",

        href:
          `/chat/${chat.id}`,

        metadata: {
          createdAt:
            chat.created_at ??
            null,
        },

        updatedAt:
          chat.updated_at ??
          null,
      })
    );
  } catch (error) {
    console.error(
      "SYRAVEN SEARCH CHATS FAILED:",
      getErrorMessage(error)
    );

    return [];
  }
}

/* ==================================================
   SEARCH PROJECTS
================================================== */

async function searchProjects(
  userId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("projects")
        .select(`
          id,
          name,
          description,
          status,
          priority,
          workspace_id,
          created_at,
          updated_at
        `)
        .eq(
          "user_id",
          userId
        )
        .or(
          `name.ilike.%${query}%,description.ilike.%${query}%`
        )
        .order(
          "updated_at",
          {
            ascending: false,
          }
        )
        .limit(limit);

    if (error) {
      console.error(
        "SYRAVEN SEARCH PROJECTS ERROR:",
        error
      );

      return [];
    }

    return (
      data ?? []
    ).map(
      (
        project
      ): SearchResult => ({
        id: String(
          project.id
        ),

        type: "projects",

        title:
          normalizeDescription(
            project.name,
            500
          ) ??
          "Untitled project",

        description:
          normalizeDescription(
            project.description
          ),

        href:
          `/projects/${project.id}`,

        metadata: {
          status:
            project.status ??
            "planning",

          priority:
            project.priority ??
            "normal",

          workspaceId:
            project.workspace_id ??
            null,

          createdAt:
            project.created_at ??
            null,
        },

        updatedAt:
          project.updated_at ??
          null,
      })
    );
  } catch (error) {
    console.error(
      "SYRAVEN SEARCH PROJECTS FAILED:",
      getErrorMessage(error)
    );

    return [];
  }
}

/* ==================================================
   SEARCH AGENTS
================================================== */

async function searchAgents(
  userId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("agents")
        .select(`
          id,
          name,
          description,
          category,
          status,
          created_at,
          updated_at
        `)
        .eq(
          "user_id",
          userId
        )
        .or(
          `name.ilike.%${query}%,description.ilike.%${query}%`
        )
        .order(
          "updated_at",
          {
            ascending: false,
          }
        )
        .limit(limit);

    if (error) {
      console.error(
        "SYRAVEN SEARCH AGENTS ERROR:",
        error
      );

      return [];
    }

    return (
      data ?? []
    ).map(
      (
        agent
      ): SearchResult => ({
        id: String(
          agent.id
        ),

        type: "agents",

        title:
          normalizeDescription(
            agent.name,
            500
          ) ??
          "Unnamed agent",

        description:
          normalizeDescription(
            agent.description
          ),

        href:
          `/agents/${agent.id}`,

        metadata: {
          category:
            agent.category ??
            null,

          status:
            agent.status ??
            "active",

          createdAt:
            agent.created_at ??
            null,
        },

        updatedAt:
          agent.updated_at ??
          null,
      })
    );
  } catch (error) {
    console.error(
      "SYRAVEN SEARCH AGENTS FAILED:",
      getErrorMessage(error)
    );

    return [];
  }
}

/* ==================================================
   SEARCH KNOWLEDGE
================================================== */

async function searchKnowledge(
  userId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("knowledge")
        .select(`
          id,
          title,
          content,
          type,
          created_at,
          updated_at
        `)
        .eq(
          "user_id",
          userId
        )
        .or(
          `title.ilike.%${query}%,content.ilike.%${query}%`
        )
        .order(
          "updated_at",
          {
            ascending: false,
          }
        )
        .limit(limit);

    if (error) {
      console.error(
        "SYRAVEN SEARCH KNOWLEDGE ERROR:",
        error
      );

      return [];
    }

    return (
      data ?? []
    ).map(
      (
        item
      ): SearchResult => ({
        id: String(
          item.id
        ),

        type: "knowledge",

        title:
          normalizeDescription(
            item.title,
            500
          ) ??
          "Untitled knowledge",

        description:
          normalizeDescription(
            item.content,
            500
          ),

        href:
          `/knowledge?id=${item.id}`,

        metadata: {
          knowledgeType:
            item.type ??
            "document",

          createdAt:
            item.created_at ??
            null,
        },

        updatedAt:
          item.updated_at ??
          null,
      })
    );
  } catch (error) {
    console.error(
      "SYRAVEN SEARCH KNOWLEDGE FAILED:",
      getErrorMessage(error)
    );

    return [];
  }
}

/* ==================================================
   GET GLOBAL SEARCH
================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    const {
      searchParams,
    } =
      new URL(
        request.url
      );

    const userId =
      searchParams
        .get("userId")
        ?.trim()
        .slice(
          0,
          200
        );

    const rawQuery =
      searchParams.get("q") ??
      searchParams.get("query") ??
      "";

    const query =
      sanitizeSearchQuery(
        rawQuery
      );

    const type =
      normalizeSearchType(
        searchParams.get("type")
      );

    const limit =
      normalizeLimit(
        searchParams.get("limit")
      );

    if (!userId) {
      return jsonError(
        "userId is required.",
        400
      );
    }

    if (
      query.length < 2
    ) {
      return jsonError(
        "Search query must contain at least 2 characters.",
        400
      );
    }

    /*
      Each source receives the same per-source
      limit. The response is then globally sorted.
    */

    const [
      chats,
      projects,
      agents,
      knowledge,
    ] =
      await Promise.all([
        type === "all" ||
        type === "chats"
          ? searchChats(
              userId,
              query,
              limit
            )
          : Promise.resolve(
              []
            ),

        type === "all" ||
        type === "projects"
          ? searchProjects(
              userId,
              query,
              limit
            )
          : Promise.resolve(
              []
            ),

        type === "all" ||
        type === "agents"
          ? searchAgents(
              userId,
              query,
              limit
            )
          : Promise.resolve(
              []
            ),

        type === "all" ||
        type === "knowledge"
          ? searchKnowledge(
              userId,
              query,
              limit
            )
          : Promise.resolve(
              []
            ),
      ]);

    const results =
      [
        ...chats,
        ...projects,
        ...agents,
        ...knowledge,
      ]
        .sort(
          (
            a,
            b
          ) => {
            const aTime =
              a.updatedAt
                ? new Date(
                    a.updatedAt
                  ).getTime()
                : 0;

            const bTime =
              b.updatedAt
                ? new Date(
                    b.updatedAt
                  ).getTime()
                : 0;

            return (
              bTime -
              aTime
            );
          }
        )
        .slice(
          0,
          limit
        );

    const response: SearchResponse =
      {
        success: true,

        query,

        results,

        counts: {
          chats:
            chats.length,

          projects:
            projects.length,

          agents:
            agents.length,

          knowledge:
            knowledge.length,

          total:
            results.length,
        },
      };

    return NextResponse.json(
      response,
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "SYRAVEN GLOBAL SEARCH ERROR:",
      error
    );

    return jsonError(
      "Global search failed.",
      500
    );
  }
}