"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);

const AUTH_STORAGE_KEY = "nova-auth-session";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getStoredSession(): AuthSession | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(
      AUTH_STORAGE_KEY
    );

    if (!storedValue) {
      return null;
    }

    const parsedValue: unknown =
      JSON.parse(storedValue);

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null
    ) {
      return null;
    }

    const session = parsedValue as AuthSession;

    if (
      !session.user ||
      typeof session.user.id !== "string" ||
      typeof session.user.email !== "string"
    ) {
      return null;
    }

    return session;
  } catch {
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
    // Storage failures should not break authentication state.
  }
}

export function AuthProvider({
  children,
  initialUser = null,
  initialSession = null,
}: AuthProviderProps): React.ReactElement {
  const [user, setUser] =
    useState<AuthUser | null>(
      initialSession?.user ??
        initialUser
    );

  const [session, setSession] =
    useState<AuthSession | null>(
      initialSession ??
        (initialUser
          ? {
              user: initialUser,
            }
          : null)
    );

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [isInitialized, setIsInitialized] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

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

  const refreshSession =
    useCallback(async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        /*
         * Production integration point:
         *
         * const response = await fetch("/api/auth/session", {
         *   method: "GET",
         *   credentials: "include",
         * });
         *
         * if (!response.ok) {
         *   throw new Error("Unable to restore session");
         * }
         *
         * const nextSession =
         *   (await response.json()) as AuthSession;
         *
         * setAuthSession(nextSession);
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

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(
    async (
      credentials: SignInCredentials
    ): Promise<AuthResult> => {
      setIsLoading(true);
      setError(null);

      try {
        if (
          !credentials.email.trim() ||
          !credentials.password
        ) {
          throw new Error(
            "Email and password are required"
          );
        }

        /*
         * Production integration point:
         *
         * const response = await fetch("/api/auth/sign-in", {
         *   method: "POST",
         *   headers: {
         *     "Content-Type": "application/json",
         *   },
         *   credentials: "include",
         *   body: JSON.stringify(credentials),
         * });
         *
         * if (!response.ok) {
         *   const body = await response.json();
         *   throw new Error(
         *     body.message ?? "Unable to sign in"
         *   );
         * }
         *
         * const nextSession =
         *   (await response.json()) as AuthSession;
         */

        const nextUser: AuthUser = {
          id: `user_${Date.now()}`,
          email: credentials.email.trim(),
          name: credentials.email
            .split("@")[0]
            .replace(
              /^[a-z]/,
              (character: string) =>
                character.toUpperCase()
            ),
          role: "user",
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

  const signUp = useCallback(
    async (
      credentials: SignUpCredentials
    ): Promise<AuthResult> => {
      setIsLoading(true);
      setError(null);

      try {
        if (
          !credentials.name.trim() ||
          !credentials.email.trim() ||
          !credentials.password
        ) {
          throw new Error(
            "Name, email and password are required"
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
         * Production integration point:
         *
         * const response = await fetch("/api/auth/sign-up", {
         *   method: "POST",
         *   headers: {
         *     "Content-Type": "application/json",
         *   },
         *   body: JSON.stringify(credentials),
         * });
         *
         * if (!response.ok) {
         *   const body = await response.json();
         *   throw new Error(
         *     body.message ?? "Unable to create account"
         *   );
         * }
         *
         * const nextSession =
         *   (await response.json()) as AuthSession;
         */

        const nextUser: AuthUser = {
          id: `user_${Date.now()}`,
          email: credentials.email.trim(),
          name: credentials.name.trim(),
          role: "user",
          createdAt:
            new Date().toISOString(),
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

  const signOut =
    useCallback(async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        /*
         * Production integration point:
         *
         * await fetch("/api/auth/sign-out", {
         *   method: "POST",
         *   credentials: "include",
         * });
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
        /*
         * Production integration point:
         *
         * const response = await fetch("/api/auth/profile", {
         *   method: "PATCH",
         *   headers: {
         *     "Content-Type": "application/json",
         *   },
         *   credentials: "include",
         *   body: JSON.stringify(updates),
         * });
         *
         * if (!response.ok) {
         *   throw new Error("Unable to update profile");
         * }
         *
         * const updatedUser =
         *   (await response.json()) as AuthUser;
         */

        const updatedUser: AuthUser = {
          ...user,
          ...updates,
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
    [session, setAuthSession, user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isAuthenticated: user !== null,
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

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);

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