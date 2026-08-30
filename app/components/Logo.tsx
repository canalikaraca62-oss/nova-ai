"use client";

import React from "react";

type LogoSize = "sm" | "md" | "lg";

type LogoVariant = "default" | "minimal" | "icon";

interface SizeConfig {
  icon: string;
  title: string;
  tagline: string;
  gap: string;
}

export interface LogoProps {
  name?: string;
  tagline?: string;

  href?: string;

  size?: LogoSize;

  variant?: LogoVariant;

  icon?: React.ReactNode;

  className?: string;

  onClick?: () => void;
}

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

const sizeConfig: Record<LogoSize, SizeConfig> = {
  sm: {
    icon: "h-8 w-8",
    title: "text-base",
    tagline: "text-[10px]",
    gap: "gap-2",
  },

  md: {
    icon: "h-10 w-10",
    title: "text-lg",
    tagline: "text-xs",
    gap: "gap-2.5",
  },

  lg: {
    icon: "h-12 w-12",
    title: "text-xl",
    tagline: "text-sm",
    gap: "gap-3",
  },
};

function DefaultLogoMark(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="h-full w-full"
    >
      <rect
        x="4"
        y="4"
        width="40"
        height="40"
        rx="12"
        className="fill-primary"
      />

      <path
        d="M15 14H23.5C30.404 14 34 17.596 34 24C34 30.404 30.404 34 23.5 34H15V14Z"
        className="fill-primary-foreground"
      />

      <path
        d="M21 19H24C27.314 19 29 20.686 29 24C29 27.314 27.314 29 24 29H21V19Z"
        className="fill-primary"
      />
    </svg>
  );
}

interface LogoContentProps {
  name: string;
  tagline?: string;
  size: LogoSize;
  variant: LogoVariant;
  icon?: React.ReactNode;
}

function LogoContent({
  name,
  tagline,
  size,
  variant,
  icon,
}: LogoContentProps): React.ReactElement {
  const config = sizeConfig[size];

  return (
    <>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center",
          config.icon
        )}
      >
        {icon ?? <DefaultLogoMark />}
      </span>

      {variant !== "icon" ? (
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              "truncate font-semibold tracking-tight text-foreground",
              config.title
            )}
          >
            {name}
          </span>

          {variant === "default" && tagline ? (
            <span
              className={cn(
                "mt-0.5 truncate font-medium text-muted-foreground",
                config.tagline
              )}
            >
              {tagline}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

export default function Logo({
  name = "SYRAVEN",
  tagline,
  href,
  size = "md",
  variant = "default",
  icon,
  className,
  onClick,
}: LogoProps): React.ReactElement {
  const config = sizeConfig[size];

  const isInteractive = Boolean(href || onClick);

  const baseClassName = cn(
    "inline-flex max-w-full items-center",
    config.gap,
    variant === "icon" && "gap-0",
    "rounded-xl transition-opacity",
    isInteractive && "cursor-pointer hover:opacity-80",
    className
  );

  const content = (
    <LogoContent
      name={name}
      tagline={tagline}
      size={size}
      variant={variant}
      icon={icon}
    />
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          baseClassName,
          "focus-visible:outline-none",
          "focus-visible:ring-2",
          "focus-visible:ring-primary/30",
          "focus-visible:ring-offset-2",
          "focus-visible:ring-offset-background"
        )}
        aria-label={name}
      >
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClassName,
          "border-0 bg-transparent p-0 text-left",
          "focus-visible:outline-none",
          "focus-visible:ring-2",
          "focus-visible:ring-primary/30",
          "focus-visible:ring-offset-2",
          "focus-visible:ring-offset-background"
        )}
        aria-label={name}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={baseClassName}
      aria-label={name}
    >
      {content}
    </div>
  );
}

export interface LogoMarkProps {
  size?: LogoSize;
  icon?: React.ReactNode;
  className?: string;
}

export function LogoMark({
  size = "md",
  icon,
  className,
}: LogoMarkProps): React.ReactElement {
  const config = sizeConfig[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        config.icon,
        className
      )}
    >
      {icon ?? <DefaultLogoMark />}
    </span>
  );
}