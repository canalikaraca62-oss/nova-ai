import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ==================================================
   SYRAVEN USAGE API
   app/api/usage/route.ts

   Production-grade usage endpoint.

   IMPORTANT DATABASE COMPATIBILITY

   Current typed usage table schema:

   usage:
   - id
   - user_id
   - type
   - metadata
   - created_at

   Usage metrics are extracted safely from metadata.

   Security:
   - User identity comes ONLY from verified
     Supabase Bearer authentication.
   - Never trusts x-user-id.
   - Never trusts query-string userId.

   Features:
   - Monthly periods
   - Historical period support
   - Future period protection
   - Safe metadata parsing
   - Multiple usage record aggregation
   - Unlimited enterprise limits
   - Strict authentication
   - No-cache responses
================================================== */

/* ==================================================
   TYPES
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

type UsageMetricStatus =
  | "unlimited"
  | "healthy"
  | "warning"
  | "critical"
  | "exceeded";

type UsageMetric = {
  used: number;
  limit: number | null;
  remaining: number | null;
  percentage: number | null;
  status: UsageMetricStatus;
};

type AuthSuccess = {
  success: true;
  userId: string;
};

type AuthFailure = {
  success: false;
  error: string;
  code:
    | "MISSING_AUTHORIZATION"
    | "INVALID_AUTHORIZATION"
    | "UNAUTHORIZED";
};

type AuthResult =
  | AuthSuccess
  | AuthFailure;

type ProfileRecord = {
  id: string;
  plan: string | null;
  subscription_status: string | null;
};

type UsageMetadata = {
  period?: unknown;

  requests?: unknown;
  messages?: unknown;
  agents?: unknown;
  projects?: unknown;

  storage_bytes?: unknown;
  storageBytes?: unknown;

  request_count?: unknown;
  message_count?: unknown;
  agent_count?: unknown;
  project_count?: unknown;

  bytes?: unknown;
};

type UsageRecord = {
  id: string;
  user_id: string;
  type: string | null;
  metadata: UsageMetadata | null;
  created_at: string | null;
};

type PeriodRange = {
  key: string;
  startsAt: string;
  endsAt: string;
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
      1 * 1024 * 1024 * 1024 * 1024,
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
   RESPONSE HELPERS
================================================== */

function jsonResponse(
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
          "private, no-store, no-cache, must-revalidate, max-age=0",

        Pragma:
          "no-cache",

        Expires:
          "0",

        Vary:
          "Authorization",
      },
    }
  );
}

function errorResponse(
  code: string,
  message: string,
  status: number
) {
  return jsonResponse(
    {
      error: {
        code,
        message,
      },
    },
    status
  );
}

/* ==================================================
   AUTHENTICATION
================================================== */

async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthResult> {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (!authorization) {
    return {
      success: false,
      error:
        "Authorization header is required.",
      code:
        "MISSING_AUTHORIZATION",
    };
  }

  const normalized =
    authorization.trim();

  if (!normalized) {
    return {
      success: false,
      error:
        "Authorization header is invalid.",
      code:
        "INVALID_AUTHORIZATION",
    };
  }

  if (
    !/^Bearer\s+/i.test(
      normalized
    )
  ) {
    return {
      success: false,
      error:
        "Authorization header must use Bearer authentication.",
      code:
        "INVALID_AUTHORIZATION",
    };
  }

  const token =
    normalized.replace(
      /^Bearer\s+/i,
      ""
    ).trim();

  if (!token) {
    return {
      success: false,
      error:
        "Access token is missing.",
      code:
        "INVALID_AUTHORIZATION",
    };
  }

  try {
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
      return {
        success: false,
        error:
          "Authentication failed.",
        code:
          "UNAUTHORIZED",
      };
    }

    return {
      success: true,
      userId:
        data.user.id,
    };
  } catch (
    error
  ) {
    console.error(
      "SYRAVEN USAGE AUTH ERROR:",
      error
    );

    return {
      success: false,
      error:
        "Authentication failed.",
      code:
        "UNAUTHORIZED",
    };
  }
}

/* ==================================================
   PLAN HELPERS
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
  if (
    typeof value !== "string"
  ) {
    return "free";
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    isPlan(
      normalized
    )
  ) {
    return normalized;
  }

  switch (
    normalized
  ) {
    case "plus":
      return "premium";

    case "vip":
      return "pro";

    case "team":
      return "business";

    case "corporate":
      return "business";

    case "unlimited":
      return "enterprise";

    default:
      return "free";
  }
}

/* ==================================================
   PERIOD HELPERS
================================================== */

