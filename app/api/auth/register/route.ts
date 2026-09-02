import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import crypto from "node:crypto";

import {
  getSupabaseAdminClient,
} from "@/lib/supabaseAdmin";

/* -------------------------------------------------------------------------- */
/* CONFIGURATION                                                              */
/* -------------------------------------------------------------------------- */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const DEFAULT_PLAN = "free" as const;

const TRIAL_DURATION_DAYS = 14;

const MAX_BODY_BYTES = 32 * 1024;

const MIN_PASSWORD_LENGTH = 8;

const MAX_PASSWORD_LENGTH = 128;

const MIN_NAME_LENGTH = 2;

const MAX_NAME_LENGTH = 100;

const MAX_EMAIL_LENGTH = 320;

/* -------------------------------------------------------------------------- */
/* VALIDATION                                                                 */
/* -------------------------------------------------------------------------- */

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      MIN_NAME_LENGTH,
      "Your name must contain at least 2 characters.",
    )
    .max(
      MAX_NAME_LENGTH,
      "Your name is too long.",
    ),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email(
      "Please enter a valid email address.",
    )
    .max(
      MAX_EMAIL_LENGTH,
      "Email address is too long.",
    ),

  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      "Your password must contain at least 8 characters.",
    )
    .max(
      MAX_PASSWORD_LENGTH,
      "Your password is too long.",
    ),
});

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type RegisterInput = z.infer<
  typeof registerSchema
>;

interface CreatedResources {
  userId: string | null;
  organizationId: string | null;
  workspaceId: string | null;
}

