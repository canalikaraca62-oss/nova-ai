"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  ArrowLeft,
  ChevronRight,
  Home,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type PageHeaderBreadcrumb = {
  label: string;
  href?: string;
};

export type PageHeaderAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export type PageHeaderProps = {
  title: string;
  description?: string;

  breadcrumbs?: PageHeaderBreadcrumb[];

  backHref?: string;
  backLabel?: string;
  onBack?: () => void;

  icon?: ReactNode;

  actions?: ReactNode;

  primaryAction?: PageHeaderAction;

  children?: ReactNode;

  className?: string;
};

/* ==================================================
   BREADCRUMBS
================================================== */

function Breadcrumbs({
  items,
}: {
  items: PageHeaderBreadcrumb[];
}): ReactNode {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 overflow-x-auto text-xs text-muted-foreground"
    >
      <Link
        href="/"
        className="flex shrink-0 items-center transition-colors hover:text-foreground"
        aria-label="Home"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>

      {items.map(
        (
          item: PageHeaderBreadcrumb,
          index: number
        ) => {
          const isLast: boolean =
            index === items.length - 1;

          return (
            <div
              key={
                item.href ??
                `${item.label}-${index}`
              }
              className="flex shrink-0 items-center gap-1.5"
            >
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />

              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="max-w-[140px] truncate transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={[
                    "max-w-[160px] truncate",
                    isLast
                      ? "font-medium text-foreground"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {item.label}
                </span>
              )}
            </div>
          );
        }
      )}
    </nav>
  );
}

/* ==================================================
   BACK BUTTON
================================================== */

function BackButton({
  backHref,
  backLabel,
  onBack,
}: {
  backHref?: string;
  backLabel: string;
  onBack?: () => void;
}): ReactNode {
  const content: ReactNode = (
    <>
      <ArrowLeft className="h-4 w-4" />

      <span>{backLabel}</span>
    </>
  );

  const className =
    "inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  if (backHref) {
    return (
      <Link
        href={backHref}
        className={className}
      >
        {content}
      </Link>
    );
  }

  if (onBack) {
    return (
      <button
        type="button"
        onClick={onBack}
        className={className}
      >
        {content}
      </button>
    );
  }

  return null;
}

/* ==================================================
   PRIMARY ACTION
================================================== */

function PrimaryAction({
  action,
}: {
  action: PageHeaderAction;
}): ReactNode {
  const content: ReactNode = (
    <>
      {action.icon ? (
        <span className="flex h-4 w-4 items-center justify-center">
          {action.icon}
        </span>
      ) : null}

      <span>{action.label}</span>
    </>
  );

  const className = [
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity",
    action.disabled
      ? "pointer-events-none opacity-50"
      : "hover:opacity-90 active:opacity-80",
  ]
    .filter(Boolean)
    .join(" ");

  if (action.href) {
    return (
      <Link
        href={action.href}
        className={className}
        aria-disabled={
          action.disabled
        }
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={action.onClick}
      className={className}
    >
      {content}
    </button>
  );
}

/* ==================================================
   PAGE HEADER
================================================== */

export default function PageHeader({
  title,
  description,

  breadcrumbs,

  backHref,
  backLabel = "Back",
  onBack,

  icon,

  actions,

  primaryAction,

  children,

  className = "",
}: PageHeaderProps): ReactNode {
  const hasBackButton: boolean =
    Boolean(backHref || onBack);

  const hasTopRow: boolean =
    hasBackButton ||
    Boolean(
      breadcrumbs &&
      breadcrumbs.length > 0
    );

  const hasActions: boolean =
    Boolean(actions || primaryAction);

  return (
    <header
      className={[
        "w-full border-b border-border/60 bg-background",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        {hasTopRow ? (
          <div className="flex min-h-9 items-center gap-3">
            {hasBackButton ? (
              <BackButton
                backHref={backHref}
                backLabel={backLabel}
                onBack={onBack}
              />
            ) : null}

            {breadcrumbs &&
            breadcrumbs.length > 0 ? (
              <Breadcrumbs
                items={breadcrumbs}
              />
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted">
                {icon}
              </div>
            ) : null}

            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {title}
              </h1>

              {description ? (
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {hasActions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}

              {primaryAction ? (
                <PrimaryAction
                  action={primaryAction}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {children ? (
          <div className="w-full">
            {children}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export {
  BackButton,
  Breadcrumbs,
  PrimaryAction,
};