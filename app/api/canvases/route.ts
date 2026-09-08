import { NextResponse, type NextRequest } from "next/server";

import { withAuth } from "@/lib/api/withAuth";
import type { AuthenticatedSession } from "@/lib/auth/session";
import { requireOptionalWorkspaceAccess } from "@/lib/api/tenantGuard";
import type { Database, Json } from "@/types/database";

/*
  SYRAVEN — Canvas persistence

  WHY THIS ROUTE EXISTS

  Canvas is a reachable feature — linked from the desktop sidebar, the
  mobile nav, the command palette, universal search and /apps — with a
  full editor, a Save button and a 1.2s debounced autosave. None of it
  persisted.

  The editor sent PATCH /api/canvas, which exports only POST and GET, so
  Next.js answered 405; the autosave runs with `silent = true`, so every
  failure was invisible. That route's GET ignored `?id=` and returned a
  static service-status blob, so every canvas opened empty. A user could
  draw a diagram, watch it report saved, and lose the work on
  navigation.

  WHY IT IS A SEPARATE ROUTE

  /api/canvas is an AI GENERATION endpoint: it enforces usage quota and
  calls a provider. Persistence has none of those concerns — saving a
  diagram must not consume AI quota — so folding them together would
  make every autosave a metered, billable event.

  AUTHORIZATION

  Session-scoped through `withAuth`, on the caller's RLS client. The
  canvases policies are owner-scoped (auth.uid() = user_id), so the
  database is the boundary. This route never uses the service-role
  client and never takes ownership from the request.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                  CONTRACT                                  */
/* -------------------------------------------------------------------------- */

const LIMITS = {
  maxTitle: 200,
  maxDescription: 2000,
  /* These bound a single document, not a user. */
  maxNodes: 500,
  maxEdges: 1000,
  maxList: 100,
  /* Serialized ceiling, so one request cannot fill a row. */
  maxDocumentBytes: 512_000,
} as const;

type CanvasUpdate =
  Database["public"]["Tables"]["canvases"]["Update"];

const CANVAS_SELECT =
  "id, user_id, workspace_id, title, description, nodes, edges, created_at, updated_at";

function fail(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status });
}

/** Trims and length-caps caller text. Returns null when absent or empty. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (trimmed.length === 0) return null;

  return trimmed.slice(0, max);
}

/**
 * Validates the node and edge arrays.
 *
 * They are stored as jsonb, so Postgres accepts anything that parses.
 * That makes this the only place bounds can be enforced: without it a
 * caller could store an unbounded document.
 */
/**
 * Accepts a caller-supplied canvas id, but only a well-formed UUID.
 *
 * The editor addresses a canvas by the id in its URL. If the server
 * minted a different id on create, every save would PATCH an id that
 * does not exist, fall through to POST, and create ANOTHER row --
 * observed in production as two orphan rows from a single session,
 * with the reload still 404ing.
 *
 * This is not an ownership claim: user_id still comes from the
 * session, and canvases_insert_own rejects any row that is not the
 * caller's. The worst a hostile id achieves is colliding with the
 * caller's own primary key, which Postgres refuses.
 */
function parseId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    trimmed,
  )
    ? trimmed
    : null;
}

function parseDocument(
  body: Record<string, unknown>,
):
  | { ok: true; nodes: Json[]; edges: Json[] }
  | { ok: false; reason: string } {
  const { nodes, edges } = body;

  if (nodes !== undefined && !Array.isArray(nodes)) {
    return { ok: false, reason: "nodes must be an array." };
  }

  if (edges !== undefined && !Array.isArray(edges)) {
    return { ok: false, reason: "edges must be an array." };
  }

  const nodeList: Json[] = Array.isArray(nodes) ? (nodes as Json[]) : [];
  const edgeList: Json[] = Array.isArray(edges) ? (edges as Json[]) : [];

  if (nodeList.length > LIMITS.maxNodes) {
    return {
      ok: false,
      reason: `A canvas may hold at most ${LIMITS.maxNodes} nodes.`,
    };
  }

  if (edgeList.length > LIMITS.maxEdges) {
    return {
      ok: false,
      reason: `A canvas may hold at most ${LIMITS.maxEdges} edges.`,
    };
  }

  const size = JSON.stringify({ nodes: nodeList, edges: edgeList }).length;

  if (size > LIMITS.maxDocumentBytes) {
    return { ok: false, reason: "This canvas is too large to save." };
  }

  return { ok: true, nodes: nodeList, edges: edgeList };
}

/* -------------------------------------------------------------------------- */
/*                                    GET                                     */
/* -------------------------------------------------------------------------- */

/**
 * Reads one canvas by id, or lists the caller's canvases.
 *
 * No ownership filter is written here: `canvases_select_own` is the
 * boundary. Columns are explicit rather than `*`, so a later migration
 * cannot silently start returning new fields.
 */
