import {
  supabaseAdmin,
} from "@/lib/supabaseAdmin";

// ==================================================
// TYPES
// ==================================================

export type SyravenPlan =
  | "free"
  | "pro"
  | "team";

export type UsageType =
  | "message"
  | "file";

type PlanLimits = {
  messages: number;
  files: number;
};

// ==================================================
// PLAN LIMITS
// ==================================================

const PLAN_LIMITS:
  Record<
    SyravenPlan,
    PlanLimits
  > = {
    free: {
      messages: 30,
      files: 5,
    },

    pro: {
      messages: 1000,
      files: 100,
    },

    team: {
      messages: 5000,
      files: 500,
    },
  };

// ==================================================
// GET MONTH START
// ==================================================

function getMonthStart() {
  const now =
    new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
      0,
      0,
      0
    )
  ).toISOString();
}

// ==================================================
// GET USER PLAN
// ==================================================

export async function getUserPlan(
  userId: string
): Promise<SyravenPlan> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("profiles")
      .select(
        "plan, subscription_status"
      )
      .eq(
        "id",
        userId
      )
      .maybeSingle();

  if (error) {
    console.error(
      "PLAN OKUMA HATASI:",
      error
    );

    return "free";
  }

  if (!data) {
    const {
      error:
        createProfileError,
    } =
      await supabaseAdmin
        .from("profiles")
        .insert({
          id:
            userId,

          plan:
            "free",

          subscription_status:
            "inactive",
        });

    if (
      createProfileError
    ) {
      console.error(
        "PROFILE OLUŞTURMA HATASI:",
        createProfileError
      );
    }

    return "free";
  }

  if (
    data.plan === "pro" ||
    data.plan === "team"
  ) {
    if (
      data.subscription_status ===
      "active"
    ) {
      return data.plan;
    }

    return "free";
  }

  return "free";
}

// ==================================================
// GET PLAN LIMIT
// ==================================================

export function getPlanLimit(
  plan: SyravenPlan,
  type: UsageType
) {
  if (
    type === "message"
  ) {
    return PLAN_LIMITS[plan]
      .messages;
  }

  return PLAN_LIMITS[plan]
    .files;
}

// ==================================================
// GET MONTHLY USAGE
// ==================================================

export async function getMonthlyUsage(
  userId: string,
  type: UsageType
) {
  const monthStart =
    getMonthStart();

  const {
    count,
    error,
  } =
    await supabaseAdmin
      .from("usage")
      .select(
        "*",
        {
          count:
            "exact",
          head:
            true,
        }
      )
      .eq(
        "user_id",
        userId
      )
      .eq(
        "type",
        type
      )
      .gte(
        "created_at",
        monthStart
      );

  if (error) {
    console.error(
      "USAGE OKUMA HATASI:",
      error
    );

    throw error;
  }

  return count ?? 0;
}

// ==================================================
// CHECK USAGE LIMIT
// ==================================================

export async function checkUsageLimit(
  userId: string,
  type: UsageType
) {
  const plan =
    await getUserPlan(
      userId
    );

  const limit =
    getPlanLimit(
      plan,
      type
    );

  const used =
    await getMonthlyUsage(
      userId,
      type
    );

  const allowed =
    used < limit;

  return {
    allowed,

    plan,

    limit,

    used,

    remaining:
      Math.max(
        0,
        limit - used
      ),
  };
}

// ==================================================
// RECORD USAGE
// ==================================================

export async function recordUsage(
  userId: string,
  type: UsageType,
  metadata: Record<
    string,
    unknown
  > = {}
) {
  const {
    error,
  } =
    await supabaseAdmin
      .from("usage")
      .insert({
        user_id:
          userId,

        type,

        metadata,
      });

  if (error) {
    console.error(
      "USAGE KAYIT HATASI:",
      error
    );

    throw error;
  }
}