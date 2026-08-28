"use client";

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/* ==================================================
   TYPES
================================================== */

export type CardVariant =
  | "default"
  | "outlined"
  | "elevated"
  | "ghost"
  | "interactive";

export type CardPadding =
  | "none"
  | "sm"
  | "md"
  | "lg"
  | "xl";

export type CardProps =
  HTMLAttributes<HTMLDivElement> & {
    variant?: CardVariant;
    padding?: CardPadding;
    hoverable?: boolean;
    clickable?: boolean;
  };

/* ==================================================
   VARIANT CLASSES
================================================== */

export const CARD_VARIANT_CLASSES: Record<
  CardVariant,
  string
> = {
  default:
    "border border-border bg-card text-card-foreground shadow-sm",

  outlined:
    "border border-border bg-background text-foreground",

  elevated:
    "border border-border/50 bg-card text-card-foreground shadow-lg",

  ghost:
    "border border-transparent bg-transparent text-foreground",

  interactive:
    "cursor-pointer border border-border bg-card text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
};

/* ==================================================
   PADDING CLASSES
================================================== */

export const CARD_PADDING_CLASSES: Record<
  CardPadding,
  string
> = {
  none: "",

  sm: "p-3",

  md: "p-4",

  lg: "p-6",

  xl: "p-8",
};

/* ==================================================
   HELPERS
================================================== */

export function getCardVariantClasses(
  variant: CardVariant
): string {
  return CARD_VARIANT_CLASSES[variant];
}

export function getCardPaddingClasses(
  padding: CardPadding
): string {
  return CARD_PADDING_CLASSES[padding];
}

/* ==================================================
   MAIN CARD
================================================== */

const Card = forwardRef<
  HTMLDivElement,
  CardProps
>(function Card(
  {
    children,
    variant = "default",
    padding = "none",
    hoverable = false,
    clickable = false,
    className = "",
    ...props
  },
  ref
) {
  const isInteractive =
    variant === "interactive" ||
    hoverable ||
    clickable;

  return (
    <div
      ref={ref}
      className={[
        "relative rounded-xl",
        "transition-all duration-200",
        getCardVariantClasses(variant),
        getCardPaddingClasses(padding),
        hoverable && variant !== "interactive"
          ? "hover:-translate-y-0.5 hover:shadow-md"
          : "",
        clickable &&
        variant !== "interactive"
          ? "cursor-pointer hover:border-primary/30 hover:shadow-md"
          : "",
        isInteractive
          ? "focus-within:ring-2 focus-within:ring-primary/20"
          : "",
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

Card.displayName = "Card";

export default Card;

/* ==================================================
   CARD HEADER
================================================== */

export type CardHeaderProps =
  HTMLAttributes<HTMLDivElement> & {
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
  };

export function CardHeader({
  title,
  description,
  action,
  children,
  className = "",
  ...props
}: CardHeaderProps) {
  const hasStructuredContent =
    title !== undefined ||
    description !== undefined ||
    action !== undefined;

  return (
    <div
      className={[
        "flex items-start justify-between gap-4",
        "border-b border-border px-6 py-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {hasStructuredContent ? (
        <>
          <div className="min-w-0 flex-1">
            {title ? (
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            ) : null}

            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}

            {children}
          </div>

          {action ? (
            <div className="flex shrink-0 items-center">
              {action}
            </div>
          ) : null}
        </>
      ) : (
        children
      )}
    </div>
  );
}

/* ==================================================
   CARD TITLE
================================================== */

export type CardTitleProps =
  HTMLAttributes<HTMLHeadingElement>;

export function CardTitle({
  className = "",
  children,
  ...props
}: CardTitleProps) {
  return (
    <h3
      className={[
        "text-base font-semibold tracking-tight text-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </h3>
  );
}

/* ==================================================
   CARD DESCRIPTION
================================================== */

export type CardDescriptionProps =
  HTMLAttributes<HTMLParagraphElement>;

export function CardDescription({
  className = "",
  children,
  ...props
}: CardDescriptionProps) {
  return (
    <p
      className={[
        "text-sm leading-6 text-muted-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </p>
  );
}

/* ==================================================
   CARD CONTENT
================================================== */

export type CardContentProps =
  HTMLAttributes<HTMLDivElement> & {
    padding?: CardPadding;
  };

export function CardContent({
  children,
  padding = "lg",
  className = "",
  ...props
}: CardContentProps) {
  return (
    <div
      className={[
        getCardPaddingClasses(padding),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==================================================
   CARD FOOTER
================================================== */

export type CardFooterProps =
  HTMLAttributes<HTMLDivElement> & {
    justify?:
      | "start"
      | "center"
      | "end"
      | "between";
  };

export function CardFooter({
  children,
  justify = "end",
  className = "",
  ...props
}: CardFooterProps) {
  const justifyClass: Record<
    NonNullable<CardFooterProps["justify"]>,
    string
  > = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
  };

  return (
    <div
      className={[
        "flex items-center gap-3 border-t border-border px-6 py-4",
        justifyClass[justify],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==================================================
   CARD ACTIONS
================================================== */

export type CardActionsProps =
  HTMLAttributes<HTMLDivElement> & {
    align?: "start" | "center" | "end";
  };

export function CardActions({
  children,
  align = "end",
  className = "",
  ...props
}: CardActionsProps) {
  const alignClass: Record<
    NonNullable<CardActionsProps["align"]>,
    string
  > = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
  };

  return (
    <div
      className={[
        "flex items-center gap-2",
        alignClass[align],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==================================================
   CARD MEDIA
================================================== */

export type CardMediaProps =
  HTMLAttributes<HTMLDivElement> & {
    aspectRatio?:
      | "auto"
      | "square"
      | "video"
      | "wide";
  };

export function CardMedia({
  children,
  aspectRatio = "auto",
  className = "",
  ...props
}: CardMediaProps) {
  const aspectRatioClass: Record<
    NonNullable<CardMediaProps["aspectRatio"]>,
    string
  > = {
    auto: "",
    square: "aspect-square",
    video: "aspect-video",
    wide: "aspect-[16/7]",
  };

  return (
    <div
      className={[
        "relative w-full overflow-hidden",
        aspectRatioClass[aspectRatio],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==================================================
   CLICKABLE CARD
================================================== */

export type ClickableCardProps =
  CardProps & {
    onClick: NonNullable<
      HTMLAttributes<HTMLDivElement>["onClick"]
    >;
  };

export function ClickableCard({
  children,
  variant = "interactive",
  className = "",
  ...props
}: ClickableCardProps) {
  return (
    <Card
      {...props}
      variant={variant}
      clickable
      className={className}
    >
      {children}
    </Card>
  );
}

/* ==================================================
   CARD GRID
================================================== */

export type CardGridProps =
  HTMLAttributes<HTMLDivElement> & {
    columns?: 1 | 2 | 3 | 4;
  };

export function CardGrid({
  children,
  columns = 3,
  className = "",
  ...props
}: CardGridProps) {
  const columnClass: Record<
    NonNullable<CardGridProps["columns"]>,
    string
  > = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  };

  return (
    <div
      className={[
        "grid gap-4",
        columnClass[columns],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}