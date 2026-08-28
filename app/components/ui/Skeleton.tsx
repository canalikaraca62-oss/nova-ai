"use client";

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/* ==================================================
   TYPES
================================================== */

export type SkeletonVariant =
  | "default"
  | "muted"
  | "subtle";

export type SkeletonAnimation =
  | "pulse"
  | "wave"
  | "none";

export type SkeletonProps =
  HTMLAttributes<HTMLDivElement> & {
    variant?: SkeletonVariant;
    animation?: SkeletonAnimation;
    circle?: boolean;
  };

/* ==================================================
   VARIANT CONFIG
================================================== */

const SKELETON_VARIANT_CLASSES: Record<
  SkeletonVariant,
  string
> = {
  default: "bg-muted",

  muted: "bg-muted/70",

  subtle: "bg-muted/40",
};

/* ==================================================
   ANIMATION CONFIG
================================================== */

const SKELETON_ANIMATION_CLASSES: Record<
  SkeletonAnimation,
  string
> = {
  pulse: "animate-pulse",

  wave: [
    "relative overflow-hidden",
    "before:absolute before:inset-0",
    "before:-translate-x-full",
    "before:animate-[shimmer_1.5s_infinite]",
    "before:bg-gradient-to-r",
    "before:from-transparent",
    "before:via-background/40",
    "before:to-transparent",
  ].join(" "),

  none: "",
};

/* ==================================================
   MAIN SKELETON
================================================== */

const Skeleton = forwardRef<
  HTMLDivElement,
  SkeletonProps
