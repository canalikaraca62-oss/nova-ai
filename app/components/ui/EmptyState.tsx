"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/* ==================================================
   TYPES
================================================== */

export type EmptyStateSize =
  | "sm"
  | "md"
  | "lg";

export type EmptyStateAlignment =
  | "left"
  | "center";

export type EmptyStateProps =
  HTMLAttributes<HTMLDivElement> & {
    icon?: ReactNode;
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    secondaryAction?: ReactNode;
    size?: EmptyStateSize;
    alignment?: EmptyStateAlignment;
  };

/* ==================================================
   SIZE CLASSES
================================================== */

const SIZE_CLASSES: Record<
  EmptyStateSize,
  {
    container: string;
    icon: string;
    title: string;
    description: string;
  }
> = {
  sm: {
    container: "gap-3 py-6",
    icon: "h-10 w-10",
    title: "text-sm",
    description: "text-xs",
  },

  md: {
    container: "gap-4 py-10",
    icon: "h-12 w-12",
    title: "text-base",
    description: "text-sm",
  },

  lg: {
    container: "gap-5 py-16",
    icon: "h-16 w-16",
    title: "text-xl",
    description: "text-base",
  },
};

/* ==================================================
   MAIN EMPTY STATE
================================================== */

const EmptyState = forwardRef<
  HTMLDivElement,
  EmptyStateProps
