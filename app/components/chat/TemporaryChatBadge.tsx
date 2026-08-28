"use client";

import { useMemo } from "react";
import {
  Clock3,
  Infinity,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

type TemporaryChatBadgeProps = {
  expiresAt?: string | Date | null;
  className?: string;
  compact?: boolean;
  showIcon?: boolean;
};

function formatRemainingTime(
  expiresAt?: string | Date | null
) {
  if (!expiresAt) {
    return null;
  }

  const expiry = new Date(expiresAt).getTime();

  if (Number.isNaN(expiry)) {
    return null;
  }

  const remaining = expiry - Date.now();

  if (remaining <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.floor(
    remaining / 1000
  );

  const days = Math.floor(
    totalSeconds / 86400
  );

  const hours = Math.floor(
    (totalSeconds % 86400) / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return "Less than 1m";
}

export default function TemporaryChatBadge({
  expiresAt = null,
  className = "",
  compact = false,
  showIcon = true,
}: TemporaryChatBadgeProps) {
  const remainingTime = useMemo(
    () => formatRemainingTime(expiresAt),
    [expiresAt]
  );

  const isExpired =
    remainingTime === "Expired";

  if (compact) {
    return (
      <div
        className={[
          "inline-flex items-center gap-1.5",
          "rounded-full border px-2.5 py-1",
          "text-xs font-medium transition-colors",
          isExpired
            ? "border-red-500/20 bg-red-500/10 text-red-400"
            : "border-amber-500/20 bg-amber-500/10 text-amber-300",
          className,
        ].join(" ")}
        title={
          isExpired
            ? "This temporary chat has expired"
            : remainingTime
              ? `Temporary chat · ${remainingTime} remaining`
              : "Temporary chat"
        }
      >
        {showIcon ? (
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
        ) : null}

        <span>
          {isExpired
            ? "Expired"
            : remainingTime
              ? remainingTime
              : "Temporary"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={[
        "group inline-flex items-center gap-2.5",
        "rounded-xl border px-3 py-2",
        "backdrop-blur-sm transition-all duration-200",
        isExpired
          ? [
              "border-red-500/20",
              "bg-red-500/[0.07]",
              "text-red-300",
            ].join(" ")
          : [
              "border-amber-500/20",
              "bg-amber-500/[0.07]",
              "text-amber-100",
              "hover:border-amber-400/30",
              "hover:bg-amber-500/[0.1]",
            ].join(" "),
        className,
      ].join(" ")}
    >
      {showIcon ? (
        <div
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center",
            "rounded-lg border",
            isExpired
              ? [
                  "border-red-500/20",
                  "bg-red-500/10",
                  "text-red-400",
                ].join(" ")
              : [
                  "border-amber-500/20",
                  "bg-amber-500/10",
                  "text-amber-300",
                ].join(" "),
          ].join(" ")}
        >
          {isExpired ? (
            <LockKeyhole className="h-4 w-4" />
          ) : (
            <Clock3 className="h-4 w-4" />
          )}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">
            Temporary Chat
          </span>

          {!isExpired ? (
            <Sparkles className="h-3.5 w-3.5 text-amber-300/80" />
          ) : null}
        </div>

        <span className="text-xs text-muted-foreground">
          {isExpired
            ? "This conversation is no longer active."
            : remainingTime
              ? `${remainingTime} remaining`
              : "This conversation is not permanently saved."}
        </span>
      </div>

      {!expiresAt && !isExpired ? (
        <Infinity className="ml-1 h-4 w-4 shrink-0 text-muted-foreground/70" />
      ) : null}
    </div>
  );
}

export type {
  TemporaryChatBadgeProps,
};