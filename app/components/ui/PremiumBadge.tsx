"use client";

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import {
  Crown,
  Gem,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type PremiumBadgeSize =
  | "xs"
  | "sm"
  | "md"
  | "lg";

export type PremiumBadgeVariant =
  | "default"
  | "gold"
  | "gradient"
  | "outline"
  | "subtle";

export type PremiumBadgeIcon =
  | "crown"
  | "gem"
  | "sparkles"
  | "star"
  | "zap"
  | "none";

export type PremiumBadgeProps =
  HTMLAttributes<HTMLSpanElement> & {
    children?: ReactNode;

    label?: ReactNode;

    size?: PremiumBadgeSize;

    variant?: PremiumBadgeVariant;

    icon?: PremiumBadgeIcon;

    showIcon?: boolean;

    pulse?: boolean;
  };

/* ==================================================
   SIZE CONFIG
================================================== */

const PREMIUM_BADGE_SIZE_CLASSES: Record<
  PremiumBadgeSize,
  {
    container: string;
    icon: string;
  }
> = {
  xs: {
    container:
      "gap-1 rounded-md px-1.5 py-0.5 text-[10px]",
    icon:
      "h-2.5 w-2.5",
  },

  sm: {
    container:
      "gap-1 rounded-md px-2 py-0.5 text-xs",
    icon:
      "h-3 w-3",
  },

  md: {
    container:
      "gap-1.5 rounded-lg px-2.5 py-1 text-xs",
    icon:
      "h-3.5 w-3.5",
  },

  lg: {
    container:
      "gap-2 rounded-xl px-3 py-1.5 text-sm",
    icon:
      "h-4 w-4",
  },
};

/* ==================================================
   VARIANT CONFIG
================================================== */

const PREMIUM_BADGE_VARIANT_CLASSES: Record<
  PremiumBadgeVariant,
  string
> = {
  default: [
    "border",
    "border-primary/20",
    "bg-primary/10",
    "text-primary",
  ].join(" "),

  gold: [
    "border",
    "border-amber-400/30",
    "bg-amber-500/10",
    "text-amber-700",
    "dark:text-amber-300",
  ].join(" "),

  gradient: [
    "border",
    "border-transparent",
    "bg-gradient-to-r",
    "from-violet-500",
    "via-fuchsia-500",
    "to-amber-400",
    "text-white",
    "shadow-sm",
  ].join(" "),

  outline: [
    "border",
    "border-primary/40",
    "bg-transparent",
    "text-primary",
  ].join(" "),

  subtle: [
    "border",
    "border-transparent",
    "bg-muted",
    "text-foreground",
  ].join(" "),
};

/* ==================================================
   ICON MAP
================================================== */

const PREMIUM_BADGE_ICONS: Record<
  Exclude<PremiumBadgeIcon, "none">,
  LucideIcon
> = {
  crown: Crown,
  gem: Gem,
  sparkles: Sparkles,
  star: Star,
  zap: Zap,
};

/* ==================================================
   HELPERS
================================================== */

export function getPremiumBadgeSizeClasses(
  size: PremiumBadgeSize
) {
  return PREMIUM_BADGE_SIZE_CLASSES[size];
}

export function getPremiumBadgeVariantClasses(
  variant: PremiumBadgeVariant
): string {
  return PREMIUM_BADGE_VARIANT_CLASSES[variant];
}

/* ==================================================
   MAIN PREMIUM BADGE
================================================== */

const PremiumBadge = forwardRef<
  HTMLSpanElement,
  PremiumBadgeProps
>(function PremiumBadge(
  {
    children,
    label = "Premium",
    size = "md",
    variant = "gold",
    icon = "crown",
    showIcon = true,
    pulse = false,
    className = "",
    ...props
  },
  ref
) {
  const sizeClasses =
    getPremiumBadgeSizeClasses(size);

  const variantClasses =
    getPremiumBadgeVariantClasses(
      variant
    );

  const Icon =
    icon !== "none"
      ? PREMIUM_BADGE_ICONS[icon]
      : null;

  const content =
    children ?? label;

  return (
    <span
      ref={ref}
      className={[
        "inline-flex",
        "items-center",
        "justify-center",
        "font-semibold",
        "leading-none",
        "whitespace-nowrap",
        "transition-all",
        "duration-200",
        sizeClasses.container,
        variantClasses,
        pulse ? "animate-pulse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {showIcon && Icon ? (
        <Icon
          className={[
            "shrink-0",
            sizeClasses.icon,
          ].join(" ")}
          aria-hidden="true"
        />
      ) : null}

      {content}
    </span>
  );
});

PremiumBadge.displayName =
  "PremiumBadge";

export default PremiumBadge;

/* ==================================================
   PLAN BADGE
================================================== */

export type PlanBadgeType =
  | "free"
  | "pro"
  | "premium"
  | "enterprise";

export type PlanBadgeProps =
  Omit<
    PremiumBadgeProps,
    "label" | "variant" | "icon"
  > & {
    plan: PlanBadgeType;
  };

const PLAN_BADGE_CONFIG: Record<
  PlanBadgeType,
  {
    label: string;
    variant: PremiumBadgeVariant;
    icon: PremiumBadgeIcon;
  }
> = {
  free: {
    label: "Free",
    variant: "subtle",
    icon: "none",
  },

  pro: {
    label: "Pro",
    variant: "default",
    icon: "zap",
  },

  premium: {
    label: "Premium",
    variant: "gold",
    icon: "crown",
  },

  enterprise: {
    label: "Enterprise",
    variant: "gradient",
    icon: "gem",
  },
};

export const PlanBadge = forwardRef<
  HTMLSpanElement,
  PlanBadgeProps
>(function PlanBadge(
  {
    plan,
    children,
    ...props
  },
  ref
) {
  const config =
    PLAN_BADGE_CONFIG[plan];

  return (
    <PremiumBadge
      ref={ref}
      {...props}
      label={
        children ??
        config.label
      }
      variant={
        config.variant
      }
      icon={
        config.icon
      }
      showIcon={
        props.showIcon ??
        config.icon !== "none"
      }
    />
  );
});

PlanBadge.displayName =
  "PlanBadge";

/* ==================================================
   PREMIUM INDICATOR
================================================== */

export type PremiumIndicatorProps =
  HTMLAttributes<HTMLSpanElement> & {
    size?: PremiumBadgeSize;

    label?: ReactNode;

    showLabel?: boolean;

    icon?: PremiumBadgeIcon;
  };

export const PremiumIndicator = forwardRef<
  HTMLSpanElement,
  PremiumIndicatorProps
>(function PremiumIndicator(
  {
    size = "sm",
    label = "Premium",
    showLabel = false,
    icon = "crown",
    className = "",
    ...props
  },
  ref
) {
  const sizeClasses =
    getPremiumBadgeSizeClasses(size);

  const Icon =
    icon !== "none"
      ? PREMIUM_BADGE_ICONS[icon]
      : null;

  return (
    <span
      ref={ref}
      title={
        typeof label === "string"
          ? label
          : "Premium"
      }
      className={[
        "inline-flex",
        "items-center",
        "justify-center",
        "text-amber-500",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {Icon ? (
        <Icon
          className={[
            "shrink-0",
            sizeClasses.icon,
          ].join(" ")}
          aria-hidden="true"
        />
      ) : null}

      {showLabel ? (
        <span className="ml-1.5 text-xs font-medium">
          {label}
        </span>
      ) : null}
    </span>
  );
});

PremiumIndicator.displayName =
  "PremiumIndicator";