>(function EmptyState(
  {
    icon,
    title = "Nothing here yet",
    description,
    action,
    secondaryAction,
    size = "md",
    alignment = "center",
    className = "",
    ...props
  },
  ref
) {
  const styles = SIZE_CLASSES[size];

  const alignmentClasses =
    alignment === "center"
      ? "items-center text-center"
      : "items-start text-left";

  return (
    <div
      ref={ref}
      className={[
        "flex w-full flex-col",
        styles.container,
        alignmentClasses,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {icon ? (
        <div
          className={[
            "flex shrink-0 items-center justify-center",
            "rounded-2xl",
            "border border-border",
            "bg-muted/50",
            "text-muted-foreground",
            styles.icon,
          ].join(" ")}
        >
          {icon}
        </div>
      ) : null}

      <div className="flex max-w-lg flex-col gap-1.5">
        {title ? (
          <h3
            className={[
              "font-semibold",
              "tracking-tight",
              "text-foreground",
              styles.title,
            ].join(" ")}
          >
            {title}
          </h3>
        ) : null}

        {description ? (
          <p
            className={[
              "leading-6",
              "text-muted-foreground",
              styles.description,
            ].join(" ")}
          >
            {description}
          </p>
        ) : null}
      </div>

      {action || secondaryAction ? (
        <div
          className={[
            "flex flex-wrap items-center gap-2 pt-1",
            alignment === "center"
              ? "justify-center"
              : "justify-start",
          ].join(" ")}
        >
          {action}

          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
});

EmptyState.displayName = "EmptyState";

export default EmptyState;

/* ==================================================
   EMPTY STATE ICON
================================================== */

export type EmptyStateIconProps =
  HTMLAttributes<HTMLDivElement>;

export const EmptyStateIcon = forwardRef<
  HTMLDivElement,
  EmptyStateIconProps
>(function EmptyStateIcon(
  {
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
        "flex h-12 w-12 items-center justify-center",
        "rounded-2xl",
        "border border-border",
        "bg-muted/50",
        "text-muted-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
});

EmptyStateIcon.displayName =
  "EmptyStateIcon";

/* ==================================================
   EMPTY STATE TITLE
================================================== */

export type EmptyStateTitleProps =
  HTMLAttributes<HTMLHeadingElement>;

export const EmptyStateTitle = forwardRef<
  HTMLHeadingElement,
  EmptyStateTitleProps
>(function EmptyStateTitle(
  {
    children,
    className = "",
    ...props
  },
  ref
) {
  return (
    <h3
      ref={ref}
      className={[
        "text-base font-semibold",
        "tracking-tight",
        "text-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </h3>
  );
});

EmptyStateTitle.displayName =
  "EmptyStateTitle";

/* ==================================================
   EMPTY STATE DESCRIPTION
================================================== */

export type EmptyStateDescriptionProps =
  HTMLAttributes<HTMLParagraphElement>;

export const EmptyStateDescription =
  forwardRef<
    HTMLParagraphElement,
    EmptyStateDescriptionProps
  >(function EmptyStateDescription(
    {
      children,
      className = "",
      ...props
    },
    ref
  ) {
    return (
      <p
        ref={ref}
        className={[
          "max-w-lg text-sm leading-6",
          "text-muted-foreground",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </p>
    );
  });

EmptyStateDescription.displayName =
  "EmptyStateDescription";

/* ==================================================
   EMPTY STATE ACTIONS
================================================== */

export type EmptyStateActionsProps =
  HTMLAttributes<HTMLDivElement> & {
    alignment?: EmptyStateAlignment;
  };

export const EmptyStateActions = forwardRef<
  HTMLDivElement,
  EmptyStateActionsProps
>(function EmptyStateActions(
  {
    children,
    alignment = "center",
    className = "",
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={[
        "flex flex-wrap items-center gap-2 pt-2",
        alignment === "center"
          ? "justify-center"
          : "justify-start",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
});

EmptyStateActions.displayName =
  "EmptyStateActions";

/* ==================================================
   EMPTY STATE ACTION BUTTON
================================================== */

export type EmptyStateActionProps =
  ButtonHTMLAttributes<HTMLButtonElement>;

export const EmptyStateAction = forwardRef<
  HTMLButtonElement,
  EmptyStateActionProps
>(function EmptyStateAction(
  {
    children,
    type = "button",
    className = "",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        "inline-flex h-9 items-center justify-center",
        "rounded-lg px-4",
        "text-sm font-medium",
        "transition-colors",
        "bg-primary text-primary-foreground",
        "hover:bg-primary/90",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-primary/30",
        "disabled:pointer-events-none",
        "disabled:opacity-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
});

EmptyStateAction.displayName =
  "EmptyStateAction";

/* ==================================================
   EMPTY STATE SECONDARY ACTION
================================================== */

export type EmptyStateSecondaryActionProps =
  ButtonHTMLAttributes<HTMLButtonElement>;

export const EmptyStateSecondaryAction =
  forwardRef<
    HTMLButtonElement,
    EmptyStateSecondaryActionProps
  >(function EmptyStateSecondaryAction(
    {
      children,
      type = "button",
      className = "",
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={[
          "inline-flex h-9 items-center justify-center",
          "rounded-lg border border-border",
          "bg-background px-4",
          "text-sm font-medium",
          "text-foreground",
          "transition-colors",
          "hover:bg-muted",
          "focus-visible:outline-none",
          "focus-visible:ring-2",
          "focus-visible:ring-primary/30",
          "disabled:pointer-events-none",
          "disabled:opacity-50",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </button>
    );
  });

EmptyStateSecondaryAction.displayName =
  "EmptyStateSecondaryAction";

/* ==================================================
   COMPACT EMPTY STATE
================================================== */

export type CompactEmptyStateProps =
  HTMLAttributes<HTMLDivElement> & {
    icon?: ReactNode;
    title: ReactNode;
    action?: ReactNode;
  };

export function CompactEmptyState({
  icon,
  title,
  action,
  className = "",
  ...props
}: CompactEmptyStateProps) {
  return (
    <div
      className={[
        "flex w-full items-center justify-between gap-4",
        "rounded-xl border border-dashed border-border",
        "bg-muted/20 px-4 py-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {icon}
          </div>
        ) : null}

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {title}
          </p>
        </div>
      </div>

      {action ? (
        <div className="shrink-0">
          {action}
        </div>
      ) : null}
    </div>
  );
}