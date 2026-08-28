"use client";

import React, {
  useMemo,
  useState,
} from "react";

export type UsageMeterStatus =
  | "normal"
  | "warning"
  | "critical"
  | "unlimited";

export type UsageMeterProps = {
  title: string;

  used?: number;

  limit?: number | null;

  unit?: string;

  description?: string;

  icon?: React.ReactNode;

  resetDate?: string | Date;

  showPercentage?: boolean;

  showValues?: boolean;

  showDetails?: boolean;

  warningThreshold?: number;

  criticalThreshold?: number;

  onUpgrade?: () => void;

  upgradeLabel?: string;

  className?: string;
};

function cn(
  ...classes: Array<
    string | undefined | null | false
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

function formatNumber(
  value: number
) {
  try {
    return new Intl.NumberFormat(
      "tr-TR"
    ).format(value);
  } catch {
    return String(value);
  }
}

function formatResetDate(
  value?: string | Date
) {
  if (!value) {
    return null;
  }

  try {
    const date =
      typeof value === "string"
        ? new Date(value)
        : value;

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    ).format(date);
  } catch {
    return null;
  }
}

export default function UsageMeter({
  title,

  used = 0,

  limit = null,

  unit = "",

  description,

  icon,

  resetDate,

  showPercentage = true,

  showValues = true,

  showDetails = true,

  warningThreshold = 80,

  criticalThreshold = 95,

  onUpgrade,

  upgradeLabel = "Upgrade plan",

  className,
}: UsageMeterProps) {
  const [
    expanded,
    setExpanded,
  ] = useState(false);

  const safeUsed =
    Math.max(0, used);

  const isUnlimited =
    limit === null ||
    limit === undefined ||
    limit <= 0;

  const percentage =
    useMemo(() => {
      if (isUnlimited) {
        return 0;
      }

      return Math.min(
        100,
        Math.max(
          0,
          (safeUsed / limit) * 100
        )
      );
    }, [
      safeUsed,
      limit,
      isUnlimited,
    ]);

  const status: UsageMeterStatus =
    useMemo(() => {
      if (isUnlimited) {
        return "unlimited";
      }

      if (
        percentage >=
        criticalThreshold
      ) {
        return "critical";
      }

      if (
        percentage >=
        warningThreshold
      ) {
        return "warning";
      }

      return "normal";
    }, [
      percentage,
      warningThreshold,
      criticalThreshold,
      isUnlimited,
    ]);

  const remaining =
    !isUnlimited &&
    limit !== null
      ? Math.max(
          0,
          limit - safeUsed
        )
      : null;

  const resetLabel =
    formatResetDate(
      resetDate
    );

  const statusLabel =
    status === "unlimited"
      ? "Unlimited"
      : status === "critical"
        ? "Limit almost reached"
        : status === "warning"
          ? "High usage"
          : "Healthy usage";

  const progressClass =
    status === "critical"
      ? "bg-red-500"
      : status === "warning"
        ? "bg-amber-500"
        : status === "unlimited"
          ? "bg-violet-500"
          : "bg-emerald-500";

  const badgeClass =
    status === "critical"
      ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
      : status === "warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : status === "unlimited"
          ? "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

  const shouldSuggestUpgrade =
    !isUnlimited &&
    percentage >=
      warningThreshold;

  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-950 sm:p-6",
        className
      )}
    >
      {/* HEADER */}

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              {icon}
            </div>
          )}

          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-zinc-950 dark:text-white">
              {title}
            </h3>

            {description && (
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            )}
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
            badgeClass
          )}
        >
          {statusLabel}
        </span>
      </div>

      {/* VALUES */}

      {showValues && (
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                {formatNumber(
                  safeUsed
                )}
              </span>

              <span className="text-sm font-medium text-zinc-500">
                {unit}
              </span>
            </div>

            {!isUnlimited && (
              <p className="mt-1 text-xs text-zinc-500">
                of{" "}
                {formatNumber(
                  limit ?? 0
                )}{" "}
                {unit}
              </p>
            )}

            {isUnlimited && (
              <p className="mt-1 text-xs text-violet-600 dark:text-violet-400">
                No usage limit
              </p>
            )}
          </div>

          {showPercentage &&
            !isUnlimited && (
              <div className="text-right">
                <div className="text-2xl font-bold text-zinc-950 dark:text-white">
                  {Math.round(
                    percentage
                  )}
                  %
                </div>

                <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  used
                </p>
              </div>
            )}

          {isUnlimited &&
            showPercentage && (
              <div className="text-right">
                <div className="text-lg font-bold text-violet-600 dark:text-violet-400">
                  ∞
                </div>

                <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  unlimited
                </p>
              </div>
            )}
        </div>
      )}

      {/* PROGRESS */}

      <div className="mt-5">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              progressClass
            )}
            style={{
              width: isUnlimited
                ? "100%"
                : `${percentage}%`,
            }}
            aria-valuemin={0}
            aria-valuemax={
              limit ?? 100
            }
            aria-valuenow={
              safeUsed
            }
            role="progressbar"
          />
        </div>

        {!isUnlimited &&
          remaining !== null && (
            <div className="mt-2 flex justify-between gap-4 text-[11px] text-zinc-500">
              <span>
                {formatNumber(
                  remaining
                )}{" "}
                {unit} remaining
              </span>

              <span>
                {Math.round(
                  percentage
                )}
                % used
              </span>
            </div>
          )}
      </div>

      {/* ALERT */}

      {shouldSuggestUpgrade && (
        <div
          className={cn(
            "mt-5 rounded-xl border p-4",
            status === "critical"
              ? "border-red-500/20 bg-red-500/5"
              : "border-amber-500/20 bg-amber-500/5"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className={cn(
                  "text-sm font-bold",
                  status === "critical"
                    ? "text-red-700 dark:text-red-400"
                    : "text-amber-700 dark:text-amber-400"
                )}
              >
                {status ===
                "critical"
                  ? "You are close to your limit."
                  : "Your usage is growing."}
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                Upgrade your plan to
                unlock more capacity and
                avoid interruptions.
              </p>
            </div>

            {onUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                className="shrink-0 rounded-lg bg-zinc-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}

      {(showDetails ||
        resetLabel ||
        onUpgrade) && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            {resetLabel && (
              <p className="text-[11px] text-zinc-500">
                Usage resets on{" "}
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {resetLabel}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {showDetails && (
              <button
                type="button"
                onClick={() =>
                  setExpanded(
                    (
                      previous
                    ) =>
                      !previous
                  )
                }
                className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                {expanded
                  ? "Hide details"
                  : "View details"}
              </button>
            )}

            {onUpgrade &&
              !shouldSuggestUpgrade &&
              !isUnlimited && (
                <button
                  type="button"
                  onClick={
                    onUpgrade
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {upgradeLabel}
                </button>
              )}
          </div>
        </div>
      )}

      {/* DETAILS */}

      {expanded && (
        <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-xs dark:bg-zinc-900/50">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Used
              </p>

              <p className="mt-1 font-semibold text-zinc-950 dark:text-white">
                {formatNumber(
                  safeUsed
                )}{" "}
                {unit}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Limit
              </p>

              <p className="mt-1 font-semibold text-zinc-950 dark:text-white">
                {isUnlimited
                  ? "Unlimited"
                  : `${formatNumber(
                      limit ?? 0
                    )} ${unit}`}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Remaining
              </p>

              <p className="mt-1 font-semibold text-zinc-950 dark:text-white">
                {isUnlimited
                  ? "Unlimited"
                  : `${formatNumber(
                      remaining ?? 0
                    )} ${unit}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}