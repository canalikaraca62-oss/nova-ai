import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ==================================================
   SYRAVEN USAGE API
   app/api/usage/route.ts
================================================== */

type SyravenPlan =
  | "free"
  | "premium"
  | "pro"
  | "business"
  | "enterprise";

type UsageLimits = {
  requests: number | null;
  messages: number | null;
  agents: number | null;
  projects: number | null;
  storageBytes: number | null;
};

type UsageSnapshot = {
  requests: number;
  messages: number;
  agents: number;
  projects: number;
  storageBytes: number;
};

/* ==================================================
   PLAN LIMITS
================================================== */

const PLAN_LIMITS: Record<
  SyravenPlan,
  UsageLimits
> = {
  free: {
    requests: 1_000,
    messages: 500,
    agents: 3,
    projects: 5,
    storageBytes:
      1 * 1024 * 1024 * 1024,
  },

  premium: {
    requests: 10_000,
    messages: 5_000,
    agents: 25,
    projects: 50,
    storageBytes:
      10 * 1024 * 1024 * 1024,
  },

  pro: {
    requests: 100_000,
    messages: 50_000,
    agents: 250,
    projects: 500,
    storageBytes:
      100 * 1024 * 1024 * 1024,
  },

  business: {
    requests: 1_000_000,
    messages: 500_000,
    agents: 2_500,
    projects: 5_000,
    storageBytes:
      1024 * 1024 * 1024 * 1024,
  },

  enterprise: {
    requests: null,
    messages: null,
    agents: null,
    projects: null,
    storageBytes: null,
  },
};

/* ==================================================
   HELPERS
================================================== */

function isPlan(
  value: unknown
): value is SyravenPlan {
  return (
    value === "free" ||
    value === "premium" ||
    value === "pro" ||
    value === "business" ||
    value === "enterprise"
  );
}

function normalizePlan(
  value: unknown
): SyravenPlan {
  if (typeof value !== "string") {
    return "free";
  }

  const plan =
    value.trim().toLowerCase();

  if (isPlan(plan)) {
    return plan;
  }

  if (
    plan === "plus"
  ) {
    return "premium";
  }

  if (
    plan === "vip"
  ) {
    return "pro";
  }

  return "free";
}

function getUserId(
  request: NextRequest
): string | null {
  const headerUserId =
    request.headers.get(
      "x-user-id"
    );

  if (
    headerUserId &&
    headerUserId.trim()
  ) {
    return headerUserId.trim();
  }

  const searchParams =
    request.nextUrl.searchParams;

  const queryUserId =
    searchParams.get(
      "userId"
    );

  if (
    queryUserId &&
    queryUserId.trim()
  ) {
    return queryUserId.trim();
  }

  return null;
}

function getMonthKey(
  date = new Date()
) {
  return date
    .toISOString()
    .slice(0, 7);
}

function getPeriodRange() {
  const now = new Date();

  const start =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1,
        0,
        0,
        0,
        0
      )
    );

  const end =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        1,
        0,
        0,
        0,
        0
      )
    );

  return {
    start:
      start.toISOString(),
    end:
      end.toISOString(),
  };
}

function calculatePercentage(
  used: number,
  limit: number | null
) {
  if (
    limit === null
  ) {
    return null;
  }

  if (
    limit <= 0
  ) {
    return 100;
  }

  return Math.min(
    100,
    Math.round(
      (used / limit) * 10000
    ) / 100
  );
}

function getRemaining(
  used: number,
  limit: number | null
) {
  if (
    limit === null
  ) {
    return null;
  }

  return Math.max(
    0,
    limit - used
  );
}

function getUsageStatus(
  percentage: number | null
):
  | "unlimited"
  | "healthy"
  | "warning"
  | "critical"
  | "exceeded" {
  if (
    percentage === null
  ) {
    return "unlimited";
  }

  if (
    percentage >= 100
  ) {
    return "exceeded";
  }

  if (
    percentage >= 90
  ) {
    return "critical";
  }

  if (
    percentage >= 75
  ) {
    return "warning";
  }

  return "healthy";
}

function buildMetric(
  used: number,
  limit: number | null
) {
  const percentage =
    calculatePercentage(
      used,
      limit
    );

  return {
    used,
    limit,
    remaining:
      getRemaining(
        used,
        limit
      ),
    percentage,
    status:
      getUsageStatus(
        percentage
      ),
  };
}

function json(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    {
      success:
        status >= 200 &&
        status < 300,
      ...data,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
        Pragma:
          "no-cache",
        Expires:
          "0",
      },
    }
  );
}

/* ==================================================
   PROFILE
================================================== */

