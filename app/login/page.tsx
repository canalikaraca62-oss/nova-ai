"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useState,
  type FormEvent,
} from "react";

import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  error?: string;
}

const INITIAL_FORM: LoginFormData = {
  email: "",
  password: "",
};

export default function LoginPage() {
  const router = useRouter();

  const [form, setForm] =
    useState<LoginFormData>(INITIAL_FORM);

  const [showPassword, setShowPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const updateField = useCallback(
    (
      field: keyof LoginFormData,
      value: string
    ) => {
      setForm((current) => ({
        ...current,
        [field]: value,
      }));

      setError(null);
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const email = form.email.trim();

      if (!email || !form.password) {
        setError(
          "Please enter your email and password."
        );
        return;
      }

      if (!email.includes("@")) {
        setError(
          "Please enter a valid email address."
        );
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          "/api/auth/login",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email,
              password: form.password,
            }),
          }
        );

        let result: LoginResponse | null =
          null;

        try {
          result =
            (await response.json()) as LoginResponse;
        } catch {
          result = null;
        }

        if (!response.ok || !result?.success) {
          setError(
            result?.error ||
              "Unable to sign in. Please try again."
          );
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred.";

        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [form.email, form.password, router]
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl lg:grid-cols-2">
        <section className="hidden min-h-[620px] flex-col justify-between border-r border-border bg-muted/30 p-10 lg:flex">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>

              NOVA
            </Link>
          </div>

          <div className="max-w-md">
            <div className="mb-6 inline-flex rounded-xl bg-primary/10 p-3 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-foreground">
              Build the future with intelligent systems.
            </h1>

            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Access your workspace, knowledge, AI agents
              and powerful tools from one unified platform.
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            Secure intelligence infrastructure for the next
            generation of builders.
          </div>
        </section>

        <section className="flex min-h-[620px] items-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="mx-auto w-full max-w-md">
            <div className="lg:hidden">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>

                NOVA
              </Link>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <LockKeyhole className="h-6 w-6" />
              </div>

              <h2 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">
                Welcome back
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Sign in to continue to your NOVA workspace.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-5"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Email address
                </label>

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField(
                        "email",
                        event.target.value
                      )
                    }
                    placeholder="you@example.com"
                    disabled={isLoading}
                    className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(event) =>
                      updateField(
                        "password",
                        event.target.value
                      )
                    }
                    placeholder="Enter your password"
                    disabled={isLoading}
                    className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-12 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              New to NOVA?{" "}
              <Link
                href="/signup"
                className="font-medium text-primary hover:underline"
              >
                Create an account
              </Link>
            </p>

            <div className="mt-8 border-t border-border pt-6 text-center">
              <Link
                href="/"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Return to homepage
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}