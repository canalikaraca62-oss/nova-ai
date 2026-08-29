"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  general?: string;
}

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };

  const passwordStrength =
    Object.values(passwordChecks).filter(Boolean).length;

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!name.trim()) {
      nextErrors.name = "Please enter your full name.";
    } else if (name.trim().length < 2) {
      nextErrors.name =
        "Your name must contain at least 2 characters.";
    }

    if (!email.trim()) {
      nextErrors.email = "Please enter your email address.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      nextErrors.email =
        "Please enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Please create a password.";
    } else if (password.length < 8) {
      nextErrors.password =
        "Your password must contain at least 8 characters.";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword =
        "Please confirm your password.";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword =
        "Passwords do not match.";
    }

    if (!acceptedTerms) {
      nextErrors.terms =
        "You must accept the Terms and Privacy Policy.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Unable to create your account. Please try again."
        );
      }

      setIsSuccess(true);

      window.setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
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
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-300px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <div className="absolute bottom-[-250px] right-[-150px] h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />

        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:80px_80px] opacity-[0.15]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 lg:px-8">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1fr_520px] lg:gap-20">
          {/* Left content */}
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <Link
                href="/"
                className="inline-flex items-center gap-3"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20">
                  N
                </div>

                <span className="text-xl font-semibold tracking-tight text-foreground">
                  NOVA
                </span>
              </Link>

              <div className="mt-16">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  Build the future of intelligence
                </div>

                <h1 className="mt-7 text-5xl font-semibold leading-[1.08] tracking-tight text-foreground">
                  Your next great
                  <span className="block text-primary">
                    project starts here.
                  </span>
                </h1>

                <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">
                  Create your NOVA workspace and bring projects,
                  intelligence, AI agents, knowledge and workflows
                  together in one powerful environment.
                </p>
              </div>

              <div className="mt-12 space-y-5">
                <FeatureItem
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Enterprise-grade security"
                  description="Built with privacy, security and organizational control at the core."
                />

                <FeatureItem
                  icon={<Sparkles className="h-5 w-5" />}
                  title="AI-native from day one"
                  description="Connect intelligent agents, knowledge and automation into your workflows."
                />

                <FeatureItem
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  title="Scale without limits"
                  description="Start with an idea and grow into a global intelligence operation."
                />
              </div>
            </div>
          </section>

          {/* Register card */}
          <section className="mx-auto w-full max-w-[520px]">
            <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-2xl shadow-black/[0.04] backdrop-blur-xl sm:p-8">
              {/* Mobile logo */}
              <Link
                href="/"
                className="mb-10 flex items-center justify-center gap-3 lg:hidden"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
                  N
                </div>

                <span className="text-xl font-semibold text-foreground">
                  NOVA
                </span>
              </Link>

              {isSuccess ? (
                <SuccessState />
              ) : (
                <>
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                      Create your account
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Start building your next generation workspace
                      with NOVA.
                    </p>
                  </div>

                  {errors.general && (
                    <div className="mt-6 flex gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-4">
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />

                      <p className="text-sm leading-6 text-destructive">
                        {errors.general}
                      </p>
                    </div>
                  )}

                  <form
                    onSubmit={handleSubmit}
                    className="mt-8 space-y-5"
                  >
                    {/* Name */}
                    <FormField
                      label="Full name"
                      error={errors.name}
                    >
                      <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />

                        <input
                          type="text"
                          value={name}
                          onChange={(event) =>
                            setName(event.target.value)
                          }
                          placeholder="Enter your full name"
                          autoComplete="name"
                          className={inputClassName(
                            Boolean(errors.name)
                          )}
                        />
                      </div>
                    </FormField>

                    {/* Email */}
                    <FormField
                      label="Work email"
                      error={errors.email}
                    >
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />

                        <input
                          type="email"
                          value={email}
                          onChange={(event) =>
                            setEmail(event.target.value)
                          }
                          placeholder="you@company.com"
                          autoComplete="email"
                          className={inputClassName(
                            Boolean(errors.email)
                          )}
                        />
                      </div>
                    </FormField>

                    {/* Password */}
                    <FormField
                      label="Password"
                      error={errors.password}
                    >
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />

                        <input
                          type={
                            showPassword ? "text" : "password"
                          }
                          value={password}
                          onChange={(event) =>
                            setPassword(event.target.value)
                          }
                          placeholder="Create a strong password"
                          autoComplete="new-password"
                          className={`${inputClassName(
                            Boolean(errors.password)
                          )} pr-12`}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword(
                              (current) => !current
                            )
                          }
                          className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={
                            showPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <PasswordStrength
                        password={password}
                        strength={passwordStrength}
                        checks={passwordChecks}
                      />
                    </FormField>

                    {/* Confirm password */}
                    <FormField
                      label="Confirm password"
                      error={errors.confirmPassword}
                    >
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />

                        <input
                          type={
                            showConfirmPassword
                              ? "text"
                              : "password"
                          }
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(
                              event.target.value
                            )
                          }
                          placeholder="Confirm your password"
                          autoComplete="new-password"
                          className={`${inputClassName(
                            Boolean(errors.confirmPassword)
                          )} pr-12`}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(
                              (current) => !current
                            )
                          }
                          className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormField>

                    {/* Terms */}
                    <div>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(event) =>
                            setAcceptedTerms(
                              event.target.checked
                            )
                          }
                          className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                        />

                        <span className="text-sm leading-6 text-muted-foreground">
                          I agree to the{" "}
                          <Link
                            href="/terms"
                            className="font-medium text-primary hover:underline"
                          >
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link
                            href="/privacy"
                            className="font-medium text-primary hover:underline"
                          >
                            Privacy Policy
                          </Link>
                          .
                        </span>
                      </label>

                      {errors.terms && (
                        <p className="mt-2 text-xs text-destructive">
                          {errors.terms}
                        </p>
                      )}
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating your workspace...
                        </>
                      ) : (
                        <>
                          Create account
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="my-7 flex items-center gap-4">
                    <div className="h-px flex-1 bg-border" />

                    <span className="text-xs text-muted-foreground">
                      OR
                    </span>

                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-primary transition-opacity hover:opacity-70"
                    >
                      Sign in
                    </Link>
                  </p>
                </>
              )}
            </div>

            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              By creating an account, you can start building your
              intelligent workspace with NOVA.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">
        {label}
      </label>

      {children}

      {error && (
        <p className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>

      <div>
        <h3 className="font-semibold text-foreground">
          {title}
        </h3>

        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function PasswordStrength({
  password,
  strength,
  checks,
}: {
  password: string;
  strength: number;
  checks: {
    length: boolean;
    uppercase: boolean;
    number: boolean;
  };
}) {
  if (!password) {
    return null;
  }

  const strengthLabel =
    strength === 1
      ? "Weak"
      : strength === 2
        ? "Medium"
        : "Strong";

  return (
    <div className="mt-3">
      <div className="flex gap-1.5">
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${
              strength >= level
                ? "bg-primary"
                : "bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Password strength
        </span>

        <span className="text-xs font-medium text-foreground">
          {strengthLabel}
        </span>
      </div>

      <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-3">
        <PasswordRequirement
          active={checks.length}
          text="8+ characters"
        />

        <PasswordRequirement
          active={checks.uppercase}
          text="Uppercase letter"
        />

        <PasswordRequirement
          active={checks.number}
          text="Number"
        />
      </div>
    </div>
  );
}

function PasswordRequirement({
  active,
  text,
}: {
  active: boolean;
  text: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 ${
        active
          ? "text-primary"
          : "text-muted-foreground"
      }`}
    >
      <Check className="h-3.5 w-3.5" />
      {text}
    </div>
  );
}

function SuccessState() {
  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-10 w-10 text-primary" />
      </div>

      <h2 className="mt-7 text-3xl font-semibold tracking-tight text-foreground">
        Welcome to NOVA
      </h2>

      <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
        Your account has been created successfully. Preparing your
        intelligent workspace...
      </p>

      <Loader2 className="mt-8 h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function inputClassName(hasError: boolean) {
  return `h-12 w-full rounded-xl border bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-4 ${
    hasError
      ? "border-destructive focus:border-destructive focus:ring-destructive/10"
      : "border-border focus:border-primary focus:ring-primary/10"
  }`;
}