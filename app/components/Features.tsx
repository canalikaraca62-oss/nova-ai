"use client";

import React from "react";

export type FeatureStatus =
  | "available"
  | "new"
  | "beta"
  | "coming-soon";

export interface FeatureItem {
  id: string;
  title: string;
  description: string;

  icon?: React.ReactNode;

  badge?: string;
  status?: FeatureStatus;

  href?: string;

  highlighted?: boolean;
  disabled?: boolean;

  onClick?: (feature: FeatureItem) => void;
}

export interface FeaturesProps {
  title?: string;
  description?: string;

  eyebrow?: string;

  features: FeatureItem[];

  columns?: 2 | 3 | 4;

  className?: string;
  headerClassName?: string;
  gridClassName?: string;

  renderFeature?: (
    feature: FeatureItem,
    index: number
  ) => React.ReactNode;
}

const statusLabels: Record<FeatureStatus, string> = {
  available: "Available",
  new: "New",
  beta: "Beta",
  "coming-soon": "Coming soon",
};

const statusClasses: Record<FeatureStatus, string> = {
  available:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  new:
    "border-primary/20 bg-primary/10 text-primary",
  beta:
    "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "coming-soon":
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function getGridColumns(
  columns: 2 | 3 | 4
): string {
  switch (columns) {
    case 2:
      return "md:grid-cols-2";

    case 3:
      return "md:grid-cols-2 xl:grid-cols-3";

    case 4:
      return "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

    default:
      return "md:grid-cols-2 xl:grid-cols-3";
  }
}

interface FeatureCardProps {
  feature: FeatureItem;
}

function FeatureCard({
  feature,
}: FeatureCardProps) {
  const {
    title,
    description,
    icon,
    badge,
    status = "available",
    href,
    highlighted = false,
    disabled = false,
    onClick,
  } = feature;

  const isDisabled =
    disabled || status === "coming-soon";

  const isInteractive =
    !isDisabled && (Boolean(href) || Boolean(onClick));

  const handleClick = (): void => {
    if (isDisabled) {
      return;
    }

    onClick?.(feature);
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center",
            "rounded-2xl border border-border bg-muted",
            "text-lg text-foreground transition-transform duration-200",
            isInteractive && "group-hover:scale-105"
          )}
        >
          {icon ?? "✦"}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {badge ? (
            <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {badge}
            </span>
          ) : null}

          {status !== "available" ? (
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                statusClasses[status]
              )}
            >
              {statusLabels[status]}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      {isInteractive ? (
        <div className="mt-6 flex items-center gap-2 text-sm font-medium text-primary">
          <span>
            Explore
          </span>

          <span
            className="transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden="true"
          >
            →
          </span>
        </div>
      ) : null}
    </>
  );

  const cardClassName = cn(
    "group relative flex min-h-[220px] flex-col rounded-2xl border p-5",
    "bg-card text-card-foreground transition-all duration-200",
    highlighted
      ? "border-primary/50 shadow-lg ring-1 ring-primary/10"
      : "border-border",
    isInteractive &&
      "cursor-pointer hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl",
    isDisabled &&
      "cursor-not-allowed opacity-60",
    !isInteractive && !isDisabled && "cursor-default"
  );

  if (href && !isDisabled) {
    return (
      <a
        href={href}
        className={cardClassName}
        aria-label={`Explore ${title}`}
      >
        {content}
      </a>
    );
  }

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          cardClassName,
          "w-full text-left"
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <article
      className={cardClassName}
      aria-disabled={isDisabled || undefined}
    >
      {content}
    </article>
  );
}

export default function Features({
  title = "Everything you need",
  description,
  eyebrow,
  features,
  columns = 3,
  className,
  headerClassName,
  gridClassName,
  renderFeature,
}: FeaturesProps) {
  return (
    <section
      className={cn(
        "w-full",
        className
      )}
    >
      {title || description || eyebrow ? (
        <div
          className={cn(
            "mx-auto mb-8 max-w-2xl text-center",
            headerClassName
          )}
        >
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
          ) : null}

          {title ? (
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h2>
          ) : null}

          {description ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          getGridColumns(columns),
          gridClassName
        )}
      >
        {features.map((feature, index) => (
          <React.Fragment key={feature.id}>
            {renderFeature
              ? renderFeature(feature, index)
              : (
                <FeatureCard
                  feature={feature}
                />
              )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

export function FeaturesSkeleton({
  count = 6,
  columns = 3,
  className,
}: {
  count?: number;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        getGridColumns(columns),
        className
      )}
    >
      {Array.from(
        { length: count },
        (_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="h-12 w-12 rounded-2xl bg-muted" />

              <div className="h-6 w-16 rounded-full bg-muted" />
            </div>

            <div className="mt-5">
              <div className="h-5 w-32 rounded bg-muted" />

              <div className="mt-3 space-y-2">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-5/6 rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            </div>

            <div className="mt-6 h-4 w-20 rounded bg-muted" />
          </div>
        )
      )}
    </div>
  );
}

export { FeatureCard };