const PERIOD_REGEX =
  /^\d{4}-(0[1-9]|1[0-2])$/;

function getCurrentMonthKey(
  date = new Date()
): string {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}`;
}

function isValidPeriod(
  value: string
): boolean {
  return PERIOD_REGEX.test(
    value
  );
}

function isFuturePeriod(
  period: string
): boolean {
  return (
    period >
    getCurrentMonthKey()
  );
}

function getPeriodRange(
  period: string
): PeriodRange {
  const [
    yearString,
    monthString,
  ] =
    period.split(
      "-"
    );

  const year =
    Number(
      yearString
    );

  const monthIndex =
    Number(
      monthString
    ) - 1;

  const start =
    new Date(
      Date.UTC(
        year,
        monthIndex,
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
        year,
        monthIndex + 1,
        1,
        0,
        0,
        0,
        0
      )
    );

  return {
    key:
      period,

    startsAt:
      start.toISOString(),

    endsAt:
      end.toISOString(),
  };
}

function resolveRequestedPeriod(
  request: NextRequest
):
  | {
      success: true;
      period: string;
    }
  | {
      success: false;
      error: string;
      code: string;
    } {
  const requested =
    request.nextUrl.searchParams.get(
      "period"
    );

  if (
    requested === null ||
    requested.trim() === ""
  ) {
    return {
      success: true,
      period:
        getCurrentMonthKey(),
    };
  }

  const period =
    requested.trim();

  if (
    !isValidPeriod(
      period
    )
  ) {
    return {
      success: false,
      error:
        "Period must use YYYY-MM format.",
      code:
        "INVALID_PERIOD",
    };
  }

  if (
    isFuturePeriod(
      period
    )
  ) {
    return {
      success: false,
      error:
        "Future usage periods cannot be requested.",
      code:
        "FUTURE_PERIOD_NOT_ALLOWED",
    };
  }

  return {
    success: true,
    period,
  };
}

/* ==================================================
   NUMBER NORMALIZATION
================================================== */

function normalizeUsageNumber(
  value: unknown
): number {
  if (
    typeof value ===
    "number"
  ) {
    if (
      !Number.isFinite(
        value
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      value
    );
  }

  if (
    typeof value ===
    "string"
  ) {
    const normalized =
      value.trim();

    if (!normalized) {
      return 0;
    }

    const parsed =
      Number(
        normalized
      );

    if (
      !Number.isFinite(
        parsed
      )
    ) {
      return 0;
    }

    return Math.max(
      0,
      parsed
    );
  }

  return 0;
}

function normalizeIntegerUsage(
  value: unknown
): number {
  return Math.floor(
    normalizeUsageNumber(
      value
    )
  );
}

/* ==================================================
   METADATA HELPERS
================================================== */

function normalizeMetadata(
  value: unknown
): UsageMetadata {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as UsageMetadata;
}

function getMetadataNumber(
  metadata: UsageMetadata,
  keys: string[]
): number {
  for (
    const key of keys
  ) {
    const value =
      metadata[
        key as keyof UsageMetadata
      ];

    if (
      value !== undefined &&
      value !== null
    ) {
      return normalizeUsageNumber(
        value
      );
    }
  }

  return 0;
}

/* ==================================================
   USAGE CALCULATIONS
================================================== */

function calculatePercentage(
  used: number,
  limit: number | null
): number | null {
  if (
    limit === null
  ) {
    return null;
  }

  if (
    limit <= 0
  ) {
    return used > 0
      ? 100
      : 0;
  }

  const percentage =
    (used / limit) * 100;

  return Math.min(
    100,
    Math.round(
      percentage * 100
    ) / 100
  );
}

function getRemaining(
  used: number,
  limit: number | null
): number | null {
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
): UsageMetricStatus {
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
): UsageMetric {
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

/* ==================================================
   PROFILE
================================================== */

async function getProfile(
  userId: string
): Promise<
  ProfileRecord | null
> {
  const {
    data,
    error,
  } =
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

  return (
    data as ProfileRecord | null
  );
}

/* ==================================================
   USAGE RECORDS

   IMPORTANT:

   Current database type indicates that usage has:

   - id
   - user_id
   - type
   - metadata
   - created_at

   Therefore we filter by created_at instead of a
   non-existent "period" column.
================================================== */

async function getUsageRecords(
  userId: string,
  period: PeriodRange
): Promise<
  UsageRecord[]
> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("usage")
      .select(
        `
          id,
          user_id,
          type,
          metadata,
          created_at
        `
      )
      .eq(
        "user_id",
        userId
      )
      .gte(
        "created_at",
        period.startsAt
      )
      .lt(
        "created_at",
        period.endsAt
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as UsageRecord[]
  );
}

/* ==================================================
   CREATE USAGE SNAPSHOT

   Supports multiple metadata formats:

   {
     requests: 10,
     messages: 5,
     agents: 1,
     projects: 1,
     storage_bytes: 1024
   }

   Also supports aliases:

   request_count
   message_count
   agent_count
   project_count
   storageBytes
   bytes
================================================== */

function createUsageSnapshot(
  records: UsageRecord[]
): UsageSnapshot {
  const snapshot:
    UsageSnapshot = {
      requests: 0,
      messages: 0,
      agents: 0,
      projects: 0,
      storageBytes: 0,
    };

  for (
    const record of records
  ) {
    const metadata =
      normalizeMetadata(
        record.metadata
      );

    snapshot.requests +=
      normalizeIntegerUsage(
        getMetadataNumber(
          metadata,
          [
            "requests",
            "request_count",
          ]
        )
      );

    snapshot.messages +=
      normalizeIntegerUsage(
        getMetadataNumber(
          metadata,
          [
            "messages",
            "message_count",
          ]
        )
      );

    snapshot.agents +=
      normalizeIntegerUsage(
        getMetadataNumber(
          metadata,
          [
            "agents",
            "agent_count",
          ]
        )
      );

    snapshot.projects +=
      normalizeIntegerUsage(
        getMetadataNumber(
          metadata,
          [
            "projects",
            "project_count",
          ]
        )
      );

    snapshot.storageBytes +=
      getMetadataNumber(
        metadata,
        [
          "storage_bytes",
          "storageBytes",
          "bytes",
        ]
      );
  }

  return snapshot;
}

/* ==================================================
   GET USAGE
================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    /* ----------------------------------------------
       AUTHENTICATION
    ---------------------------------------------- */

    const auth =
      await getAuthenticatedUser(
        request
      );

    if (
      !auth.success
    ) {
      return errorResponse(
        auth.code,
        auth.error,
        401
      );
    }

    const userId =
      auth.userId;

    /* ----------------------------------------------
       PERIOD
    ---------------------------------------------- */

    const periodResult =
      resolveRequestedPeriod(
        request
      );

    if (
      !periodResult.success
    ) {
      return errorResponse(
        periodResult.code,
        periodResult.error,
        400
      );
    }

    const period =
      getPeriodRange(
        periodResult.period
      );

    /* ----------------------------------------------
       DATABASE
    ---------------------------------------------- */

    const [
      profile,
      usageRecords,
    ] =
      await Promise.all([
        getProfile(
          userId
        ),

        getUsageRecords(
          userId,
          period
        ),
      ]);

    /* ----------------------------------------------
       PROFILE VALIDATION
    ---------------------------------------------- */

    if (
      !profile
    ) {
      return errorResponse(
        "PROFILE_NOT_FOUND",
        "User profile was not found.",
        404
      );
    }

    /* ----------------------------------------------
       PLAN
    ---------------------------------------------- */

    const plan =
      normalizePlan(
        profile.plan
      );

    const limits =
      PLAN_LIMITS[
        plan
      ];

    /* ----------------------------------------------
       USAGE SNAPSHOT
    ---------------------------------------------- */

    const usage =
      createUsageSnapshot(
        usageRecords
      );

    /* ----------------------------------------------
       METRICS
    ---------------------------------------------- */

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

    /* ----------------------------------------------
       RESPONSE
    ---------------------------------------------- */

    return jsonResponse({
      userId,

      plan,

      subscriptionStatus:
        profile.subscription_status ??
        null,

      period,

      usage:
        metrics,

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

        recordsProcessed:
          usageRecords.length,
      },

      limits,

      generatedAt:
        new Date().toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "SYRAVEN USAGE GET ERROR:",
      error
    );

    return errorResponse(
      "USAGE_FETCH_FAILED",
      "Failed to retrieve usage information.",
      500
    );
  }
}

/* ==================================================
   METHOD NOT ALLOWED
================================================== */

function methodNotAllowed() {
  return jsonResponse(
    {
      error: {
        code:
          "METHOD_NOT_ALLOWED",

        message:
          "This endpoint only supports GET requests.",
      },
    },
    405
  );
}

export async function POST() {
  return methodNotAllowed();
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