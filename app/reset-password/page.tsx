"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface FormErrors {
  email?: string;
  general?: string;
}

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  function validateEmail() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrors({
        email: "Please enter your email address.",
      });

      return false;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      setErrors({
        email: "Please enter a valid email address.",
      });

      return false;
    }

    setErrors({});

    return true;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateEmail()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch(
        "/api/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "We couldn't process your request. Please try again."
        );
      }

      /*
       * Security:
       * Always show the same success state.
       * Do not reveal whether an account exists.
       */
      setIsSubmitted(true);
    } catch (error) {
      setErrors({
        general:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch(
        "/api/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to resend the recovery email."
        );
      }
    } catch (error) {
      setErrors({
        general:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-280px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <div className="absolute bottom-[-250px] left-[-150px] h-[450px] w-[450px] rounded-full bg-primary/[0.05] blur-3xl" />

        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:80px_80px] opacity-[0.12]" />
      </div>

      <div className="relative w-full max-w-[480px]">
        {/* Logo */}
        <Link
          href="/"
          className="mb-10 flex items-center justify-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20">
            N
          </div>

          <span className="text-xl font-semibold tracking-tight text-foreground">
            NOVA
          </span>
        </Link>

        {/* Card */}
        <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-2xl shadow-black/[0.04] backdrop-blur-xl sm:p-8">
          {isSubmitted ? (
            <SuccessState
              email={email}
              isLoading={isLoading}
              onResend={handleResend}
              onUseDifferentEmail={() => {
                setIsSubmitted(false);
                setErrors({});
              }}
            />
          ) : (
            <>
              {/* Icon */}
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Mail className="h-7 w-7" />
              </div>

              {/* Heading */}
              <div className="mt-7">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                  Reset your password
                </h1>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Enter the email address associated with your
                  NOVA account and we'll send you instructions to
                  reset your password.
                </p>
              </div>

              {/* Error */}
              {errors.general && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3"
                >
                  <p className="text-sm leading-6 text-destructive">
                    {errors.general}
                  </p>
                </div>
              )}

              {/* Form */}
              <form
                onSubmit={handleSubmit}
                className="mt-8 space-y-6"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Email address
                  </label>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />

                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);

                        if (errors.email) {
                          setErrors((current) => ({
                            ...current,
                            email: undefined,
                          }));
                        }
                      }}
                      placeholder="you@company.com"
                      autoComplete="email"
                      inputMode="email"
                      disabled={isLoading}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={
                        errors.email
                          ? "email-error"
                          : undefined
                      }
                      className={`h-12 w-full rounded-xl border bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                        errors.email
                          ? "border-destructive focus:border-destructive focus:ring-destructive/10"
                          : "border-border focus:border-primary focus:ring-primary/10"
                      }`}
                    />
                  </div>

                  {errors.email && (
                    <p
                      id="email-error"
                      role="alert"
                      className="mt-2 text-xs text-destructive"
                    >
                      {errors.email}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending recovery email...
                    </>
                  ) : (
                    <>
                      Send reset instructions
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Security note */}
              <div className="mt-7 flex gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

                <p className="text-xs leading-6 text-muted-foreground">
                  For your security, we will only send password
                  recovery instructions to verified email addresses.
                </p>
              </div>

              {/* Back */}
              <div className="mt-7 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </section>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />

          <span>
            Secure access recovery powered by NOVA
          </span>
        </div>
      </div>
    </main>
  );
}

function SuccessState({
  email,
  isLoading,
  onResend,
  onUseDifferentEmail,
}: {
  email: string;
  isLoading: boolean;
  onResend: () => void;
  onUseDifferentEmail: () => void;
}) {
  return (
    <div className="py-5 text-center sm:py-8">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-10 w-10 text-primary" />
      </div>

      <h1 className="mt-7 text-3xl font-semibold tracking-tight text-foreground">
        Check your inbox
      </h1>

      <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
        If an account exists for{" "}
        <span className="font-medium text-foreground">
          {email}
        </span>
        , you'll receive password reset instructions shortly.
      </p>

      <div className="mt-7 rounded-xl border border-border bg-muted/30 p-4 text-left">
        <p className="text-sm font-medium text-foreground">
          Didn't receive an email?
        </p>

        <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
          <li>• Check your spam or junk folder.</li>

          <li>
            • Make sure you entered the correct email address.
          </li>

          <li>
            • Wait a few minutes before requesting another email.
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onResend}
        disabled={isLoading}
        className="mt-6 inline-flex items-center justify-center gap-2 text-sm font-semibold text-primary transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            Resend email
          </>
        )}
      </button>

      <div className="mt-7 border-t border-border pt-6">
        <button
          type="button"
          onClick={onUseDifferentEmail}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Use a different email address
        </button>
      </div>

      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </div>
  );
}