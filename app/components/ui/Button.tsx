"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useState,
} from "react";

import {
  Check,
  ChevronDown,
  Loader2,
  Plus,
  X,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success"
  | "warning"
  | "link";

export type ButtonSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "icon"
  | "icon-sm"
  | "icon-lg";

export type ButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    fullWidth?: boolean;
    rounded?: boolean;
    loadingText?: ReactNode;
  };

/* ==================================================
   VARIANT CLASSES
================================================== */

export const BUTTON_VARIANT_CLASSES: Record<
  ButtonVariant,
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

  link:
    "bg-transparent text-primary underline-offset-4 hover:underline",
};

/* ==================================================
   SIZE CLASSES
================================================== */

export const BUTTON_SIZE_CLASSES: Record<
  ButtonSize,
  string
> = {
  xs: "h-7 gap-1 px-2 text-xs",

  sm: "h-8 gap-1.5 px-3 text-xs",

  md: "h-9 gap-2 px-4 text-sm",

  lg: "h-10 gap-2 px-5 text-sm",

  xl: "h-12 gap-2.5 px-6 text-base",

  icon:
    "h-9 w-9 p-0",

  "icon-sm":
    "h-8 w-8 p-0",

  "icon-lg":
    "h-11 w-11 p-0",
};

/* ==================================================
   HELPERS
================================================== */

export function getButtonVariantClasses(
  variant: ButtonVariant
): string {
  return (
    BUTTON_VARIANT_CLASSES[variant] ??
    BUTTON_VARIANT_CLASSES.default
  );
}

export function getButtonSizeClasses(
  size: ButtonSize
): string {
  return (
    BUTTON_SIZE_CLASSES[size] ??
    BUTTON_SIZE_CLASSES.md
  );
}

/* ==================================================
   MAIN BUTTON
================================================== */

const Button = forwardRef<
  HTMLButtonElement,
  ButtonProps
>(function Button(
  {
    children,
    variant = "default",
    size = "md",
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    rounded = false,
    loadingText,
    className = "",
    disabled = false,
    type = "button",
    ...props
  },
  ref
) {
  const isDisabled =
    disabled || loading;

  const isIconButton =
    size === "icon" ||
    size === "icon-sm" ||
    size === "icon-lg";

  const displayContent =
    loading && loadingText !== undefined
      ? loadingText
      : children;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={[
        "inline-flex shrink-0 items-center justify-center font-medium transition-colors duration-200",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-primary/30",
        "focus-visible:ring-offset-2",
        "disabled:pointer-events-none",
        "disabled:opacity-50",
        getButtonVariantClasses(variant),
        getButtonSizeClasses(size),
        fullWidth ? "w-full" : "",
        rounded
          ? "rounded-full"
          : "rounded-lg",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin"
          aria-hidden="true"
        />
      ) : leftIcon ? (
        <span className="flex shrink-0 items-center">
          {leftIcon}
        </span>
      ) : null}

      {!isIconButton &&
      displayContent !== undefined &&
      displayContent !== null ? (
        <span className="truncate">
          {displayContent}
        </span>
      ) : null}

      {!loading && rightIcon ? (
        <span className="flex shrink-0 items-center">
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
});

Button.displayName = "Button";

export default Button;

/* ==================================================
   ICON BUTTON
================================================== */

export type IconButtonProps =
  Omit<
    ButtonProps,
    "children" | "size"
  > & {
    icon: ReactNode;

    iconSize?:
      | "sm"
      | "md"
      | "lg";

    "aria-label": string;
  };

export const IconButton = forwardRef<
  HTMLButtonElement,
  IconButtonProps
>(function IconButton(
  {
    icon,
    iconSize = "md",
    ...props
  },
  ref
) {
  const sizeMap: Record<
    "sm" | "md" | "lg",
    ButtonSize
  > = {
    sm: "icon-sm",
    md: "icon",
    lg: "icon-lg",
  };

  return (
    <Button
      ref={ref}
      {...props}
      size={sizeMap[iconSize]}
    >
      {icon}
    </Button>
  );
});

IconButton.displayName = "IconButton";

/* ==================================================
   LOADING BUTTON
================================================== */

export function LoadingButton(
  props: ButtonProps
) {
  return (
    <Button
      {...props}
      loading
    />
  );
}

/* ==================================================
   ASYNC BUTTON
================================================== */

export type AsyncButtonProps =
  Omit<
    ButtonProps,
    "onClick" | "loading"
  > & {
    onClick?: (
      event: MouseEvent<HTMLButtonElement>
    ) =>
      | void
      | Promise<void>;

    onError?: (
      error: unknown
    ) => void;

    successText?: ReactNode;

    successDuration?: number;
  };

export function AsyncButton({
  children,
  onClick,
  onError,
  successText = "Done",
  successDuration = 1500,
  leftIcon,
  ...props
}: AsyncButtonProps) {
  const [state, setState] = useState<
    "idle" | "loading" | "success"
  >("idle");

  const handleClick = async (
    event: MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    if (
      !onClick ||
      state === "loading"
    ) {
      return;
    }

    try {
      setState("loading");

      await onClick(event);

      setState("success");

      window.setTimeout(() => {
        setState("idle");
      }, successDuration);
    } catch (error) {
      setState("idle");

      onError?.(error);
    }
  };

  const isLoading =
    state === "loading";

  const isSuccess =
    state === "success";

  return (
    <Button
      {...props}
      loading={isLoading}
      onClick={handleClick}
      leftIcon={
        isSuccess ? (
          <Check className="h-4 w-4" />
        ) : (
          leftIcon
        )
      }
    >
      {isSuccess
        ? successText
        : children}
    </Button>
  );
}

/* ==================================================
   BUTTON GROUP
================================================== */

export type ButtonGroupProps = {
  children: ReactNode;

  className?: string;

  orientation?:
    | "horizontal"
    | "vertical";
};

export function ButtonGroup({
  children,
  className = "",
  orientation = "horizontal",
}: ButtonGroupProps) {
  return (
    <div
      className={[
        "inline-flex",
        orientation === "vertical"
          ? "flex-col"
          : "flex-row",
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
   ADD BUTTON
================================================== */

export function AddButton(
  props: Omit<
    ButtonProps,
    "leftIcon"
  >
) {
  return (
    <Button
      {...props}
      leftIcon={
        <Plus className="h-4 w-4" />
      }
    />
  );
}

/* ==================================================
   CLOSE BUTTON
================================================== */

export type CloseButtonProps =
  Omit<
    IconButtonProps,
    "icon" | "aria-label"
  > & {
    "aria-label"?: string;
  };

export function CloseButton({
  "aria-label": ariaLabel = "Close",
  variant = "ghost",
  ...props
}: CloseButtonProps) {
  return (
    <IconButton
      {...props}
      variant={variant}
      icon={
        <X className="h-4 w-4" />
      }
      aria-label={ariaLabel}
    />
  );
}

/* ==================================================
   DROPDOWN BUTTON
================================================== */

export function DropdownButton(
  props: Omit<
    ButtonProps,
    "rightIcon"
  >
) {
  return (
    <Button
      {...props}
      rightIcon={
        <ChevronDown className="h-4 w-4" />
      }
    />
  );
}