export const GET = withAuth(
  async (request: NextRequest, session: AuthenticatedSession) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    let query = session.supabase
      .from("canvases")
      .select(CANVAS_SELECT)
      .order("updated_at", { ascending: false })
      .limit(LIMITS.maxList);

    if (id) query = query.eq("id", id);

    const { data, error } = await query;

    if (error) {
      console.error("SYRAVEN CANVASES: read failed.", {
        userId: session.userId,
        error: error.message,
      });

      return fail(503, "Canvases are temporarily unavailable.");
    }

    const rows = data ?? [];

    if (id) {
      const canvas = rows[0];

      /*
       * A canvas belonging to someone else is filtered out by RLS and is
       * indistinguishable from one that does not exist. Answering 404
       * for both is what keeps ids non-enumerable.
       */
      if (!canvas) return fail(404, "This canvas could not be found.");

      return NextResponse.json({ success: true, canvas }, { status: 200 });
    }

    return NextResponse.json(
      { success: true, canvases: rows },
      { status: 200 },
    );
  },
);

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

/** Creates a canvas owned by the caller. */
export const POST = withAuth(
  async (request: NextRequest, session: AuthenticatedSession) => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail(400, "A valid request body is required.");
    }

    if (typeof body !== "object" || body === null) {
      return fail(400, "A JSON object is required.");
    }

    const record = body as Record<string, unknown>;

    const document = parseDocument(record);

    if (!document.ok) return fail(400, document.reason);

    const workspaceId = text(record.workspaceId, 200);

    /*
     * A body-supplied workspace id is a tenant claim, so it is checked
     * rather than trusted — the same omission that let project and
     * knowledge rows be planted in another tenant's workspace.
     */
    const workspaceGuard = await requireOptionalWorkspaceAccess(
      session,
      workspaceId,
    );

    if (workspaceGuard?.denied) return workspaceGuard.response;

    const { data, error } = await session.supabase
      .from("canvases")
      .insert({
        /* Server-derived. Never from the request body. */
        /*
          The editor's URL id, when it supplied one, so a later save
          addresses the row it just created.
        */
        ...(parseId(record.id) ? { id: parseId(record.id) as string } : {}),
        user_id: session.userId,
        workspace_id: workspaceId,
        title:
          text(record.name ?? record.title, LIMITS.maxTitle) ??
          "Untitled Canvas",
        description: text(record.description, LIMITS.maxDescription),
        nodes: document.nodes,
        edges: document.edges,
      })
      .select(CANVAS_SELECT)
      .maybeSingle();

    if (error || !data) {
      console.error("SYRAVEN CANVASES: create failed.", {
        userId: session.userId,
        error: error?.message ?? "no row returned",
      });

      return fail(503, "The canvas could not be created.");
    }

    return NextResponse.json({ success: true, canvas: data }, { status: 201 });
  },
);

/* -------------------------------------------------------------------------- */
/*                                   PATCH                                    */
/* -------------------------------------------------------------------------- */

/**
 * Saves a canvas. This is the autosave path.
 *
 * Only fields the request actually carries are written, so a partial
 * save cannot blank the rest of the document.
 */
export const PATCH = withAuth(
  async (request: NextRequest, session: AuthenticatedSession) => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail(400, "A valid request body is required.");
    }

    if (typeof body !== "object" || body === null) {
      return fail(400, "A JSON object is required.");
    }

    const record = body as Record<string, unknown>;
    const id = text(record.id, 200);

    if (!id) return fail(400, "A canvas id is required.");

    const document = parseDocument(record);

    if (!document.ok) return fail(400, document.reason);

    /*
      Typed against the generated schema. A Record<string, unknown>
      is rejected by the client's excess-property check, and would
      also let a typo through as a silently ignored column.
    */
    const update: CanvasUpdate = {};

    const title = text(record.name ?? record.title, LIMITS.maxTitle);

    if (title !== null) update.title = title;

    if (record.description !== undefined) {
      update.description = text(record.description, LIMITS.maxDescription);
    }

    if (record.nodes !== undefined) update.nodes = document.nodes;
    if (record.edges !== undefined) update.edges = document.edges;

    if (Object.keys(update).length === 0) {
      return fail(400, "No changes were supplied.");
    }

    /*
     * `id` alone is enough: canvases_update_own restricts the row set to
     * the caller's own canvases, so this cannot reach another user's row
     * even with a guessed id.
     */
    const { data, error } = await session.supabase
      .from("canvases")
      .update(update)
      .eq("id", id)
      .select(CANVAS_SELECT)
      .maybeSingle();

    if (error) {
      console.error("SYRAVEN CANVASES: save failed.", {
        userId: session.userId,
        error: error.message,
      });

      return fail(503, "The canvas could not be saved.");
    }

    /* No row means RLS matched nothing: not the caller's canvas. */
    if (!data) return fail(404, "This canvas could not be found.");

    return NextResponse.json({ success: true, canvas: data }, { status: 200 });
  },
);

/* -------------------------------------------------------------------------- */
/*                                   DELETE                                   */
/* -------------------------------------------------------------------------- */

export const DELETE = withAuth(
  async (request: NextRequest, session: AuthenticatedSession) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return fail(400, "A canvas id is required.");

    const { data, error } = await session.supabase
      .from("canvases")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("SYRAVEN CANVASES: delete failed.", {
        userId: session.userId,
        error: error.message,
      });

      return fail(503, "The canvas could not be deleted.");
    }

    if (!data) return fail(404, "This canvas could not be found.");

    return NextResponse.json({ success: true }, { status: 200 });
  },
);
