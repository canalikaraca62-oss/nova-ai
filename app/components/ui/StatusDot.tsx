"use client";

import { forwardRef, type HTMLAttributes } from "react";

/* ==================================================
   TYPES
================================================== */

export type StatusDotStatus =
  | "online"
  | "offline"
  | "away"
  | "busy"
  | "idle"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

export type StatusDotSize =
  | "xs"
  | "sm"
  | "md"
  | "lg";

export type StatusDotProps =
  HTMLAttributes<HTMLSpanElement> & {
    status?: StatusDotStatus;
    size?: StatusDotSize;
    pulse?: boolean;
    label?: string;
  };

/* ==================================================
   STATUS CONFIG
================================================== */

const STATUS_DOT_STATUS_CLASSES: Record<
  StatusDotStatus,
  string
> = {
  online: "bg-emerald-500",
  offline: "bg-zinc-400",
  away: "bg-amber-500",
  busy: "bg-red-500",
  idle: "bg-sky-500",

  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-muted-foreground",
};

/* ==================================================
   SIZE CONFIG
================================================== */

const STATUS_DOT_SIZE_CLASSES: Record<
  StatusDotSize,
  string
> = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

/* ==================================================
   STATUS DOT
================================================== */

const StatusDot = forwardRef<
  HTMLSpanElement,
  StatusDotProps
>(function StatusDot(
  {
    status = "neutral",
    size = "md",
    pulse = false,
    label,
    className = "",
    ...props
  },
  ref
) {
  const accessibleLabel =
    label ?? status;

  return (
    <span
      ref={ref}
      role="status"
      aria-label={accessibleLabel}
      className={[
        "inline-flex shrink-0",
        STATUS_DOT_SIZE_CLASSES[size],
        "rounded-full",
        STATUS_DOT_STATUS_CLASSES[status],
        pulse ? "animate-pulse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});

StatusDot.displayName = "StatusDot";

export default StatusDot;

/* ==================================================
   STATUS DOT WITH LABEL
================================================== */

export type StatusDotLabelProps =
  HTMLAttributes<HTMLDivElement> & {
    status?: StatusDotStatus;
    size?: StatusDotSize;
    pulse?: boolean;
    children?: React.ReactNode;
    dotClassName?: string;
    labelClassName?: string;
  };

export const StatusDotLabel = forwardRef<
  HTMLDivElement,
  StatusDotLabelProps
>(function StatusDotLabel(
  {
    status = "neutral",
    size = "md",
    pulse = false,
    children,
    dotClassName = "",
    labelClassName = "",
    className = "",
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={[
        "inline-flex items-center gap-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <StatusDot
        status={status}
        size={size}
        pulse={pulse}
        aria-hidden="true"
        className={dotClassName}
      />

      {children ? (
        <span
          className={[
            "text-sm text-foreground",
            labelClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </span>
      ) : null}
    </div>
  );
});

StatusDotLabel.displayName =
  "StatusDotLabel";

/* ==================================================
   PRESENCE DOT
   Avatar, user list and workspace presence
================================================== */

export type PresenceStatus =
  | "online"
  | "offline"
  | "away"
  | "busy";

export type PresenceDotProps =
  Omit<
    StatusDotProps,
    "status"
  > & {
    status?: PresenceStatus;
  };

export const PresenceDot = forwardRef<
  HTMLSpanElement,
  PresenceDotProps
>(function PresenceDot(
  {
    status = "offline",
    ...props
  },
  ref
) {
  return (
    <StatusDot
      ref={ref}
      status={status}
      {...props}
    />
  );
});

PresenceDot.displayName =
  "PresenceDot";