>(function Skeleton(
  {
    variant = "default",
    animation = "pulse",
    circle = false,
    className = "",
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={[
        "shrink-0",
        circle ? "rounded-full" : "rounded-md",
        SKELETON_VARIANT_CLASSES[variant],
        SKELETON_ANIMATION_CLASSES[animation],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});

Skeleton.displayName = "Skeleton";

export default Skeleton;

/* ==================================================
   SKELETON TEXT
================================================== */

export type SkeletonTextProps =
  HTMLAttributes<HTMLDivElement> & {
    lines?: number;
    lastLineWidth?: string;
    lineClassName?: string;
    gapClassName?: string;
    variant?: SkeletonVariant;
    animation?: SkeletonAnimation;
  };

export const SkeletonText = forwardRef<
  HTMLDivElement,
  SkeletonTextProps
>(function SkeletonText(
  {
    lines = 3,
    lastLineWidth = "w-3/4",
    lineClassName = "",
    gapClassName = "gap-2",
    variant = "default",
    animation = "pulse",
    className = "",
    ...props
  },
  ref
) {
  const safeLines =
    Math.max(
      1,
      Math.floor(lines)
    );

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={[
        "flex w-full flex-col",
        gapClassName,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {Array.from(
        { length: safeLines },
        (_, index) => {
          const isLastLine =
            index === safeLines - 1;

          return (
            <Skeleton
              key={index}
              variant={variant}
              animation={animation}
              className={[
                "h-4 w-full",
                isLastLine
                  ? lastLineWidth
                  : "",
                lineClassName,
              ]
                .filter(Boolean)
                .join(" ")}
            />
          );
        }
      )}
    </div>
  );
});

SkeletonText.displayName =
  "SkeletonText";

/* ==================================================
   SKELETON AVATAR
================================================== */

export type SkeletonAvatarSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl";

export type SkeletonAvatarProps =
  Omit<
    SkeletonProps,
    "circle"
  > & {
    size?: SkeletonAvatarSize;
  };

const SKELETON_AVATAR_SIZE_CLASSES: Record<
  SkeletonAvatarSize,
  string
> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
  "2xl": "h-24 w-24",
};

export const SkeletonAvatar = forwardRef<
  HTMLDivElement,
  SkeletonAvatarProps
>(function SkeletonAvatar(
  {
    size = "md",
    className = "",
    ...props
  },
  ref
) {
  return (
    <Skeleton
      ref={ref}
      circle
      className={[
        SKELETON_AVATAR_SIZE_CLASSES[
          size
        ],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});

SkeletonAvatar.displayName =
  "SkeletonAvatar";

/* ==================================================
   SKELETON BUTTON
================================================== */

export type SkeletonButtonSize =
  | "sm"
  | "md"
  | "lg";

export type SkeletonButtonProps =
  Omit<
    SkeletonProps,
    "circle"
  > & {
    size?: SkeletonButtonSize;
    width?: string;
  };

const SKELETON_BUTTON_SIZE_CLASSES: Record<
  SkeletonButtonSize,
  string
> = {
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
};

export const SkeletonButton = forwardRef<
  HTMLDivElement,
  SkeletonButtonProps
>(function SkeletonButton(
  {
    size = "md",
    width = "w-24",
    className = "",
    ...props
  },
  ref
) {
  return (
    <Skeleton
      ref={ref}
      className={[
        SKELETON_BUTTON_SIZE_CLASSES[
          size
        ],
        width,
        "rounded-lg",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});

SkeletonButton.displayName =
  "SkeletonButton";

/* ==================================================
   SKELETON INPUT
================================================== */

export type SkeletonInputProps =
  Omit<
    SkeletonProps,
    "circle"
  > & {
    size?: SkeletonButtonSize;
  };

const SKELETON_INPUT_SIZE_CLASSES: Record<
  SkeletonButtonSize,
  string
> = {
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
};

export const SkeletonInput = forwardRef<
  HTMLDivElement,
  SkeletonInputProps
>(function SkeletonInput(
  {
    size = "md",
    className = "",
    ...props
  },
  ref
) {
  return (
    <Skeleton
      ref={ref}
      className={[
        "w-full",
        "rounded-lg",
        SKELETON_INPUT_SIZE_CLASSES[
          size
        ],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});

SkeletonInput.displayName =
  "SkeletonInput";

/* ==================================================
   SKELETON CARD
================================================== */

export type SkeletonCardProps =
  HTMLAttributes<HTMLDivElement> & {
    showImage?: boolean;
    imageHeight?: string;
    lines?: number;
    footer?: ReactNode;
    variant?: SkeletonVariant;
    animation?: SkeletonAnimation;
  };

export const SkeletonCard = forwardRef<
  HTMLDivElement,
  SkeletonCardProps
>(function SkeletonCard(
  {
    showImage = false,
    imageHeight = "h-40",
    lines = 3,
    footer,
    variant = "default",
    animation = "pulse",
    className = "",
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={[
        "w-full overflow-hidden",
        "rounded-xl border border-border",
        "bg-background",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {showImage ? (
        <Skeleton
          variant={variant}
          animation={animation}
          className={[
            "w-full rounded-none",
            imageHeight,
          ].join(" ")}
        />
      ) : null}

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <SkeletonAvatar
            variant={variant}
            animation={animation}
          />

          <div className="flex flex-1 flex-col gap-2">
            <Skeleton
              variant={variant}
              animation={animation}
              className="h-4 w-1/3"
            />

            <Skeleton
              variant={variant}
              animation={animation}
              className="h-3 w-1/4"
            />
          </div>
        </div>

        <SkeletonText
          lines={lines}
          variant={variant}
          animation={animation}
        />

        {footer ? (
          <div className="border-t border-border pt-4">
            {footer}
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <Skeleton
              variant={variant}
              animation={animation}
              className="h-4 w-20"
            />

            <SkeletonButton
              size="sm"
              variant={variant}
              animation={animation}
            />
          </div>
        )}
      </div>
    </div>
  );
});

SkeletonCard.displayName =
  "SkeletonCard";

/* ==================================================
   SKELETON TABLE
================================================== */

export type SkeletonTableProps =
  HTMLAttributes<HTMLDivElement> & {
    rows?: number;
    columns?: number;
    showHeader?: boolean;
    variant?: SkeletonVariant;
    animation?: SkeletonAnimation;
  };

export const SkeletonTable = forwardRef<
  HTMLDivElement,
  SkeletonTableProps
>(function SkeletonTable(
  {
    rows = 5,
    columns = 4,
    showHeader = true,
    variant = "default",
    animation = "pulse",
    className = "",
    ...props
  },
  ref
) {
  const safeRows =
    Math.max(
      1,
      Math.floor(rows)
    );

  const safeColumns =
    Math.max(
      1,
      Math.floor(columns)
    );

  const gridStyle = {
    gridTemplateColumns:
      `repeat(${safeColumns}, minmax(0, 1fr))`,
  };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={[
        "w-full overflow-hidden",
        "rounded-xl border border-border",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {showHeader ? (
        <div
          className="grid gap-4 border-b border-border p-4"
          style={gridStyle}
        >
          {Array.from(
            { length: safeColumns },
            (_, index) => (
              <Skeleton
                key={`header-${index}`}
                variant={variant}
                animation={animation}
                className="h-4 w-3/4"
              />
            )
          )}
        </div>
      ) : null}

      <div className="divide-y divide-border">
        {Array.from(
          { length: safeRows },
          (_, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              className="grid gap-4 p-4"
              style={gridStyle}
            >
              {Array.from(
                { length: safeColumns },
                (_, columnIndex) => (
                  <Skeleton
                    key={`cell-${rowIndex}-${columnIndex}`}
                    variant={variant}
                    animation={animation}
                    className={[
                      "h-4",
                      columnIndex === 0
                        ? "w-5/6"
                        : "w-full",
                    ].join(" ")}
                  />
                )
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
});

SkeletonTable.displayName =
  "SkeletonTable";