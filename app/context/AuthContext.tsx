"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/* ==================================================
   TYPES
================================================== */

export type UserRole =
  | "user"
  | "admin"
  | "owner";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken?: string;
  expiresAt?: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  name: string;
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: AuthUser;
}

export interface AuthContextValue {
  user: AuthUser | null;

  session: AuthSession | null;

  isAuthenticated: boolean;

  isLoading: boolean;

  isInitialized: boolean;

  error: string | null;

  signIn: (
    credentials: SignInCredentials
  ) => Promise<AuthResult>;

  signUp: (
    credentials: SignUpCredentials
  ) => Promise<AuthResult>;

  signOut: () => Promise<void>;

  refreshSession: () => Promise<void>;

  updateUser: (
    updates: Partial<
      Pick<
        AuthUser,
        "name" | "email" | "image"
      >
    >
  ) => Promise<AuthResult>;

  clearError: () => void;
}

export interface AuthProviderProps {
  children: React.ReactNode;

  initialUser?: AuthUser | null;

  initialSession?: AuthSession | null;
}

/* ==================================================
   CONSTANTS
================================================== */

const AUTH_STORAGE_KEY =
  "syraven-auth-session";

const DEFAULT_USER_ROLE: UserRole =
  "user";

const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);

/* ==================================================
   ENVIRONMENT HELPERS
================================================== */

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/* ==================================================
   STRING HELPERS
================================================== */

function normalizeEmail(
  email: string
): string {
  return email.trim().toLowerCase();
}

function getNameFromEmail(
  email: string
): string {
  const normalizedEmail =
    normalizeEmail(email);

  const separatorIndex =
    normalizedEmail.indexOf("@");

  const localPart =
    separatorIndex >= 0
      ? normalizedEmail.slice(
          0,
          separatorIndex
        )
      : normalizedEmail;

  const readableName =
    localPart
      .replace(/[._-]+/g, " ")
      .trim();

  if (!readableName) {
    return "User";
  }

  return readableName
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (part: string): string =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function isValidEmail(
  email: string
): boolean {
  const normalizedEmail =
    normalizeEmail(email);

  return (
    normalizedEmail.length > 3 &&
    normalizedEmail.includes("@") &&
    normalizedEmail.includes(".")
  );
}

/* ==================================================
   TYPE GUARDS
================================================== */

function isUserRole(
  value: unknown
): value is UserRole {
  return (
    value === "user" ||
    value === "admin" ||
    value === "owner"
  );
}

function isAuthUser(
  value: unknown
): value is AuthUser {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const user =
    value as Record<string, unknown>;

  return (
    typeof user.id === "string" &&
    user.id.trim().length > 0 &&
    typeof user.email === "string" &&
    user.email.trim().length > 0 &&
    typeof user.name === "string" &&
    user.name.trim().length > 0 &&
    isUserRole(user.role)
  );
}

function isAuthSession(
  value: unknown
): value is AuthSession {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const session =
    value as Record<string, unknown>;

  if (!isAuthUser(session.user)) {
    return false;
  }

  if (
    session.accessToken !== undefined &&
    typeof session.accessToken !== "string"
  ) {
    return false;
  }

  if (
    session.expiresAt !== undefined &&
    typeof session.expiresAt !== "string"
  ) {
    return false;
  }

  return true;
}

/* ==================================================
   SESSION STORAGE
================================================== */

function getStoredSession(): AuthSession | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const storedValue =
      window.localStorage.getItem(
        AUTH_STORAGE_KEY
      );

    if (!storedValue) {
      return null;
    }

    const parsedValue: unknown =
      JSON.parse(storedValue);

    if (!isAuthSession(parsedValue)) {
      window.localStorage.removeItem(
        AUTH_STORAGE_KEY
      );

      return null;
    }

    return parsedValue;
  } catch {
    try {
      window.localStorage.removeItem(
        AUTH_STORAGE_KEY
      );
    } catch {
      // Ignore storage cleanup failures.
    }

    return null;
  }
}

function saveSession(
  session: AuthSession | null
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    if (!session) {
      window.localStorage.removeItem(
        AUTH_STORAGE_KEY
      );

      return;
    }

    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify(session)
    );
  } catch {
    // Storage failures must not crash auth state.
  }
}

/* ==================================================
   ID HELPERS
================================================== */

function createUserId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `user_${crypto.randomUUID()}`;
  }

  return [
    "user",
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 10),
  ].join("_");
}

/* ==================================================
   AUTH PROVIDER
================================================== */

