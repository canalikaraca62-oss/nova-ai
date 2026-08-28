"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { Loader2 } from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type IconButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success"
  | "warning";

export type IconButtonSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl";

export type IconButtonShape =
  | "rounded"
  | "square"
  | "circle";

export type IconButtonProps =
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "children"
  > & {
    icon: ReactNode;

    variant?: IconButtonVariant;

    size?: IconButtonSize;

    shape?: IconButtonShape;

    loading?: boolean;

    tooltip?: string;

    fullWidth?: boolean;
  };

/* ==================================================
   VARIANT CLASSES
================================================== */

export const ICON_BUTTON_VARIANT_CLASSES: Record<
  IconButtonVariant,
  string
> = {
  default:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",

  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",

  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80",

  outline:
    "border border-border bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",

  ghost:
    "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",

  destructive:
    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",

  success:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-600/90 dark:bg-emerald-500 dark:hover:bg-emerald-500/90",

  warning:
    "bg-amber-500 text-white shadow-sm hover:bg-amber-500/90",
};

/* ==================================================
   SIZE CLASSES
================================================== */

export const ICON_BUTTON_SIZE_CLASSES: Record<
  IconButtonSize,
  string
> = {
  xs: "h-7 w-7",
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

/* ==================================================
   ICON SIZE CLASSES
================================================== */

export const ICON_SIZE_CLASSES: Record<
  IconButtonSize,
  string
> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
};

/* ==================================================
   SHAPE CLASSES
================================================== */

export const ICON_BUTTON_SHAPE_CLASSES: Record<
  IconButtonShape,
  string
> = {
  rounded: "rounded-lg",
  square: "rounded-none",
  circle: "rounded-full",
};

/* ==================================================
   HELPERS
================================================== */

export function getIconButtonVariantClasses(
  variant: IconButtonVariant
): string {
  return (
    ICON_BUTTON_VARIANT_CLASSES[variant] ??
    ICON_BUTTON_VARIANT_CLASSES.default
  );
}

export function getIconButtonSizeClasses(
  size: IconButtonSize
): string {
  return (
    ICON_BUTTON_SIZE_CLASSES[size] ??
    ICON_BUTTON_SIZE_CLASSES.md
  );
}

export function getIconButtonShapeClasses(
  shape: IconButtonShape
): string {
  return (
    ICON_BUTTON_SHAPE_CLASSES[shape] ??
    ICON_BUTTON_SHAPE_CLASSES.rounded
  );
}

/* ==================================================
   MAIN ICON BUTTON
================================================== */

const IconButton = forwardRef<
  HTMLButtonElement,
  IconButtonProps
>(function IconButton(
  {
    icon,
    variant = "ghost",
    size = "md",
    shape = "rounded",
    loading = false,
    tooltip,
    fullWidth = false,
    className = "",
    disabled = false,
    type = "button",
    "aria-label": ariaLabel,
    ...props
  },
  ref
) {
  const isDisabled =
    disabled || loading;

  const accessibleLabel =
    ariaLabel ??
    tooltip ??
    "Button";

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-label={accessibleLabel}
      title={tooltip}
      className={[
        "inline-flex shrink-0 items-center justify-center",
        "transition-all duration-200",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-primary/30",
        "focus-visible:ring-offset-2",
        "disabled:pointer-events-none",
        "disabled:opacity-50",
        getIconButtonVariantClasses(
          variant
        ),
        getIconButtonSizeClasses(
          size
        ),
        getIconButtonShapeClasses(
          shape
        ),
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? (
        <Loader2
          className={[
            ICON_SIZE_CLASSES[size],
            "animate-spin",
          ].join(" ")}
          aria-hidden="true"
        />
      ) : (
        <span
          className={[
            "flex shrink-0 items-center justify-center",
            ICON_SIZE_CLASSES[size],
          ].join(" ")}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
    </button>
  );
});

IconButton.displayName =
  "IconButton";

export default IconButton;

/* ==================================================
   ICON BUTTON GROUP
================================================== */

export type IconButtonGroupProps = {
  children: ReactNode;

  className?: string;

  orientation?:
    | "horizontal"
    | "vertical";

  spacing?: "none" | "sm" | "md";
};

export function IconButtonGroup({
  children,
  className = "",
  orientation = "horizontal",
  spacing = "sm",
}: IconButtonGroupProps) {
  const spacingClasses = {
    none: "",
    sm:
      orientation === "horizontal"
        ? "gap-1"
        : "gap-1",
    md:
      orientation === "horizontal"
        ? "gap-2"
        : "gap-2",
  };

  return (
    <div
      className={[
        "inline-flex",
        orientation === "vertical"
          ? "flex-col"
          : "flex-row",
        spacingClasses[spacing],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/* ==================================================
   COMMON ICON BUTTON PROPS
================================================== */

export type CommonIconButtonProps =
  Omit<IconButtonProps, "icon">;

/* ==================================================
   FLOATING ICON BUTTON
================================================== */

export type FloatingIconButtonProps =
  CommonIconButtonProps & {
    icon: ReactNode;

    position?:
      | "bottom-right"
      | "bottom-left"
      | "top-right"
      | "top-left";
  };

export function FloatingIconButton({
  icon,
  position = "bottom-right",
  variant = "primary",
  size = "lg",
  shape = "circle",
  className = "",
  ...props
}: FloatingIconButtonProps) {
  const positionClasses = {
    "bottom-right":
      "fixed bottom-6 right-6",
    "bottom-left":
      "fixed bottom-6 left-6",
    "top-right":
      "fixed right-6 top-6",
    "top-left":
      "fixed left-6 top-6",
  };

  return (
    <IconButton
      {...props}
      icon={icon}
      variant={variant}
      size={size}
      shape={shape}
      className={[
        "z-40 shadow-lg hover:shadow-xl",
        positionClasses[position],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

/* ==================================================
   UTILITY ICON BUTTON
================================================== */

export type UtilityIconButtonProps =
  CommonIconButtonProps & {
    icon: ReactNode;
  };

export function UtilityIconButton({
  variant = "ghost",
  size = "md",
  shape = "rounded",
  ...props
}: UtilityIconButtonProps) {
  return (
    <IconButton
      {...props}
      variant={variant}
      size={size}
      shape={shape}
    />
  );
}