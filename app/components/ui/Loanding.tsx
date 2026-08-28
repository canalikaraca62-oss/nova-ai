"use client";

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/* ==================================================
   TYPES
================================================== */

export type LoadingSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl";

export type LoadingVariant =
  | "default"
  | "primary"
  | "muted"
  | "white";

export type LoadingProps =
  HTMLAttributes<HTMLDivElement> & {
    size?: LoadingSize;
    variant?: LoadingVariant;
    label?: string;
    showLabel?: boolean;
  };

/* ==================================================
   SIZE CONFIG
================================================== */

const LOADING_SIZE_CLASSES: Record<
  LoadingSize,
  string
> = {
  xs: "h-3 w-3 border-2",
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
  xl: "h-12 w-12 border-4",
};

/* ==================================================
   VARIANT CONFIG
================================================== */

const LOADING_VARIANT_CLASSES: Record<
  LoadingVariant,
  string
> = {
  default:
    "border-muted-foreground/20 border-t-muted-foreground",

  primary:
    "border-primary/20 border-t-primary",

  muted:
    "border-muted/60 border-t-muted-foreground",

  white:
    "border-white/30 border-t-white",
};

/* ==================================================
   MAIN LOADING COMPONENT
================================================== */

const Loading = forwardRef<
  HTMLDivElement,
  LoadingProps
>(function Loading(
  {
    size = "md",
    variant = "primary",
    label = "Loading",
    showLabel = false,
    className = "",
    ...props
  },
  ref
) {
  const sizeClass =
    LOADING_SIZE_CLASSES[size];

  const variantClass =
    LOADING_VARIANT_CLASSES[variant];

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-label={label}
      className={[
        "inline-flex items-center justify-center",
        showLabel ? "gap-2" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <span
        aria-hidden="true"
        className={[
          "inline-block shrink-0 rounded-full",
          "animate-spin",
          sizeClass,
          variantClass,
        ]
          .filter(Boolean)
          .join(" ")}
      />

      {showLabel ? (
        <span className="text-sm text-muted-foreground">
          {label}
        </span>
      ) : (
        <span className="sr-only">
          {label}
        </span>
      )}
    </div>
  );
});

Loading.displayName = "Loading";

export default Loading;

/* ==================================================
   SPINNER
================================================== */

export type SpinnerProps =
  Omit<
    LoadingProps,
    "showLabel"
  >;

export const Spinner = forwardRef<
  HTMLDivElement,
  SpinnerProps
>(function Spinner(
  props,
  ref
) {
  return (
    <Loading
      ref={ref}
      {...props}
      showLabel={false}
    />
  );
});

Spinner.displayName = "Spinner";

/* ==================================================
   LOADING TEXT
================================================== */

export type LoadingTextProps =
  HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
    size?: LoadingSize;
    variant?: LoadingVariant;
  };

export const LoadingText = forwardRef<
  HTMLDivElement,
  LoadingTextProps
>(function LoadingText(
  {
    children = "Loading...",
    size = "md",
    variant = "primary",
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
        "text-sm text-muted-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <Loading
        size={size}
        variant={variant}
        label="Loading"
      />

      <span>
        {children}
      </span>
    </div>
  );
});

LoadingText.displayName =
  "LoadingText";

/* ==================================================
   LOADING OVERLAY
================================================== */

export type LoadingOverlayProps =
  HTMLAttributes<HTMLDivElement> & {
    loading?: boolean;
    label?: string;
    size?: LoadingSize;
    variant?: LoadingVariant;
    children?: ReactNode;
  };

export const LoadingOverlay = forwardRef<
  HTMLDivElement,
  LoadingOverlayProps
>(function LoadingOverlay(
  {
    loading = true,
    label = "Loading",
    size = "lg",
    variant = "primary",
    children,
    className = "",
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={[
        "relative",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={label}
          className={[
            "absolute inset-0 z-50",
            "flex items-center justify-center",
            "bg-background/70",
            "backdrop-blur-sm",
          ].join(" ")}
        >
          <Loading
            size={size}
            variant={variant}
            label={label}
            showLabel
            className="rounded-xl border border-border bg-background px-4 py-3 shadow-lg"
          />
        </div>
      ) : null}
    </div>
  );
});

LoadingOverlay.displayName =
  "LoadingOverlay";

/* ==================================================
   FULL PAGE LOADING
================================================== */

export type FullPageLoadingProps =
  Omit<
    LoadingProps,
    "className"
  > & {
    message?: string;
    className?: string;
  };

export const FullPageLoading = forwardRef<
  HTMLDivElement,
  FullPageLoadingProps
>(function FullPageLoading(
  {
    size = "xl",
    variant = "primary",
    label = "Loading application",
    message,
    className = "",
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={[
        "flex min-h-[50vh] w-full",
        "flex-col items-center justify-center",
        "gap-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <Loading
        size={size}
        variant={variant}
        label={label}
      />

      {message ? (
        <p className="text-center text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
});

FullPageLoading.displayName =
  "FullPageLoading";