"use client";

import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Crown,
  Info,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline"
  | "muted"
  | "premium";

export type BadgeSize =
  | "xs"
  | "sm"
  | "md"
  | "lg";

export type BadgeStatus =
  | "online"
  | "offline"
  | "pending"
  | "processing"
  | "success"
  | "warning"
  | "error"
  | "none";

export type BadgeProps =
  HTMLAttributes<HTMLSpanElement> & {
    variant?: BadgeVariant;

    size?: BadgeSize;

    status?: BadgeStatus;

    icon?: ReactNode;

    iconPosition?: "left" | "right";

    dot?: boolean;

    removable?: boolean;

    onRemove?: () => void;

    rounded?: boolean;
  };

export type BadgeButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: BadgeVariant;

    size?: BadgeSize;

    status?: BadgeStatus;

    icon?: ReactNode;

    iconPosition?: "left" | "right";

    dot?: boolean;

    rounded?: boolean;
  };

/* ==================================================
   VARIANT CLASSES
================================================== */

export const BADGE_VARIANT_CLASSES: Record<
  BadgeVariant,
  string
> = {
  default:
    "border-border/60 bg-background text-foreground",

  primary:
    "border-primary/20 bg-primary/10 text-primary",

  secondary:
    "border-secondary bg-secondary text-secondary-foreground",

  success:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",

  warning:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",

  danger:
    "border-destructive/20 bg-destructive/10 text-destructive",

  info:
    "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",

  outline:
    "border-border bg-transparent text-foreground",

  muted:
    "border-transparent bg-muted text-muted-foreground",

  premium:
    "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

/* ==================================================
   SIZE CLASSES
================================================== */

export const BADGE_SIZE_CLASSES: Record<
  BadgeSize,
  string
> = {
  xs: "min-h-5 gap-1 px-1.5 py-0 text-[10px]",

  sm: "min-h-6 gap-1.5 px-2 py-0.5 text-xs",

  md: "min-h-7 gap-1.5 px-2.5 py-1 text-xs",

  lg: "min-h-8 gap-2 px-3 py-1 text-sm",
};

/* ==================================================
   ICON SIZE CLASSES
================================================== */

export const BADGE_ICON_SIZE_CLASSES: Record<
  BadgeSize,
  string
> = {
  xs: "[&>svg]:h-2.5 [&>svg]:w-2.5",

  sm: "[&>svg]:h-3 [&>svg]:w-3",

  md: "[&>svg]:h-3.5 [&>svg]:w-3.5",

  lg: "[&>svg]:h-4 [&>svg]:w-4",
};

/* ==================================================
   DOT CLASSES
================================================== */

export const BADGE_DOT_CLASSES: Record<
  BadgeVariant,
  string
> = {
  default:
    "bg-foreground",

  primary:
    "bg-primary",

  secondary:
    "bg-secondary-foreground",

  success:
    "bg-emerald-500",

  warning:
    "bg-amber-500",

  danger:
    "bg-destructive",

  info:
    "bg-blue-500",

  outline:
    "bg-muted-foreground",

  muted:
    "bg-muted-foreground",

  premium:
    "bg-violet-500",
};

/* ==================================================
   STATUS CONFIG
================================================== */

export const BADGE_STATUS_CONFIG: Record<
  BadgeStatus,
  {
    variant: BadgeVariant;
    label: string;
    dotClassName: string;
  }
> = {
  online: {
    variant: "success",
    label: "Online",
    dotClassName:
      "bg-emerald-500",
  },

  offline: {
    variant: "muted",
    label: "Offline",
    dotClassName:
      "bg-muted-foreground",
  },

  pending: {
    variant: "warning",
    label: "Pending",
    dotClassName:
      "bg-amber-500",
  },

  processing: {
    variant: "info",
    label: "Processing",
    dotClassName:
      "bg-blue-500",
  },

  success: {
    variant: "success",
    label: "Success",
    dotClassName:
      "bg-emerald-500",
  },

  warning: {
    variant: "warning",
    label: "Warning",
    dotClassName:
      "bg-amber-500",
  },

  error: {
    variant: "danger",
    label: "Error",
    dotClassName:
      "bg-destructive",
  },

  none: {
    variant: "default",
    label: "",
    dotClassName:
      "hidden",
  },
};

/* ==================================================
   HELPERS
================================================== */

export function getBadgeVariantClasses(
  variant: BadgeVariant
): string {
  return (
    BADGE_VARIANT_CLASSES[
      variant
    ] ??
    BADGE_VARIANT_CLASSES.default
  );
}

export function getBadgeSizeClasses(
  size: BadgeSize
): string {
  return (
    BADGE_SIZE_CLASSES[size] ??
    BADGE_SIZE_CLASSES.md
  );
}

export function getBadgeDotClasses(
  variant: BadgeVariant
): string {
  return (
    BADGE_DOT_CLASSES[variant] ??
    BADGE_DOT_CLASSES.default
  );
}

export function getBadgeStatus(
  status: BadgeStatus
): {
  variant: BadgeVariant;
  label: string;
  dotClassName: string;
} {
  return (
    BADGE_STATUS_CONFIG[status] ??
    BADGE_STATUS_CONFIG.none
  );
}

/* ==================================================
   BADGE
================================================== */

export default function Badge({
  children,
  variant = "default",
  size = "md",
  status = "none",
  icon,
  iconPosition = "left",
  dot = false,
  removable = false,
  onRemove,
  rounded = true,
  className = "",
  ...props
}: BadgeProps): ReactNode {
  const statusConfig =
    getBadgeStatus(status);

  const finalVariant =
    status !== "none"
      ? statusConfig.variant
      : variant;

  const shouldShowDot =
    dot || status !== "none";

  const displayContent =
    children ??
    (status !== "none"
      ? statusConfig.label
      : null);

  return (
    <span
      {...props}
      className={[
        "inline-flex shrink-0 items-center justify-center border font-medium leading-none",
        getBadgeVariantClasses(
          finalVariant
        ),
        getBadgeSizeClasses(
          size
        ),
        BADGE_ICON_SIZE_CLASSES[
          size
        ],
        rounded
          ? "rounded-full"
          : "rounded-md",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {shouldShowDot ? (
        <span
          className={[
            "h-1.5 w-1.5 shrink-0 rounded-full",
            status !== "none"
              ? statusConfig.dotClassName
              : getBadgeDotClasses(
                  finalVariant
                ),
            status === "processing"
              ? "animate-pulse"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ) : null}

      {icon &&
      iconPosition === "left" ? (
        <span className="flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}

      {displayContent ? (
        <span className="truncate">
          {displayContent}
        </span>
      ) : null}

      {icon &&
      iconPosition === "right" ? (
        <span className="flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}

      {removable ? (
        <button
          type="button"
          onClick={(
            event
          ): void => {
            event.stopPropagation();

            onRemove?.();
          }}
          className="ml-0.5 inline-flex shrink-0 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
          aria-label="Remove badge"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />

            <path d="m6 6 12 12" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}

/* ==================================================
   BADGE BUTTON
================================================== */

export function BadgeButton({
  children,
  variant = "default",
  size = "md",
  status = "none",
  icon,
  iconPosition = "left",
  dot = false,
  rounded = true,
  className = "",
  type = "button",
  ...props
}: BadgeButtonProps): ReactNode {
  const statusConfig =
    getBadgeStatus(status);

  const finalVariant =
    status !== "none"
      ? statusConfig.variant
      : variant;

  const shouldShowDot =
    dot || status !== "none";

  const displayContent =
    children ??
    (status !== "none"
      ? statusConfig.label
      : null);

  return (
    <button
      {...props}
      type={type}
      className={[
        "inline-flex shrink-0 items-center justify-center border font-medium leading-none transition-opacity",
        "hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:pointer-events-none disabled:opacity-50",
        getBadgeVariantClasses(
          finalVariant
        ),
        getBadgeSizeClasses(
          size
        ),
        BADGE_ICON_SIZE_CLASSES[
          size
        ],
        rounded
          ? "rounded-full"
          : "rounded-md",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {shouldShowDot ? (
        <span
          className={[
            "h-1.5 w-1.5 shrink-0 rounded-full",
            status !== "none"
              ? statusConfig.dotClassName
              : getBadgeDotClasses(
                  finalVariant
                ),
            status === "processing"
              ? "animate-pulse"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ) : null}

      {icon &&
      iconPosition === "left" ? (
        <span className="flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}

      {displayContent ? (
        <span className="truncate">
          {displayContent}
        </span>
      ) : null}

      {icon &&
      iconPosition === "right" ? (
        <span className="flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}
    </button>
  );
}

/* ==================================================
   STATUS BADGE
================================================== */

export function StatusBadge({
  status,
  children,
  size = "md",
  className = "",
}: {
  status: BadgeStatus;

  children?: ReactNode;

  size?: BadgeSize;

  className?: string;
}): ReactNode {
  return (
    <Badge
      status={status}
      size={size}
      dot
      className={className}
    >
      {children}
    </Badge>
  );
}

/* ==================================================
   PRESET BADGES
================================================== */

export function SuccessBadge({
  children = "Success",
  ...props
}: Omit<
  BadgeProps,
  "variant"
>): ReactNode {
  return (
    <Badge
      {...props}
      variant="success"
      icon={
        props.icon ?? (
          <CheckCircle2 />
        )
      }
    >
      {children}
    </Badge>
  );
}

export function WarningBadge({
  children = "Warning",
  ...props
}: Omit<
  BadgeProps,
  "variant"
>): ReactNode {
  return (
    <Badge
      {...props}
      variant="warning"
      icon={
        props.icon ?? (
          <AlertCircle />
        )
      }
    >
      {children}
    </Badge>
  );
}

export function ErrorBadge({
  children = "Error",
  ...props
}: Omit<
  BadgeProps,
  "variant"
>): ReactNode {
  return (
    <Badge
      {...props}
      variant="danger"
      icon={
        props.icon ?? (
          <XCircle />
        )
      }
    >
      {children}
    </Badge>
  );
}

export function InfoBadge({
  children = "Info",
  ...props
}: Omit<
  BadgeProps,
  "variant"
>): ReactNode {
  return (
    <Badge
      {...props}
      variant="info"
      icon={
        props.icon ?? (
          <Info />
        )
      }
    >
      {children}
    </Badge>
  );
}

export function PremiumBadge({
  children = "Premium",
  ...props
}: Omit<
  BadgeProps,
  "variant"
>): ReactNode {
  return (
    <Badge
      {...props}
      variant="premium"
      icon={
        props.icon ?? (
          <Crown />
        )
      }
    >
      {children}
    </Badge>
  );
}

export function NewBadge({
  children = "New",
  ...props
}: Omit<
  BadgeProps,
  "variant"
>): ReactNode {
  return (
    <Badge
      {...props}
      variant="primary"
      icon={
        props.icon ?? (
          <Sparkles />
        )
      }
    >
      {children}
    </Badge>
  );
}

export function LoadingBadge({
  children = "Processing",
  ...props
}: Omit<
  BadgeProps,
  "variant"
>): ReactNode {
  return (
    <Badge
      {...props}
      variant="info"
      icon={
        props.icon ?? (
          <Loader2 className="animate-spin" />
        )
      }
    >
      {children}
    </Badge>
  );
}

export function PendingBadge({
  children = "Pending",
  ...props
}: Omit<
  BadgeProps,
  "variant"
>): ReactNode {
  return (
    <Badge
      {...props}
      variant="warning"
      icon={
        props.icon ?? (
          <Clock3 />
        )
      }
    >
      {children}
    </Badge>
  );
}

export function CompletedBadge({
  children = "Completed",
  ...props
}: Omit<
  BadgeProps,
  "variant"
>): ReactNode {
  return (
    <Badge
      {...props}
      variant="success"
      icon={
        props.icon ?? (
          <Check />
        )
      }
    >
      {children}
    </Badge>
  );
}