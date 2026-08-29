"use client";

import React from "react";

export type WorkspaceType =
  | "analyze"
  | "automate"
  | "build"
  | "code"
  | "create"
  | "research"
  | "custom";

export type WorkspaceStatus =
  | "active"
  | "inactive"
  | "coming-soon"
  | "locked";

export interface WorkspaceCardProps {
  id: string;
  title: string;
  description: string;

  type?: WorkspaceType;
  status?: WorkspaceStatus;

  icon?: React.ReactNode;
  badge?: string;

  image?: string;
  imageAlt?: string;

  active?: boolean;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;

  stats?: {
    label: string;
    value: string | number;
  }[];

  tags?: string[];

  onClick?: (id: string) => void;

  className?: string;
}

const typeLabels: Record<WorkspaceType, string> = {
  analyze: "Analyze",
  automate: "Automate",
  build: "Build",
  code: "Code",
  create: "Create",
  research: "Research",
  custom: "Workspace",
};

const statusLabels: Record<WorkspaceStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  "coming-soon": "Coming soon",
  locked: "Locked",
};

function joinClasses(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export default function WorkspaceCard({
  id,
  title,
  description,
  type = "custom",
  status = "active",
  icon,
  badge,
  image,
  imageAlt,
  active = false,
  selected = false,
  disabled = false,
  loading = false,
  stats = [],
  tags = [],
  onClick,
  className,
}: WorkspaceCardProps) {
  const isDisabled =
    disabled ||
    loading ||
    status === "locked" ||
    status === "coming-soon";

  const isInteractive = typeof onClick === "function" && !isDisabled;

  const handleClick = (): void => {
    if (!isInteractive || !onClick) {
      return;
    }

    onClick(id);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ): void => {
    if (!isInteractive) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      onClick={isInteractive ? handleClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={joinClasses(
        "group relative overflow-hidden rounded-2xl border",
        "border-border bg-card text-card-foreground",
        "transition-all duration-200",
        isInteractive &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg",
        selected &&
          "border-primary ring-2 ring-primary/20",
        active &&
          !selected &&
          "border-primary/50",
        isDisabled &&
          "cursor-not-allowed opacity-60",
        loading && "animate-pulse",
        className
      )}
    >
      {image ? (
        <div className="relative h-36 w-full overflow-hidden bg-muted">
          <img
            src={image}
            alt={imageAlt ?? title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        </div>
      ) : null}

      <div className="relative p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <div
                className={joinClasses(
                  "flex h-11 w-11 shrink-0 items-center justify-center",
                  "rounded-xl border border-border bg-muted",
                  "text-foreground"
                )}
              >
                {icon}
              </div>
            ) : null}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold">
                  {title}
                </h3>

                {active ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                    aria-label="Active workspace"
                  />
                ) : null}
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {typeLabels[type]}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {badge ? (
              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {badge}
              </span>
            ) : null}

            {status !== "active" ? (
              <span
                className={joinClasses(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  status === "inactive" &&
                    "bg-muted text-muted-foreground",
                  status === "coming-soon" &&
                    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  status === "locked" &&
                    "bg-red-500/10 text-red-600 dark:text-red-400"
                )}
              >
                {statusLabels[status]}
              </span>
            ) : null}
          </div>
        </div>

        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>

        {tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={`${id}-${tag}`}
                className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {stats.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
            {stats.map((stat) => (
              <div key={`${id}-${stat.label}`}>
                <p className="text-xs text-muted-foreground">
                  {stat.label}
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
              aria-label="Loading workspace"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function WorkspaceCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={joinClasses(
        "animate-pulse rounded-2xl border border-border bg-card p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-muted" />

          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        </div>

        <div className="h-6 w-16 rounded-full bg-muted" />
      </div>

      <div className="mt-5 space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="mt-2 h-4 w-10 rounded bg-muted" />
        </div>

        <div>
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="mt-2 h-4 w-10 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function WorkspaceCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClasses(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}