/**
 * SYRAVEN Supabase Admin Client
 *
 * Enterprise-grade server-side Supabase integration.
 *
 * Features:
 * - Server-only protection
 * - Service role authentication
 * - Typed database client
 * - Lazy singleton initialization
 * - Environment validation
 * - Admin user management
 * - Auth admin helpers
 * - Connection health checks
 * - Test reset support
 *
 * SECURITY:
 * - NEVER import this file into client components.
 * - NEVER expose SUPABASE_SERVICE_ROLE_KEY.
 * - Service role bypasses Row Level Security.
 */

import "server-only";

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import type {
  Database,
} from "./supabase";

/* -------------------------------------------------------------------------- */
/*                              ENVIRONMENT                                   */
/* -------------------------------------------------------------------------- */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

export const SUPABASE_ADMIN_ENVIRONMENT_VARIABLES = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
} as const;

export const DEFAULT_ADMIN_USERS_PAGE =
  1;

export const DEFAULT_ADMIN_USERS_PER_PAGE =
  100;

export const MAX_ADMIN_USERS_PER_PAGE =
  1000;

/* -------------------------------------------------------------------------- */
/*                                 ERRORS                                     */
/* -------------------------------------------------------------------------- */

export class SupabaseAdminError
  extends Error {
  constructor(
    message: string,
    options?: ErrorOptions
  ) {
    super(
      message,
      options
    );

    this.name =
      "SupabaseAdminError";
  }
}

export class SupabaseAdminConfigurationError
  extends SupabaseAdminError {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "SupabaseAdminConfigurationError";
  }
}

export class SupabaseAdminValidationError
  extends SupabaseAdminError {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "SupabaseAdminValidationError";
  }
}

export class SupabaseAdminOperationError
  extends SupabaseAdminError {
  constructor(
    message: string,
    cause?: unknown
  ) {
    super(
      message,
      cause === undefined
        ? undefined
        : {
            cause,
          }
    );

    this.name =
      "SupabaseAdminOperationError";
  }
}

/* -------------------------------------------------------------------------- */
/*                            CONFIGURATION                                   */
/* -------------------------------------------------------------------------- */

/**
 * Returns true when all required admin environment
 * variables are available.
 */
