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
  onAvatarClick?: (item: AvatarGroupItem) => void;
};

/* ==================================================
   CONSTANTS
================================================== */

const AVATAR_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
  "2xl": "h-24 w-24 text-3xl",
};

const STATUS_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-4 w-4",
  "2xl": "h-5 w-5",
};

const STATUS_POSITION_CLASSES: Record<AvatarSize, string> = {
  xs: "-bottom-px -right-px",
  sm: "-bottom-0.5 -right-0.5",
  md: "-bottom-0.5 -right-0.5",
  lg: "-bottom-0.5 -right-0.5",
  xl: "-bottom-1 -right-1",
  "2xl": "-bottom-1 -right-1",
};

const AVATAR_STATUS_CLASSES: Record<AvatarStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-muted-foreground",
  away: "bg-amber-500",
  busy: "bg-destructive",
  none: "hidden",
};

/* ==================================================
   HELPERS
================================================== */

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export function getAvatarInitials(
  name?: string | null
): string {
  if (!name) {
    return "";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part): part is string => part.length > 0);

  const firstPart = parts.at(0);

  if (!firstPart) {
    return "";
  }

  if (parts.length === 1) {
    return firstPart.slice(0, 2).toUpperCase();
  }

  const lastPart = parts.at(-1);

  const firstInitial = firstPart.charAt(0).toUpperCase();
  const lastInitial = lastPart?.charAt(0).toUpperCase() ?? "";

  return `${firstInitial}${lastInitial}`;
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
  className,
  imageClassName,
  fallbackClassName,
  statusClassName,
  showStatus = true,
  onError,
  ...imageProps
}: AvatarProps): ReactNode {
  const [imageError, setImageError] = useState<boolean>(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  const normalizedSrc = useMemo((): string | undefined => {
    if (typeof src !== "string") {
      return undefined;
    }

    const trimmedSrc = src.trim();

    return trimmedSrc.length > 0 ? trimmedSrc : undefined;
  }, [src]);

  const shouldShowImage =
    normalizedSrc !== undefined && !imageError;

  const initials = useMemo((): string => {
    if (
      typeof fallback === "string" &&
      fallback.trim().length > 0
    ) {
      return fallback.trim();
    }

    return getAvatarInitials(name);
  }, [fallback, name]);

  const borderRadiusClass = rounded
    ? "rounded-full"
    : "rounded-xl";

  const accessibleName =
    alt?.trim() ||
    name?.trim() ||
    "Avatar";

  const handleImageError = (
    event: SyntheticEvent<HTMLImageElement, Event>
  ): void => {
    setImageError(true);
    onError?.(event);
  };

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0",
        getAvatarSizeClass(size),
        className
      )}
    >
      <span
        className={cn(
          "flex h-full w-full shrink-0 overflow-hidden border border-border/50 bg-muted",
          borderRadiusClass
        )}
      >
        {shouldShowImage ? (
          <img
            {...imageProps}
            src={normalizedSrc}
            alt={accessibleName}
            onError={handleImageError}
            className={cn(
              "h-full w-full object-cover",
              imageClassName
            )}
          />
        ) : (
          <span
            className={cn(
              "flex h-full w-full items-center justify-center bg-primary/10 font-semibold text-primary",
              borderRadiusClass,
              fallbackClassName
            )}
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

      {showStatus && status !== "none" ? (
        <span
          className={cn(
            "absolute rounded-full border-2 border-background",
            STATUS_SIZE_CLASSES[size],
            STATUS_POSITION_CLASSES[size],
            getAvatarStatusClass(status),
            statusClassName
          )}
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
  className,
  avatarClassName,
  onAvatarClick,
}: AvatarGroupProps): ReactNode {
  const safeMax = Number.isFinite(max)
    ? Math.max(0, Math.floor(max))
    : 0;

  const visibleItems = items.slice(0, safeMax);

  const remainingCount = Math.max(
    0,
    items.length - visibleItems.length
  );

  return (
    <div
      className={cn(
        "flex items-center",
        className
      )}
    >
      {visibleItems.map(
        (
          item: AvatarGroupItem,
          index: number
        ): ReactNode => {
          const avatar = (
            <Avatar
              src={item.src}
              alt={item.alt}
              name={item.name}
              fallback={item.fallback}
              size={size}
              status={item.status ?? "none"}
              className="ring-2 ring-background"
            />
          );

          const positionClass =
            index > 0 ? "-ml-2" : undefined;

          if (!onAvatarClick) {
            return (
              <div
                key={item.id}
                className={cn(
                  "relative",
                  positionClass,
                  avatarClassName
                )}
              >
                {avatar}
              </div>
            );
          }

          const label =
            item.alt?.trim() ||
            item.name?.trim() ||
            "Avatar";

          return (
            <button
              key={item.id}
              type="button"
              onClick={(): void => {
                onAvatarClick(item);
              }}
              className={cn(
                "relative rounded-full transition-transform",
                "hover:z-20 hover:-translate-y-1",
                "focus:z-20 focus:outline-none focus:ring-2 focus:ring-primary/30",
                positionClass,
                avatarClassName
              )}
              aria-label={label}
            >
              {avatar}
            </button>
          );
        }
      )}

      {remainingCount > 0 ? (
        <span
          className={cn(
            "relative z-10 -ml-2 inline-flex shrink-0 items-center justify-center",
            "rounded-full border-2 border-background bg-muted",
            "font-medium text-muted-foreground",
            getAvatarSizeClass(size)
          )}
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
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <div
      className={cn(
        "flex items-center",
        className
      )}
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
  className,
}: {
  size?: AvatarSize;
  rounded?: boolean;
  className?: string;
}): ReactNode {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 animate-pulse bg-muted",
        getAvatarSizeClass(size),
        rounded ? "rounded-full" : "rounded-xl",
        className
      )}
      aria-hidden="true"
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
  buttonClassName,
  disabled,
  onClick,
  type,
  ...avatarProps
}: ClickableAvatarProps): ReactNode {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex rounded-full transition-transform",
        "hover:scale-105",
        "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        buttonClassName
      )}
    >
      <Avatar {...avatarProps} />
    </button>
  );
}