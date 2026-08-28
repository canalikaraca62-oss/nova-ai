"use client";

import {
  type ButtonHTMLAttributes,
  type ImgHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

/* ==================================================
   TYPES
================================================== */

export type AvatarSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl";

export type AvatarStatus =
  | "online"
  | "offline"
  | "away"
  | "busy"
  | "none";

export type AvatarProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt" | "size"
> & {
  src?: string | null;
  alt?: string;
  name?: string | null;
  fallback?: string | ReactNode;
  size?: AvatarSize;
  status?: AvatarStatus;
  rounded?: boolean;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  statusClassName?: string;
  showStatus?: boolean;
};

export type AvatarGroupItem = {
  id: string;
  src?: string | null;
  alt?: string;
  name?: string | null;
  fallback?: string | ReactNode;
  status?: AvatarStatus;
};

export type AvatarGroupProps = {
  items: AvatarGroupItem[];
  max?: number;
  size?: AvatarSize;
  className?: string;
  avatarClassName?: string;
  onAvatarClick?: (
    item: AvatarGroupItem
  ) => void;
};

/* ==================================================
   SIZE CONFIG
================================================== */

const AVATAR_SIZE_CLASSES: Record<
  AvatarSize,
  string
> = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
  "2xl": "h-24 w-24 text-3xl",
};

const STATUS_SIZE_CLASSES: Record<
  AvatarSize,
  string
> = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-4 w-4",
  "2xl": "h-5 w-5",
};

const STATUS_POSITION_CLASSES: Record<
  AvatarSize,
  string
> = {
  xs: "-bottom-px -right-px",
  sm: "-bottom-0.5 -right-0.5",
  md: "-bottom-0.5 -right-0.5",
  lg: "-bottom-0.5 -right-0.5",
  xl: "-bottom-1 -right-1",
  "2xl": "-bottom-1 -right-1",
};

/* ==================================================
   STATUS CONFIG
================================================== */

const AVATAR_STATUS_CLASSES: Record<
  AvatarStatus,
  string
> = {
  online: "bg-emerald-500",
  offline: "bg-muted-foreground",
  away: "bg-amber-500",
  busy: "bg-destructive",
  none: "hidden",
};

/* ==================================================
   HELPERS
================================================== */

