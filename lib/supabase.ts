/**
 * SYRAVEN Supabase Client
 *
 * Production-grade browser/client Supabase integration.
 *
 * Features:
 * - Typed database support
 * - Singleton browser client
 * - SSR-safe initialization
 * - Environment validation
 * - Lazy client creation
 * - Auth helpers
 * - Connection status helpers
 * - Safe reset for testing
 *
 * Important:
 * This module is intended for browser/client usage.
 *
 * Server-side privileged operations must use:
 * lib/supabaseAdmin.ts
 */

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/* -------------------------------------------------------------------------- */
/*                               DATABASE TYPES                               */
/* -------------------------------------------------------------------------- */

/**
 * Generic database type.
 *
 * Replace this with generated Supabase types later:
 *
 * import type { Database } from "@/types/database";
 */

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;

    Views: Record<
      string,
      {
        Row: Record<string, unknown>;
        Relationships: [];
      }
    >;

    Functions: Record<
      string,
      {
        Args: Record<string, unknown>;
        Returns: unknown;
      }
    >;

    Enums: Record<string, string>;

    CompositeTypes: Record<string, unknown>;
  };
};

/* -------------------------------------------------------------------------- */
/*                              ENVIRONMENT                                   */
/* -------------------------------------------------------------------------- */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                   */
/* -------------------------------------------------------------------------- */

export const SUPABASE_ENVIRONMENT_VARIABLES = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  anonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
} as const;

/* -------------------------------------------------------------------------- */
/*                                 ERRORS                                     */
/* -------------------------------------------------------------------------- */

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "SupabaseConfigurationError";
  }
}

/* -------------------------------------------------------------------------- */
/*                            ENV VALIDATION                                  */
/* -------------------------------------------------------------------------- */

export function hasSupabaseConfig(): boolean {
  return Boolean(
    SUPABASE_URL &&
      SUPABASE_ANON_KEY
  );
}

export function validateSupabaseConfig(): void {
  const missing: string[] = [];

  if (!SUPABASE_URL) {
    missing.push(
      SUPABASE_ENVIRONMENT_VARIABLES.url
    );
  }

  if (!SUPABASE_ANON_KEY) {
    missing.push(
      SUPABASE_ENVIRONMENT_VARIABLES.anonKey
    );
  }

  if (missing.length > 0) {
    throw new SupabaseConfigurationError(
      `Missing required Supabase environment variables: ${missing.join(
        ", "
      )}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                             CLIENT SINGLETON                               */
/* -------------------------------------------------------------------------- */

let browserClient:
  | SupabaseClient<Database>
  | null = null;

/**
 * Returns the singleton Supabase browser client.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }

  validateSupabaseConfig();

  browserClient =
    createClient<Database>(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },

        global: {
          headers: {
            "X-Client-Info":
              "syraven-web",
          },
        },

        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );

  return browserClient;
}

/* -------------------------------------------------------------------------- */
/*                              CLIENT ACCESS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Primary Supabase client.
 *
 * Lazy initialization prevents build-time crashes
 * when environment variables are unavailable.
 */
export const supabase: SupabaseClient<Database> =
  new Proxy(
    {} as SupabaseClient<Database>,
    {
      get(
        _target,
        property,
        receiver
      ) {
        const client =
          getSupabaseClient();

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
/*                              AUTH HELPERS                                  */
/* -------------------------------------------------------------------------- */

export async function getCurrentSession() {
  const client =
    getSupabaseClient();

  const {
    data,
    error,
  } =
    await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function getCurrentUser() {
  const client =
    getSupabaseClient();

  const {
    data,
    error,
  } =
    await client.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user;
}

export async function signOut(): Promise<void> {
  const client =
    getSupabaseClient();

  const {
    error,
  } =
    await client.auth.signOut();

  if (error) {
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*                              AUTH LISTENER                                 */
/* -------------------------------------------------------------------------- */

export function onAuthStateChange(
  callback: Parameters<
    SupabaseClient<Database>["auth"]["onAuthStateChange"]
  >[0]
) {
  const client =
    getSupabaseClient();

  return client.auth.onAuthStateChange(
    callback
  );
}

/* -------------------------------------------------------------------------- */
/*                              HEALTH CHECK                                  */
/* -------------------------------------------------------------------------- */

export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const client =
      getSupabaseClient();

    const {
      error,
    } =
      await client.auth.getSession();

    return !error;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*                              TESTING UTILS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Resets the singleton client.
 *
 * Intended for tests only.
 */
export function resetSupabaseClient(): void {
  browserClient =
    null;
}

/* -------------------------------------------------------------------------- */
/*                                DEFAULT                                     */
/* -------------------------------------------------------------------------- */

export default supabase;