/* -------------------------------------------------------------------------- */
/* POST                                                                       */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: Request,
) {
  const resources: CreatedResources = {
    userId: null,
    organizationId: null,
    workspaceId: null,
  };

  try {
    /* ---------------------------------------------------------------------- */
    /* REQUEST SAFETY                                                         */
    /* ---------------------------------------------------------------------- */

    const contentLength =
      request.headers.get(
        "content-length",
      );

    if (
      contentLength &&
      Number(contentLength) >
        MAX_BODY_BYTES
    ) {
      return jsonError(
        "Request body is too large.",
        413,
      );
    }

    const contentType =
      request.headers.get(
        "content-type",
      );

    if (
      contentType &&
      !contentType
        .toLowerCase()
        .startsWith(
          "application/json",
        )
    ) {
      return jsonError(
        "Request must use application/json.",
        415,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* PARSE BODY                                                             */
    /* ---------------------------------------------------------------------- */

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Invalid JSON request body.",
        400,
      );
    }

    const parsed =
      registerSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue =
        parsed.error.issues[0];

      return jsonError(
        firstIssue?.message ??
          "Invalid registration data.",
        400,
      );
    }

    const input: RegisterInput =
      parsed.data;

    /* ---------------------------------------------------------------------- */
    /* PASSWORD QUALITY                                                       */
    /* ---------------------------------------------------------------------- */

    const passwordError =
      validatePassword(
        input.password,
      );

    if (passwordError) {
      return jsonError(
        passwordError,
        400,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* ENVIRONMENT                                                            */
    /* ---------------------------------------------------------------------- */

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      console.error(
        "[REGISTER] Supabase public configuration is missing.",
      );

      return jsonError(
        "Authentication service is not configured correctly.",
        500,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* ADMIN CLIENT                                                           */
    /* ---------------------------------------------------------------------- */

    const admin =
      getSupabaseAdminClient();

    /* ---------------------------------------------------------------------- */
    /* NORMALIZE DATA                                                         */
    /* ---------------------------------------------------------------------- */

    const normalizedEmail =
      normalizeEmail(
        input.email,
      );

    const normalizedName =
      normalizeName(
        input.name,
      );

    const now =
      new Date();

    const trialStartedAt =
      now.toISOString();

    const trialEndsAt =
      getTrialEndDate(
        now,
      ).toISOString();

    const userMetadata = {
      full_name:
        normalizedName,

      name:
        normalizedName,

      plan:
        DEFAULT_PLAN,

      account_plan:
        DEFAULT_PLAN,

      account_status:
        "trial",

      trial_enabled:
        true,

      trial_active:
        true,

      trial_started_at:
        trialStartedAt,

      trial_ends_at:
        trialEndsAt,

      trial_duration_days:
        TRIAL_DURATION_DAYS,

      trial_auto_convert:
        false,

      permanent_free_tier:
        true,

      onboarding_completed:
        false,

      created_via:
        "web_registration",

      registration_version:
        "v1",
    };

    /* ---------------------------------------------------------------------- */
    /* CREATE AUTH USER                                                       */
    /* ---------------------------------------------------------------------- */

    const {
      data: authData,
      error: authError,
    } =
      await admin.auth.admin.createUser(
        {
          email:
            normalizedEmail,

          password:
            input.password,

          email_confirm:
            true,

          user_metadata:
            userMetadata,
        },
      );

    if (authError) {
      console.error(
        "[REGISTER] Auth user creation failed:",
        sanitizeSupabaseError(
          authError,
        ),
      );

      return mapAuthRegistrationError(
        authError,
      );
    }

    const user =
      authData.user;

    if (!user?.id) {
      console.error(
        "[REGISTER] Supabase returned no user after creation.",
      );

      return jsonError(
        "Unable to create your account.",
        500,
      );
    }

    resources.userId =
      user.id;

    /* ---------------------------------------------------------------------- */
    /* ORGANIZATION                                                          */
    /* ---------------------------------------------------------------------- */

    const organizationName =
      buildOrganizationName(
        normalizedName,
      );

    const organizationSlug =
      buildUniqueSlug(
        normalizedName,
      );

    const organizationMetadata =
      {
        created_via:
          "web_registration",

        owner_user_id:
          user.id,

        plan:
          DEFAULT_PLAN,

        account_status:
          "trial",

        trial_enabled:
          true,

        trial_active:
          true,

        trial_started_at:
          trialStartedAt,

        trial_ends_at:
          trialEndsAt,

        trial_duration_days:
          TRIAL_DURATION_DAYS,

        trial_auto_convert:
          false,

        permanent_free_tier:
          true,

        onboarding_completed:
          false,
      };

    const {
      data:
        organization,
      error:
        organizationError,
    } =
      await admin
        .from(
          "organizations",
        )
        .insert({
          name:
            organizationName,

          slug:
            organizationSlug,

          description:
            "SYRAVEN workspace",

          plan:
            DEFAULT_PLAN,

          status:
            "active",

          owner_id:
            user.id,

          metadata:
            organizationMetadata,
        })
        .select(
          "id",
        )
        .single();

    if (
      organizationError ||
      !organization?.id
    ) {
      console.error(
        "[REGISTER] Organization creation failed:",
        sanitizeSupabaseError(
          organizationError,
        ),
      );

      await cleanupRegistration(
        admin,
        resources,
      );

      return jsonError(
        "Unable to initialize your workspace.",
        500,
      );
    }

    resources.organizationId =
      organization.id;

    /* ---------------------------------------------------------------------- */
    /* ORGANIZATION MEMBERSHIP                                                */
    /* ---------------------------------------------------------------------- */

    const {
      error:
        membershipError,
    } =
      await admin
        .from(
          "organization_members",
        )
        .insert({
          organization_id:
            organization.id,

          user_id:
            user.id,

          role:
            "owner",

          status:
            "active",

          joined_at:
            now.toISOString(),
        });

    if (membershipError) {
      console.error(
        "[REGISTER] Organization membership creation failed:",
        sanitizeSupabaseError(
          membershipError,
        ),
      );

      await cleanupRegistration(
        admin,
        resources,
      );

      return jsonError(
        "Unable to initialize your account membership.",
        500,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* WORKSPACE                                                              */
    /* ---------------------------------------------------------------------- */

    const workspaceName =
      `${normalizedName}'s Workspace`;

    const workspaceSlug =
      buildWorkspaceSlug(
        normalizedName,
      );

    const {
      data:
        workspace,
      error:
        workspaceError,
    } =
      await admin
        .from(
          "workspaces",
        )
        .insert({
          organization_id:
            organization.id,

          name:
            workspaceName,

          slug:
            workspaceSlug,

          description:
            "Your personal SYRAVEN workspace.",

          created_by:
            user.id,

          metadata: {
            created_via:
              "web_registration",

            owner_user_id:
              user.id,

            plan:
              DEFAULT_PLAN,

            account_status:
              "trial",

            trial_started_at:
              trialStartedAt,

            trial_ends_at:
              trialEndsAt,

            trial_auto_convert:
              false,
          },
        })
        .select(
          "id",
        )
        .single();

    if (
      workspaceError ||
      !workspace?.id
    ) {
      console.error(
        "[REGISTER] Workspace creation failed:",
        sanitizeSupabaseError(
          workspaceError,
        ),
      );

      await cleanupRegistration(
        admin,
        resources,
      );

      return jsonError(
        "Unable to create your workspace.",
        500,
      );
    }

    resources.workspaceId =
      workspace.id;

    /* ---------------------------------------------------------------------- */
    /* AUDIT LOG                                                              */
    /* ---------------------------------------------------------------------- */

    const {
      error:
        auditError,
    } =
      await admin
        .from(
          "audit_logs",
        )
        .insert({
          organization_id:
            organization.id,

          workspace_id:
            workspace.id,

          user_id:
            user.id,

          action:
            "account.created",

          resource_type:
            "user",

          resource_id:
            user.id,

          description:
            "User account, organization and workspace created.",

          metadata: {
            registration_method:
              "email_password",

            plan:
              DEFAULT_PLAN,

            trial:
              true,

            trial_duration_days:
              TRIAL_DURATION_DAYS,

            trial_started_at:
              trialStartedAt,

            trial_ends_at:
              trialEndsAt,
          },
        });

    if (auditError) {
      /*
       * Audit logging should not make an otherwise valid account unusable.
       * We log the failure and continue.
       */
      console.error(
        "[REGISTER] Audit log creation failed:",
        sanitizeSupabaseError(
          auditError,
        ),
      );
    }

    /* ---------------------------------------------------------------------- */
    /* CREATE AUTH SESSION                                                    */
    /* ---------------------------------------------------------------------- */

    const cookieStore =
      await cookies();

    const supabase =
      createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },

            setAll(
              cookiesToSet,
            ) {
              try {
                for (
                  const {
                    name,
                    value,
                    options,
                  } of cookiesToSet
                ) {
                  cookieStore.set(
                    name,
                    value,
                    options,
                  );
                }
              } catch {
                /*
                 * Route handlers can normally mutate cookies.
                 * If a framework/runtime restriction prevents it,
                 * Supabase authentication still remains valid and
                 * the client can authenticate again through login.
                 */
              }
            },
          },
        },
      );

    const {
      data:
        sessionData,
      error:
        sessionError,
    } =
      await supabase.auth.signInWithPassword(
        {
          email:
            normalizedEmail,

          password:
            input.password,
        },
      );

    if (
      sessionError ||
      !sessionData.session
    ) {
      console.error(
        "[REGISTER] Automatic session creation failed:",
        sanitizeSupabaseError(
          sessionError,
        ),
      );

      /*
       * The account itself is already valid.
       * We intentionally do NOT delete it here.
       *
       * The frontend can redirect the user to login if necessary.
       */
      return jsonSuccess({
        authenticated:
          false,

        user: {
          id:
            user.id,

          email:
            normalizedEmail,

          name:
            normalizedName,
        },

        organization: {
          id:
            organization.id,

          name:
            organizationName,

          slug:
            organizationSlug,
        },

        workspace: {
          id:
            workspace.id,

          name:
            workspaceName,

          slug:
            workspaceSlug,
        },

        subscription: {
          plan:
            DEFAULT_PLAN,

          status:
            "trial",

          trialActive:
            true,

          trialStartedAt,

          trialEndsAt,

          trialDurationDays:
            TRIAL_DURATION_DAYS,

          autoConvertToPaid:
            false,
        },

        message:
          "Account created successfully. Please sign in to continue.",
      });
    }

    /* ---------------------------------------------------------------------- */
    /* SUCCESS                                                                */
    /* ---------------------------------------------------------------------- */

    return jsonSuccess({
      authenticated:
        true,

      user: {
        id:
          user.id,

        email:
          normalizedEmail,

        name:
          normalizedName,
      },

      organization: {
        id:
          organization.id,

        name:
          organizationName,

        slug:
          organizationSlug,

        role:
          "owner",
      },

      workspace: {
        id:
          workspace.id,

        name:
          workspaceName,

        slug:
          workspaceSlug,
      },

      subscription: {
        plan:
          DEFAULT_PLAN,

        status:
          "trial",

        trialActive:
          true,

        trialStartedAt,

        trialEndsAt,

        trialDurationDays:
          TRIAL_DURATION_DAYS,

        autoConvertToPaid:
          false,

        permanentFreeTier:
          true,
      },

      message:
        "Account created successfully.",
    });
  } catch (error) {
    console.error(
      "[REGISTER] Unexpected registration error:",
      error,
    );

    /*
     * Only cleanup resources that we know were created.
     * This is best-effort because the failure may happen after
     * one or more successful database operations.
     */
    try {
      const admin =
        getSupabaseAdminClient();

      await cleanupRegistration(
        admin,
        resources,
      );
    } catch (cleanupError) {
      console.error(
        "[REGISTER] Cleanup failed:",
        cleanupError,
      );
    }

    return jsonError(
      "Unable to create your account right now. Please try again.",
      500,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeEmail(
  email: string,
): string {
  return email
    .trim()
    .toLowerCase();
}

function normalizeName(
  name: string,
): string {
  return name
    .trim()
    .replace(
      /\s+/g,
      " ",
    );
}

function validatePassword(
  password: string,
): string | null {
  if (
    password.length <
    MIN_PASSWORD_LENGTH
  ) {
    return `Your password must contain at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (
    password.length >
    MAX_PASSWORD_LENGTH
  ) {
    return `Your password must contain fewer than ${MAX_PASSWORD_LENGTH + 1} characters.`;
  }

  /*
   * Keep this compatible with the current registration UI:
   * minimum length is mandatory while uppercase/number are encouraged
   * by the frontend strength indicator.
   */
  return null;
}

function getTrialEndDate(
  start: Date,
): Date {
  const end =
    new Date(
      start.getTime(),
    );

  end.setUTCDate(
    end.getUTCDate() +
      TRIAL_DURATION_DAYS,
  );

  return end;
}

function buildOrganizationName(
  name: string,
): string {
  const firstName =
    name
      .split(" ")
      .filter(Boolean)[0] ??
      "My";

  return `${firstName}'s Organization`;
}

function buildUniqueSlug(
  name: string,
): string {
  const base =
    slugify(name) ||
    "organization";

  const suffix =
    crypto
      .randomUUID()
      .replace(
        /-/g,
        "",
      )
      .slice(
        0,
        10,
      );

  return `${base}-${suffix}`;
}

function buildWorkspaceSlug(
  name: string,
): string {
  const base =
    slugify(name) ||
    "workspace";

  const suffix =
    crypto
      .randomUUID()
      .replace(
        /-/g,
        "",
      )
      .slice(
        0,
        10,
      );

  return `${base}-workspace-${suffix}`;
}

function slugify(
  value: string,
): string {
  return value
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    )
    .slice(
      0,
      60,
    );
}

/* -------------------------------------------------------------------------- */
/* CLEANUP                                                                    */
/* -------------------------------------------------------------------------- */

async function cleanupRegistration(
  admin: ReturnType<
    typeof getSupabaseAdminClient
  >,
  resources: CreatedResources,
): Promise<void> {
  /*
   * Delete children first.
   *
   * organizations.owner_id references auth.users with ON DELETE RESTRICT,
   * so organization must be deleted before the auth user.
   */

  if (
    resources.workspaceId
  ) {
    const {
      error,
    } =
      await admin
        .from(
          "workspaces",
        )
        .delete()
        .eq(
          "id",
          resources.workspaceId,
        );

    if (error) {
      console.error(
        "[REGISTER] Workspace cleanup failed:",
        sanitizeSupabaseError(
          error,
        ),
      );
    }
  }

  if (
    resources.organizationId
  ) {
    const {
      error,
    } =
      await admin
        .from(
          "organizations",
        )
        .delete()
        .eq(
          "id",
          resources.organizationId,
        );

    if (error) {
      console.error(
        "[REGISTER] Organization cleanup failed:",
        sanitizeSupabaseError(
          error,
        ),
      );
    }
  }

  if (
    resources.userId
  ) {
    try {
      const {
        error,
      } =
        await admin.auth.admin.deleteUser(
          resources.userId,
        );

      if (error) {
        console.error(
          "[REGISTER] Auth user cleanup failed:",
          sanitizeSupabaseError(
            error,
          ),
        );
      }
    } catch (error) {
      console.error(
        "[REGISTER] Auth cleanup exception:",
        error,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* ERROR HANDLING                                                             */
/* -------------------------------------------------------------------------- */

function mapAuthRegistrationError(
  error: unknown,
): NextResponse {
  const message =
    getErrorMessage(
      error,
    );

  const normalized =
    message.toLowerCase();

  /*
   * Do not reveal unnecessary internal
   * Supabase implementation details.
   */

  if (
    normalized.includes(
      "already registered",
    ) ||
    normalized.includes(
      "already exists",
    ) ||
    normalized.includes(
      "user already",
    ) ||
    normalized.includes(
      "duplicate",
    )
  ) {
    return jsonError(
      "An account with this email already exists. Please sign in instead.",
      409,
    );
  }

  if (
    normalized.includes(
      "password",
    )
  ) {
    return jsonError(
      "The password does not meet the authentication requirements.",
      400,
    );
  }

  if (
    normalized.includes(
      "email",
    )
  ) {
    return jsonError(
      "Please provide a valid email address.",
      400,
    );
  }

  console.error(
    "[REGISTER] Supabase authentication error:",
    sanitizeSupabaseError(
      error,
    ),
  );

  return jsonError(
    "Unable to create your account. Please try again.",
    500,
  );
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    typeof error ===
    "object" &&
    error !== null &&
    "message" in error
  ) {
    const message =
      (
        error as {
          message?: unknown;
        }
      ).message;

    if (
      typeof message ===
      "string"
    ) {
      return message;
    }
  }

  return "Unknown error";
}

function sanitizeSupabaseError(
  error: unknown,
): {
  message: string;
} | null {
  if (!error) {
    return null;
  }

  return {
    message:
      getErrorMessage(
        error,
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* RESPONSE HELPERS                                                           */
/* -------------------------------------------------------------------------- */

function jsonSuccess(
  data: Record<
    string,
    unknown
  >,
) {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    {
      status: 201,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function jsonError(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}