export function hasSupabaseAdminConfig(): boolean {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Validates required environment variables.
 */
export function validateSupabaseAdminConfig(): void {
  const missing: string[] =
    [];

  if (!SUPABASE_URL) {
    missing.push(
      SUPABASE_ADMIN_ENVIRONMENT_VARIABLES.url
    );
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    missing.push(
      SUPABASE_ADMIN_ENVIRONMENT_VARIABLES.serviceRoleKey
    );
  }

  if (
    missing.length > 0
  ) {
    throw new SupabaseAdminConfigurationError(
      [
        "Missing required Supabase admin environment variables:",
        missing.join(", "),
      ].join(" ")
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                          ADMIN CLIENT SINGLETON                            */
/* -------------------------------------------------------------------------- */

let adminClient:
  | SupabaseClient<Database>
  | null =
  null;

/**
 * Returns the singleton Supabase admin client.
 *
 * Uses the service role key.
 *
 * This client bypasses Row Level Security and must
 * only run in trusted server-side code.
 */
export function getSupabaseAdminClient():
  SupabaseClient<Database> {
  if (adminClient) {
    return adminClient;
  }

  validateSupabaseAdminConfig();

  adminClient =
    createClient<Database>(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },

        global: {
          headers: {
            "X-Client-Info":
              "syraven-admin-server",
          },
        },
      }
    );

  return adminClient;
}

/* -------------------------------------------------------------------------- */
/*                            ADMIN CLIENT ACCESS                             */
/* -------------------------------------------------------------------------- */

/**
 * Primary admin client.
 *
 * Uses lazy initialization so environment validation
 * occurs only when the client is actually used.
 */
export const supabaseAdmin:
  SupabaseClient<Database> =
  new Proxy(
    {} as SupabaseClient<Database>,
    {
      get(
        _target,
        property,
        receiver
      ) {
        const client =
          getSupabaseAdminClient();

        const value =
          Reflect.get(
            client,
            property,
            receiver
          );

        if (
          typeof value ===
          "function"
        ) {
          return value.bind(
            client
          );
        }

        return value;
      },
    }
  );

/* -------------------------------------------------------------------------- */
/*                                TYPES                                       */
/* -------------------------------------------------------------------------- */

export interface ListAdminUsersOptions {
  page?: number;

  perPage?: number;
}

export interface ListAdminUsersResult {
  users: User[];

  page: number;

  perPage: number;

  total: number;

  hasMore: boolean;
}

export interface DeleteAdminUserOptions {
  /**
   * When true, requests a soft delete.
   *
   * Supabase versions that support this use a boolean
   * as the second deleteUser argument.
   */
  shouldSoftDelete?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                           ADMIN USER HELPERS                               */
/* -------------------------------------------------------------------------- */

/**
 * Gets a user by ID.
 */
export async function getAdminUser(
  userId: string
): Promise<User | null> {
  validateUserId(
    userId
  );

  const client =
    getSupabaseAdminClient();

  const {
    data,
    error,
  } =
    await client.auth.admin.getUserById(
      userId.trim()
    );

  if (error) {
    return null;
  }

  return data.user;
}

/**
 * Lists users with pagination.
 */
export async function listAdminUsers(
  options: ListAdminUsersOptions = {}
): Promise<ListAdminUsersResult> {
  const page =
    normalizePositiveInteger(
      options.page,
      DEFAULT_ADMIN_USERS_PAGE
    );

  const perPage =
    Math.min(
      normalizePositiveInteger(
        options.perPage,
        DEFAULT_ADMIN_USERS_PER_PAGE
      ),
      MAX_ADMIN_USERS_PER_PAGE
    );

  const client =
    getSupabaseAdminClient();

  const {
    data,
    error,
  } =
    await client.auth.admin.listUsers({
      page,
      perPage,
    });

  if (error) {
    throw new SupabaseAdminOperationError(
      "Failed to list Supabase users.",
      error
    );
  }

  const users =
    data.users ??
    [];

  /**
   * Some Supabase versions expose total differently.
   * We safely use the returned list size when unavailable.
   */
  const total =
    typeof data.total ===
    "number"
      ? data.total
      : users.length;

  return {
    users,

    page,

    perPage,

    total,

    hasMore:
      users.length ===
      perPage,
  };
}

/**
 * Deletes a user.
 *
 * IMPORTANT:
 * The installed Supabase version expects:
 *
 * deleteUser(userId, shouldSoftDelete?)
 *
 * where the second parameter is boolean | undefined.
 */
export async function deleteAdminUser(
  userId: string,
  options: DeleteAdminUserOptions = {}
): Promise<void> {
  validateUserId(
    userId
  );

  const client =
    getSupabaseAdminClient();

  const {
    error,
  } =
    await client.auth.admin.deleteUser(
      userId.trim(),
      options.shouldSoftDelete
    );

  if (error) {
    throw new SupabaseAdminOperationError(
      `Failed to delete user "${userId}".`,
      error
    );
  }
}

/**
 * Updates a user using the Supabase admin API.
 */
export async function updateAdminUser(
  userId: string,
  attributes: Parameters<
    SupabaseClient<Database>["auth"]["admin"]["updateUserById"]
  >[1]
): Promise<User> {
  validateUserId(
    userId
  );

  if (
    !attributes ||
    typeof attributes !==
      "object"
  ) {
    throw new SupabaseAdminValidationError(
      "User update attributes are required."
    );
  }

  const client =
    getSupabaseAdminClient();

  const {
    data,
    error,
  } =
    await client.auth.admin.updateUserById(
      userId.trim(),
      attributes
    );

  if (error) {
    throw new SupabaseAdminOperationError(
      `Failed to update user "${userId}".`,
      error
    );
  }

  return data.user;
}

/* -------------------------------------------------------------------------- */
/*                           AUTH LINK HELPERS                                */
/* -------------------------------------------------------------------------- */

/**
 * Generates a password recovery link.
 */
export async function generatePasswordRecoveryLink(
  email: string
) {
  const normalizedEmail =
    normalizeEmail(
      email
    );

  const client =
    getSupabaseAdminClient();

  const {
    data,
    error,
  } =
    await client.auth.admin.generateLink({
      type:
        "recovery",

      email:
        normalizedEmail,
    });

  if (error) {
    throw new SupabaseAdminOperationError(
      "Failed to generate password recovery link.",
      error
    );
  }

  return data;
}

/**
 * Generates an invitation link.
 */
export async function generateInviteLink(
  email: string
) {
  const normalizedEmail =
    normalizeEmail(
      email
    );

  const client =
    getSupabaseAdminClient();

  const {
    data,
    error,
  } =
    await client.auth.admin.generateLink({
      type:
        "invite",

      email:
        normalizedEmail,
    });

  if (error) {
    throw new SupabaseAdminOperationError(
      "Failed to generate invitation link.",
      error
    );
  }

  return data;
}

/**
 * Generates a signup link.
 */
export async function generateSignupLink(
  email: string,
  password: string
) {
  const normalizedEmail =
    normalizeEmail(
      email
    );

  if (
    typeof password !==
      "string" ||
    password.length < 6
  ) {
    throw new SupabaseAdminValidationError(
      "Password must contain at least 6 characters."
    );
  }

  const client =
    getSupabaseAdminClient();

  const {
    data,
    error,
  } =
    await client.auth.admin.generateLink({
      type:
        "signup",

      email:
        normalizedEmail,

      password,
    });

  if (error) {
    throw new SupabaseAdminOperationError(
      "Failed to generate signup link.",
      error
    );
  }

  return data;
}

/* -------------------------------------------------------------------------- */
/*                               HEALTH CHECK                                 */
/* -------------------------------------------------------------------------- */

/**
 * Checks whether the Supabase admin connection works.
 */
export async function checkSupabaseAdminConnection():
  Promise<boolean> {
  try {
    const client =
      getSupabaseAdminClient();

    const {
      error,
    } =
      await client.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Throws when the Supabase admin connection is unavailable.
 */
export async function requireSupabaseAdminConnection():
  Promise<void> {
  const connected =
    await checkSupabaseAdminConnection();

  if (!connected) {
    throw new SupabaseAdminOperationError(
      "Supabase admin connection is unavailable."
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                              TEST UTILITIES                                */
/* -------------------------------------------------------------------------- */

/**
 * Resets the singleton client.
 *
 * Intended for tests.
 */
export function resetSupabaseAdminClient(): void {
  adminClient =
    null;
}

/* -------------------------------------------------------------------------- */
/*                              VALIDATION                                    */
/* -------------------------------------------------------------------------- */

function validateUserId(
  userId: string
): void {
  if (
    typeof userId !==
      "string" ||
    !userId.trim()
  ) {
    throw new SupabaseAdminValidationError(
      "User ID is required."
    );
  }
}

function normalizeEmail(
  email: string
): string {
  if (
    typeof email !==
      "string"
  ) {
    throw new SupabaseAdminValidationError(
      "Email must be a string."
    );
  }

  const normalized =
    email
      .trim()
      .toLowerCase();

  if (
    !normalized ||
    !normalized.includes("@")
  ) {
    throw new SupabaseAdminValidationError(
      "A valid email address is required."
    );
  }

  return normalized;
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number
): number {
  if (
    value === undefined
  ) {
    return fallback;
  }

  if (
    !Number.isFinite(
      value
    ) ||
    value <= 0
  ) {
    throw new SupabaseAdminValidationError(
      "Value must be a positive finite number."
    );
  }

  return Math.floor(
    value
  );
}

/* -------------------------------------------------------------------------- */
/*                                DEFAULT                                     */
/* -------------------------------------------------------------------------- */

export default supabaseAdmin;