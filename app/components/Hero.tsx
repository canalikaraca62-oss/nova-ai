"use client";

import React from "react";

export interface HeroAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  external?: boolean;
}

export interface HeroStat {
  value: string;
  label: string;
}

export interface HeroProps {
  eyebrow?: React.ReactNode;

  title: React.ReactNode;
  description?: React.ReactNode;

  primaryAction?: HeroAction;
  secondaryAction?: HeroAction;

  stats?: HeroStat[];

  visual?: React.ReactNode;

  badge?: React.ReactNode;

  align?: "left" | "center";

  size?: "default" | "large";

  className?: string;
  contentClassName?: string;
  visualClassName?: string;

  children?: React.ReactNode;
}

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

interface HeroActionButtonProps {
  action: HeroAction;
  variant: "primary" | "secondary";
}

function HeroActionButton({
  action,
  variant,
}: HeroActionButtonProps) {
  const {
    label,
    href,
    onClick,
    icon,
    external = false,
  } = action;

  const className = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3",
    "text-sm font-semibold transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-primary/30 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-background",
    variant === "primary"
      ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98]"
      : "border border-border bg-card text-foreground hover:bg-muted active:scale-[0.98]"
  );

  const content = (
    <>
      <span>{label}</span>

      {icon ? (
        <span
          className="flex shrink-0 items-center"
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={className}
        target={external ? "_blank" : undefined}
        rel={
          external
            ? "noopener noreferrer"
            : undefined
        }
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  );
}

export default function Hero({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  stats = [],
  visual,
  badge,
  align = "left",
  size = "default",
  className,
  contentClassName,
  visualClassName,
  children,
}: HeroProps) {
  const isCentered = align === "center";

  const sizeClasses =
    size === "large"
      ? "py-20 sm:py-24 lg:py-32"
      : "py-14 sm:py-20 lg:py-24";

  const layoutClasses = visual
    ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16"
    : "mx-auto max-w-4xl";

  return (
    <section
      className={cn(
        "relative w-full overflow-hidden bg-background",
        sizeClasses,
        className
      )}
    >
      {/* Background decoration */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />

        <div className="absolute -right-40 top-20 h-[300px] w-[300px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className={layoutClasses}>
          <div
            className={cn(
              isCentered && !visual
                ? "text-center"
                : "text-left",
              contentClassName
            )}
          >
            {badge ? (
              <div
                className={cn(
                  "mb-5",
                  isCentered && !visual && "flex justify-center"
                )}
              >
                {badge}
              </div>
            ) : null}

            {eyebrow ? (
              <div
                className={cn(
                  "mb-4 text-sm font-semibold tracking-wide text-primary",
                  isCentered && !visual && "flex justify-center"
                )}
              >
                {eyebrow}
              </div>
            ) : null}

            <h1
              className={cn(
                "max-w-4xl text-balance font-semibold tracking-tight text-foreground",
                size === "large"
                  ? "text-4xl sm:text-5xl lg:text-6xl xl:text-7xl"
                  : "text-4xl sm:text-5xl lg:text-6xl",
                isCentered && !visual && "mx-auto"
              )}
            >
              {title}
            </h1>

            {description ? (
              <div
                className={cn(
                  "mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8",
                  isCentered && !visual && "mx-auto"
                )}
              >
                {description}
              </div>
            ) : null}

            {primaryAction || secondaryAction ? (
              <div
                className={cn(
                  "mt-8 flex flex-wrap items-center gap-3",
                  isCentered &&
                    !visual &&
                    "justify-center"
                )}
              >
                {primaryAction ? (
                  <HeroActionButton
                    action={primaryAction}
                    variant="primary"
                  />
                ) : null}

                {secondaryAction ? (
                  <HeroActionButton
                    action={secondaryAction}
                    variant="secondary"
                  />
                ) : null}
              </div>
            ) : null}

            {stats.length > 0 ? (
              <dl
                className={cn(
                  "mt-10 grid max-w-2xl grid-cols-2 gap-6 border-t border-border pt-6 sm:grid-cols-3",
                  isCentered &&
                    !visual &&
                    "mx-auto text-left"
                )}
              >
                {stats.map((stat, index) => (
                  <div
                    key={`${stat.label}-${index}`}
                    className="min-w-0"
                  >
                    <dt className="text-sm text-muted-foreground">
                      {stat.label}
                    </dt>

                    <dd className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {children ? (
              <div
                className={cn(
                  "mt-8",
                  isCentered && !visual && "mx-auto"
                )}
              >
                {children}
              </div>
            ) : null}
          </div>

          {visual ? (
            <div
              className={cn(
                "relative mt-12 lg:mt-0",
                visualClassName
              )}
            >
              {visual}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function HeroSkeleton({
  visual = true,
  className,
}: {
  visual?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "w-full animate-pulse bg-background py-20 sm:py-24 lg:py-32",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            visual &&
              "lg:grid lg:grid-cols-2 lg:items-center lg:gap-16"
          )}
        >
          <div>
            <div className="h-6 w-28 rounded-full bg-muted" />

            <div className="mt-6 space-y-3">
              <div className="h-12 w-full max-w-2xl rounded bg-muted" />
              <div className="h-12 w-5/6 max-w-xl rounded bg-muted" />
            </div>

            <div className="mt-6 max-w-xl space-y-3">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-11/12 rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted" />
            </div>

            <div className="mt-8 flex gap-3">
              <div className="h-11 w-36 rounded-xl bg-muted" />
              <div className="h-11 w-32 rounded-xl bg-muted" />
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-6">
              {Array.from(
                { length: 3 },
                (_, index) => (
                  <div key={index}>
                    <div className="h-3 w-16 rounded bg-muted" />
                    <div className="mt-2 h-6 w-20 rounded bg-muted" />
                  </div>
                )
              )}
            </div>
          </div>

          {visual ? (
            <div className="mt-12 lg:mt-0">
              <div className="aspect-square w-full rounded-3xl border border-border bg-muted" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}