export function AuthProvider({
  children,
  initialUser = null,
  initialSession = null,
}: AuthProviderProps): React.ReactElement {
  const resolvedInitialSession =
    initialSession ??
    (initialUser
      ? {
          user: initialUser,
        }
      : null);

  const [user, setUser] =
    useState<AuthUser | null>(
      resolvedInitialSession?.user ?? null
    );

  const [session, setSession] =
    useState<AuthSession | null>(
      resolvedInitialSession
    );

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [isInitialized, setIsInitialized] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  /* ==================================================
     SESSION STATE
  ================================================== */

  const setAuthSession = useCallback(
    (
      nextSession: AuthSession | null
    ): void => {
      setSession(nextSession);

      setUser(
        nextSession?.user ?? null
      );

      saveSession(nextSession);
    },
    []
  );

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /* ==================================================
     REFRESH SESSION
  ================================================== */

  const refreshSession =
    useCallback(async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        /*
         * ==================================================
         * PRODUCTION API EXAMPLE
         * ==================================================
         *
         * const response = await fetch(
         *   "/api/auth/session",
         *   {
         *     method: "GET",
         *     credentials: "include",
         *     headers: {
         *       "Accept": "application/json",
         *     },
         *   }
         * );
         *
         * if (response.status === 401) {
         *   setAuthSession(null);
         *   return;
         * }
         *
         * if (!response.ok) {
         *   throw new Error(
         *     "Unable to restore session"
         *   );
         * }
         *
         * const data: unknown =
         *   await response.json();
         *
         * if (!isAuthSession(data)) {
         *   throw new Error(
         *     "Invalid session response"
         *   );
         * }
         *
         * setAuthSession(data);
         */

        const storedSession =
          getStoredSession();

        setAuthSession(
          storedSession
        );
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to restore authentication session";

        setError(message);

        setAuthSession(null);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }, [setAuthSession]);

  /* ==================================================
     INITIAL SESSION LOAD
  ================================================== */

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  /* ==================================================
     SIGN IN
  ================================================== */

  const signIn = useCallback(
    async (
      credentials: SignInCredentials
    ): Promise<AuthResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const email =
          normalizeEmail(
            credentials.email
          );

        if (!email) {
          throw new Error(
            "Email is required"
          );
        }

        if (!isValidEmail(email)) {
          throw new Error(
            "Please enter a valid email address"
          );
        }

        if (!credentials.password) {
          throw new Error(
            "Password is required"
          );
        }

        /*
         * ==================================================
         * PRODUCTION API EXAMPLE
         * ==================================================
         *
         * const response = await fetch(
         *   "/api/auth/sign-in",
         *   {
         *     method: "POST",
         *     headers: {
         *       "Content-Type":
         *         "application/json",
         *       "Accept":
         *         "application/json",
         *     },
         *     credentials: "include",
         *     body: JSON.stringify({
         *       email,
         *       password: credentials.password,
         *     }),
         *   }
         * );
         *
         * const body: unknown =
         *   await response.json();
         *
         * if (!response.ok) {
         *   const message =
         *     typeof body === "object" &&
         *     body !== null &&
         *     "message" in body &&
         *     typeof body.message === "string"
         *       ? body.message
         *       : "Unable to sign in";
         *
         *   throw new Error(message);
         * }
         *
         * if (!isAuthSession(body)) {
         *   throw new Error(
         *     "Invalid authentication response"
         *   );
         * }
         *
         * setAuthSession(body);
         *
         * return {
         *   success: true,
         *   user: body.user,
         * };
         */

        const nextUser: AuthUser = {
          id: createUserId(),
          email,
          name: getNameFromEmail(email),
          role: DEFAULT_USER_ROLE,
        };

        const nextSession: AuthSession = {
          user: nextUser,
        };

        setAuthSession(nextSession);

        return {
          success: true,
          user: nextUser,
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to sign in";

        setError(message);

        return {
          success: false,
          message,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [setAuthSession]
  );

  /* ==================================================
     SIGN UP
  ================================================== */

  const signUp = useCallback(
    async (
      credentials: SignUpCredentials
    ): Promise<AuthResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const name =
          credentials.name.trim();

        const email =
          normalizeEmail(
            credentials.email
          );

        if (!name) {
          throw new Error(
            "Name is required"
          );
        }

        if (!email) {
          throw new Error(
            "Email is required"
          );
        }

        if (!isValidEmail(email)) {
          throw new Error(
            "Please enter a valid email address"
          );
        }

        if (!credentials.password) {
          throw new Error(
            "Password is required"
          );
        }

        if (
          credentials.password.length < 8
        ) {
          throw new Error(
            "Password must contain at least 8 characters"
          );
        }

        /*
         * ==================================================
         * PRODUCTION API EXAMPLE
         * ==================================================
         *
         * const response = await fetch(
         *   "/api/auth/sign-up",
         *   {
         *     method: "POST",
         *     headers: {
         *       "Content-Type":
         *         "application/json",
         *       "Accept":
         *         "application/json",
         *     },
         *     body: JSON.stringify({
         *       name,
         *       email,
         *       password: credentials.password,
         *     }),
         *   }
         * );
         *
         * const body: unknown =
         *   await response.json();
         *
         * if (!response.ok) {
         *   const message =
         *     typeof body === "object" &&
         *     body !== null &&
         *     "message" in body &&
         *     typeof body.message === "string"
         *       ? body.message
         *       : "Unable to create account";
         *
         *   throw new Error(message);
         * }
         *
         * if (!isAuthSession(body)) {
         *   throw new Error(
         *     "Invalid authentication response"
         *   );
         * }
         *
         * setAuthSession(body);
         *
         * return {
         *   success: true,
         *   user: body.user,
         * };
         */

        const now =
          new Date().toISOString();

        const nextUser: AuthUser = {
          id: createUserId(),
          email,
          name,
          role: DEFAULT_USER_ROLE,
          createdAt: now,
          updatedAt: now,
        };

        const nextSession: AuthSession = {
          user: nextUser,
        };

        setAuthSession(nextSession);

        return {
          success: true,
          user: nextUser,
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to create account";

        setError(message);

        return {
          success: false,
          message,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [setAuthSession]
  );

  /* ==================================================
     SIGN OUT
  ================================================== */

  const signOut =
    useCallback(async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        /*
         * ==================================================
         * PRODUCTION API EXAMPLE
         * ==================================================
         *
         * const response = await fetch(
         *   "/api/auth/sign-out",
         *   {
         *     method: "POST",
         *     credentials: "include",
         *   }
         * );
         *
         * if (!response.ok) {
         *   throw new Error(
         *     "Unable to sign out"
         *   );
         * }
         */

        setAuthSession(null);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to sign out";

        setError(message);
      } finally {
        setIsLoading(false);
      }
    }, [setAuthSession]);

  /* ==================================================
     UPDATE USER
  ================================================== */

  const updateUser = useCallback(
    async (
      updates: Partial<
        Pick<
          AuthUser,
          "name" | "email" | "image"
        >
      >
    ): Promise<AuthResult> => {
      if (!user || !session) {
        const message =
          "You must be authenticated to update your profile";

        setError(message);

        return {
          success: false,
          message,
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        const normalizedUpdates: Partial<
          Pick<
            AuthUser,
            "name" | "email" | "image"
          >
        > = {};

        if (
          updates.name !== undefined
        ) {
          const name =
            updates.name.trim();

          if (!name) {
            throw new Error(
              "Name cannot be empty"
            );
          }

          normalizedUpdates.name =
            name;
        }

        if (
          updates.email !== undefined
        ) {
          const email =
            normalizeEmail(
              updates.email
            );

          if (!isValidEmail(email)) {
            throw new Error(
              "Please enter a valid email address"
            );
          }

          normalizedUpdates.email =
            email;
        }

        if (
          updates.image !== undefined
        ) {
          normalizedUpdates.image =
            updates.image;
        }

        /*
         * ==================================================
         * PRODUCTION API EXAMPLE
         * ==================================================
         *
         * const response = await fetch(
         *   "/api/auth/profile",
         *   {
         *     method: "PATCH",
         *     headers: {
         *       "Content-Type":
         *         "application/json",
         *       "Accept":
         *         "application/json",
         *     },
         *     credentials: "include",
         *     body: JSON.stringify(
         *       normalizedUpdates
         *     ),
         *   }
         * );
         *
         * const body: unknown =
         *   await response.json();
         *
         * if (!response.ok) {
         *   throw new Error(
         *     "Unable to update profile"
         *   );
         * }
         *
         * if (!isAuthUser(body)) {
         *   throw new Error(
         *     "Invalid profile response"
         *   );
         * }
         *
         * const updatedSession: AuthSession = {
         *   ...session,
         *   user: body,
         * };
         *
         * setAuthSession(updatedSession);
         *
         * return {
         *   success: true,
         *   user: body,
         * };
         */

        const updatedUser: AuthUser = {
          ...user,
          ...normalizedUpdates,
          updatedAt:
            new Date().toISOString(),
        };

        const updatedSession: AuthSession = {
          ...session,
          user: updatedUser,
        };

        setAuthSession(updatedSession);

        return {
          success: true,
          user: updatedUser,
        };
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to update profile";

        setError(message);

        return {
          success: false,
          message,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [
      session,
      setAuthSession,
      user,
    ]
  );

  /* ==================================================
     CONTEXT VALUE
  ================================================== */

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,

      isAuthenticated:
        user !== null,

      isLoading,

      isInitialized,

      error,

      signIn,

      signUp,

      signOut,

      refreshSession,

      updateUser,

      clearError,
    }),
    [
      user,
      session,
      isLoading,
      isInitialized,
      error,
      signIn,
      signUp,
      signOut,
      refreshSession,
      updateUser,
      clearError,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/* ==================================================
   HOOKS
================================================== */

export function useAuthContext(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuthContext must be used within an AuthProvider"
    );
  }

  return context;
}

export function useAuth(): AuthContextValue {
  return useAuthContext();
}

/* ==================================================
   EXPORTS
================================================== */

export {
  AUTH_STORAGE_KEY,
  getNameFromEmail,
  getStoredSession,
  isAuthSession,
  isAuthUser,
  isBrowser,
  isValidEmail,
  normalizeEmail,
  saveSession,
};