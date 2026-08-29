"use client";

import React from "react";

export type WorkspaceHeaderStatus =
  | "active"
  | "draft"
  | "paused"
  | "archived"
  | "coming-soon";

export interface WorkspaceBreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface WorkspaceHeaderProps {
  title: string;
  description?: string;

  eyebrow?: string;

  status?: WorkspaceHeaderStatus;
  statusLabel?: string;

  icon?: React.ReactNode;

  breadcrumbs?: WorkspaceBreadcrumbItem[];

  actions?: React.ReactNode;
  children?: React.ReactNode;

  className?: string;
}

const statusStyles: Record<WorkspaceHeaderStatus, string> = {
  active:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  draft:
    "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  paused:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  archived:
    "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  "coming-soon":
    "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const defaultStatusLabels: Record<WorkspaceHeaderStatus, string> = {
  active: "Active",
  draft: "Draft",
  paused: "Paused",
  archived: "Archived",
  "coming-soon": "Coming soon",
};

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export default function WorkspaceHeader({
  title,
  description,
  eyebrow,
  status,
  statusLabel,
  icon,
  breadcrumbs = [],
  actions,
  children,
  className,
}: WorkspaceHeaderProps) {
  return (
    <header
      className={cn(
        "w-full border-b border-border bg-background",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {breadcrumbs.length > 0 ? (
          <nav
            aria-label="Breadcrumb"
            className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
          >
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;

              return (
                <React.Fragment
                  key={`${item.label}-${index}`}
                >
                  {index > 0 ? (
                    <span
                      aria-hidden="true"
                      className="select-none text-muted-foreground/50"
                    >
                      /
                    </span>
                  ) : null}

                  {item.href ? (
                    <a
                      href={item.href}
                      className={cn(
                        "transition-colors hover:text-foreground",
                        isLast && "pointer-events-none text-foreground"
                      )}
                    >
                      {item.label}
                    </a>
                  ) : item.onClick ? (
                    <button
                      type="button"
                      onClick={item.onClick}
                      className={cn(
                        "transition-colors hover:text-foreground",
                        isLast && "cursor-default text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        isLast
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        ) : null}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {icon ? (
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center",
                  "rounded-2xl border border-border bg-muted",
                  "text-foreground shadow-sm"
                )}
              >
                {icon}
              </div>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                {eyebrow ? (
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {eyebrow}
                  </span>
                ) : null}

                {status ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1",
                      "text-xs font-medium",
                      statusStyles[status]
                    )}
                  >
                    <span
                      className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"
                      aria-hidden="true"
                    />

                    {statusLabel ?? defaultStatusLabels[status]}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>

              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {description}
                </p>
              ) : null}

              {children ? (
                <div className="mt-4">
                  {children}
                </div>
              ) : null}
            </div>
          </div>

          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export interface WorkspaceHeaderActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function WorkspaceHeaderActions({
  children,
  className,
}: WorkspaceHeaderActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface WorkspaceHeaderMetaProps {
  children: React.ReactNode;
  className?: string;
}

export function WorkspaceHeaderMeta({
  children,
  className,
}: WorkspaceHeaderMetaProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}