async function getProfile(
  userId: string
) {
  const { data, error } =
    await supabaseAdmin
      .from("profiles")
      .select(
        `
        id,
        plan,
        subscription_status
        `
      )
      .eq(
        "id",
        userId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/* ==================================================
   USAGE RECORD
================================================== */

async function getUsageRecord(
  userId: string,
  monthKey: string
) {
  const { data, error } =
    await supabaseAdmin
      .from("usage")
      .select("*")
      .eq(
        "user_id",
        userId
      )
      .eq(
        "period",
        monthKey
      )
      .maybeSingle();

  if (error) {
    /*
      Tablo henüz oluşturulmamışsa
      Supabase hatasını sessizce fallback'e
      çevirmiyoruz. Böylece gerçek hata
      development sırasında görünür.
    */
    throw error;
  }

  return data;
}

/* ==================================================
   CREATE EMPTY SNAPSHOT
================================================== */

function createUsageSnapshot(
  usage: Record<
    string,
    unknown
  > | null
): UsageSnapshot {
  return {
    requests:
      typeof usage?.requests ===
      "number"
        ? usage.requests
        : 0,

    messages:
      typeof usage?.messages ===
      "number"
        ? usage.messages
        : 0,

    agents:
      typeof usage?.agents ===
      "number"
        ? usage.agents
        : 0,

    projects:
      typeof usage?.projects ===
      "number"
        ? usage.projects
        : 0,

    storageBytes:
      typeof usage?.storage_bytes ===
      "number"
        ? usage.storage_bytes
        : 0,
  };
}

/* ==================================================
   GET USAGE
================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    const userId =
      getUserId(request);

    if (!userId) {
      return json(
        {
          error: {
            code:
              "UNAUTHORIZED",
            message:
              "A valid user ID is required.",
          },
        },
        401
      );
    }

    const monthKey =
      request.nextUrl.searchParams.get(
        "period"
      ) ??
      getMonthKey();

    const [
      profile,
      usageRecord,
    ] =
      await Promise.all([
        getProfile(userId),
        getUsageRecord(
          userId,
          monthKey
        ),
      ]);

    if (!profile) {
      return json(
        {
          error: {
            code:
              "PROFILE_NOT_FOUND",
            message:
              "User profile was not found.",
          },
        },
        404
      );
    }

    const plan =
      normalizePlan(
        profile.plan
      );

    const limits =
      PLAN_LIMITS[plan];

    const usage =
      createUsageSnapshot(
        usageRecord as Record<
          string,
          unknown
        > | null
      );

    const period =
      getPeriodRange();

    const metrics = {
      requests:
        buildMetric(
          usage.requests,
          limits.requests
        ),

      messages:
        buildMetric(
          usage.messages,
          limits.messages
        ),

      agents:
        buildMetric(
          usage.agents,
          limits.agents
        ),

      projects:
        buildMetric(
          usage.projects,
          limits.projects
        ),

      storage:
        buildMetric(
          usage.storageBytes,
          limits.storageBytes
        ),
    };

    return json({
      userId,
      plan,
      subscriptionStatus:
        profile.subscription_status ??
        null,

      period: {
        key:
          monthKey,
        startsAt:
          period.start,
        endsAt:
          period.end,
      },

      usage: metrics,

      summary: {
        totalRequests:
          usage.requests,

        totalMessages:
          usage.messages,

        totalAgents:
          usage.agents,

        totalProjects:
          usage.projects,

        totalStorageBytes:
          usage.storageBytes,
      },

      limits,

      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "SYRAVEN USAGE GET ERROR:",
      error
    );

    return json(
      {
        error: {
          code:
            "USAGE_FETCH_FAILED",
          message:
            "Failed to retrieve usage information.",
        },
      },
      500
    );
  }
}

/* ==================================================
   METHOD NOT ALLOWED
================================================== */

export async function POST() {
  return json(
    {
      error: {
        code:
          "METHOD_NOT_ALLOWED",
        message:
          "POST is not supported on this endpoint.",
      },
    },
    405
  );
}

export async function PUT() {
  return json(
    {
      error: {
        code:
          "METHOD_NOT_ALLOWED",
        message:
          "PUT is not supported on this endpoint.",
      },
    },
    405
  );
}

export async function PATCH() {
  return json(
    {
      error: {
        code:
          "METHOD_NOT_ALLOWED",
        message:
          "PATCH is not supported on this endpoint.",
      },
    },
    405
  );
}

export async function DELETE() {
  return json(
    {
      error: {
        code:
          "METHOD_NOT_ALLOWED",
        message:
          "DELETE is not supported on this endpoint.",
      },
    },
    405
  );
}