export function getAvatarInitials(
  name?: string | null
): string {
  if (!name) {
    return "";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  const first =
    parts[0]?.charAt(0).toUpperCase() ??
    "";

  const last =
    parts[
      parts.length - 1
    ]?.charAt(0).toUpperCase() ?? "";

  return `${first}${last}`;
}

export function getAvatarSizeClass(
  size: AvatarSize
): string {
  return AVATAR_SIZE_CLASSES[size];
}

export function getAvatarStatusClass(
  status: AvatarStatus
): string {
  return AVATAR_STATUS_CLASSES[status];
}

/* ==================================================
   AVATAR
================================================== */

export default function Avatar({
  src,
  alt,
  name,
  fallback,
  size = "md",
  status = "none",
  rounded = true,
  className = "",
  imageClassName = "",
  fallbackClassName = "",
  statusClassName = "",
  showStatus = true,
  onError,
  ...imageProps
}: AvatarProps) {
  const [imageError, setImageError] =
    useState(false);

  /*
   * src değiştiğinde eski image error
   * durumunu sıfırla.
   */
  useEffect(() => {
    setImageError(false);
  }, [src]);

  const shouldShowImage =
    typeof src === "string" &&
    src.trim().length > 0 &&
    !imageError;

  const initials = useMemo(() => {
    if (
      typeof fallback === "string" &&
      fallback.trim().length > 0
    ) {
      return fallback;
    }

    return getAvatarInitials(name);
  }, [fallback, name]);

  const borderRadiusClass = rounded
    ? "rounded-full"
    : "rounded-xl";

  const handleImageError = (
    event: SyntheticEvent<
      HTMLImageElement,
      Event
    >
  ): void => {
    setImageError(true);
    onError?.(event);
  };

  const accessibleName =
    alt ||
    name ||
    "Avatar";

  return (
    <span
      className={[
        "relative inline-flex shrink-0",
        getAvatarSizeClass(size),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={[
          "flex h-full w-full shrink-0 overflow-hidden border border-border/50 bg-muted",
          borderRadiusClass,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {shouldShowImage ? (
          <img
            {...imageProps}
            /*
             * shouldShowImage true olduğunda
             * src kesin olarak string'dir.
             */
            src={src as string}
            alt={accessibleName}
            onError={handleImageError}
            className={[
              "h-full w-full object-cover",
              imageClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ) : (
          <span
            className={[
              "flex h-full w-full items-center justify-center bg-primary/10 font-semibold text-primary",
              borderRadiusClass,
              fallbackClassName,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={accessibleName}
          >
            {typeof fallback !== "string" &&
            fallback !== undefined &&
            fallback !== null
              ? fallback
              : initials || "?"}
          </span>
        )}
      </span>

      {showStatus &&
      status !== "none" ? (
        <span
          className={[
            "absolute rounded-full border-2 border-background",
            STATUS_SIZE_CLASSES[size],
            STATUS_POSITION_CLASSES[size],
            getAvatarStatusClass(status),
            statusClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`${status} status`}
        />
      ) : null}
    </span>
  );
}

/* ==================================================
   AVATAR GROUP
================================================== */

export function AvatarGroup({
  items,
  max = 5,
  size = "md",
  className = "",
  avatarClassName = "",
  onAvatarClick,
}: AvatarGroupProps) {
  const safeMax = Math.max(0, max);

  const visibleItems =
    items.slice(0, safeMax);

  const remainingCount =
    Math.max(
      0,
      items.length - visibleItems.length
    );

  return (
    <div
      className={[
        "flex items-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {visibleItems.map(
        (
          item: AvatarGroupItem,
          index: number
        ) => {
          const avatar = (
            <Avatar
              src={item.src ?? undefined}
              alt={item.alt}
              name={item.name}
              fallback={item.fallback}
              size={size}
              status={item.status ?? "none"}
              className="ring-2 ring-background"
            />
          );

          if (!onAvatarClick) {
            return (
              <div
                key={item.id}
                className={[
                  "relative",
                  index > 0 ? "-ml-2" : "",
                  avatarClassName,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {avatar}
              </div>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onAvatarClick(item);
              }}
              className={[
                "relative transition-transform hover:z-20 hover:-translate-y-1 focus:z-20 focus:outline-none",
                index > 0 ? "-ml-2" : "",
                avatarClassName,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={
                item.alt ||
                item.name ||
                "Avatar"
              }
            >
              {avatar}
            </button>
          );
        }
      )}

      {remainingCount > 0 ? (
        <span
          className={[
            "relative z-10 -ml-2 inline-flex shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted font-medium text-muted-foreground",
            getAvatarSizeClass(size),
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`${remainingCount} more users`}
        >
          +{remainingCount}
        </span>
      ) : null}
    </div>
  );
}

/* ==================================================
   AVATAR STACK
================================================== */

export function AvatarStack({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex items-center",
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
   AVATAR PLACEHOLDER
================================================== */

export function AvatarPlaceholder({
  size = "md",
  rounded = true,
  className = "",
}: {
  size?: AvatarSize;
  rounded?: boolean;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 animate-pulse bg-muted",
        getAvatarSizeClass(size),
        rounded
          ? "rounded-full"
          : "rounded-xl",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

/* ==================================================
   CLICKABLE AVATAR
================================================== */

export type ClickableAvatarProps =
  AvatarProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "children" | "className"
  > & {
    buttonClassName?: string;
  };

export function ClickableAvatar({
  buttonClassName = "",
  disabled,
  onClick,
  ...avatarProps
}: ClickableAvatarProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex rounded-full transition-transform",
        "hover:scale-105",
        "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        buttonClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Avatar {...avatarProps} />
    </button>
  );
}