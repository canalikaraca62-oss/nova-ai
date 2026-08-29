"use client";

import React from "react";

export interface FooterLink {
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}

export interface FooterGroup {
  title: string;
  links: FooterLink[];
}

export interface FooterSocialLink {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  external?: boolean;
  onClick?: () => void;
}

export interface FooterProps {
  brand?: React.ReactNode;
  description?: string;

  groups?: FooterGroup[];

  socialLinks?: FooterSocialLink[];
  legalLinks?: FooterLink[];

  copyright?: string;

  showTopBorder?: boolean;

  className?: string;

  children?: React.ReactNode;
}

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function FooterLinkItem({
  link,
  className,
}: {
  link: FooterLink;
  className?: string;
}) {
  const {
    label,
    href,
    external = false,
    onClick,
  } = link;

  const linkClassName = cn(
    "text-sm text-muted-foreground transition-colors",
    "hover:text-foreground focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-primary/30",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className
  );

  if (href) {
    return (
      <a
        href={href}
        className={linkClassName}
        target={external ? "_blank" : undefined}
        rel={
          external
            ? "noopener noreferrer"
            : undefined
        }
      >
        {label}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          linkClassName,
          "text-left"
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={linkClassName}>
      {label}
    </span>
  );
}

function FooterSocialItem({
  item,
}: {
  item: FooterSocialLink;
}) {
  const {
    label,
    href,
    icon,
    external = true,
    onClick,
  } = item;

  const className = cn(
    "flex h-9 w-9 items-center justify-center rounded-lg",
    "text-muted-foreground transition-colors",
    "hover:bg-muted hover:text-foreground",
    "focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-primary/30"
  );

  const content = (
    <>
      <span className="sr-only">
        {label}
      </span>

      <span
        aria-hidden="true"
        className="flex items-center justify-center"
      >
        {icon ?? "↗"}
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={className}
        aria-label={label}
        target={external ? "_blank" : undefined}
        rel={
          external
            ? "noopener noreferrer"
            : undefined
        }
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
        className={className}
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={className}
      aria-label={label}
    >
      {content}
    </span>
  );
}

export default function Footer({
  brand,
  description,
  groups = [],
  socialLinks = [],
  legalLinks = [],
  copyright,
  showTopBorder = true,
  className,
  children,
}: FooterProps) {
  const currentYear = new Date().getFullYear();

  const resolvedCopyright =
    copyright ??
    `© ${currentYear} All rights reserved.`;

  return (
    <footer
      className={cn(
        "w-full bg-background",
        showTopBorder && "border-t border-border",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div
          className={cn(
            "grid gap-10",
            groups.length > 0
              ? "lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]"
              : "lg:grid-cols-[minmax(0,1fr)_auto]"
          )}
        >
          <div className="max-w-sm">
            {brand ? (
              <div className="text-lg font-semibold text-foreground">
                {brand}
              </div>
            ) : null}

            {description ? (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}

            {socialLinks.length > 0 ? (
              <div
                className="mt-5 flex flex-wrap items-center gap-2"
                aria-label="Social links"
              >
                {socialLinks.map((item, index) => (
                  <FooterSocialItem
                    key={`${item.label}-${index}`}
                    item={item}
                  />
                ))}
              </div>
            ) : null}

            {children ? (
              <div className="mt-5">
                {children}
              </div>
            ) : null}
          </div>

          {groups.length > 0 ? (
            <div
              className={cn(
                "grid gap-8 sm:grid-cols-2",
                groups.length >= 3
                  ? "lg:grid-cols-4"
                  : groups.length === 2
                    ? "lg:grid-cols-2"
                    : "lg:grid-cols-1"
              )}
            >
              {groups.map((group, index) => (
                <div
                  key={`${group.title}-${index}`}
                >
                  <h3 className="text-sm font-semibold text-foreground">
                    {group.title}
                  </h3>

                  <ul className="mt-4 space-y-3">
                    {group.links.map(
                      (link, linkIndex) => (
                        <li
                          key={`${link.label}-${linkIndex}`}
                        >
                          <FooterLinkItem
                            link={link}
                          />
                        </li>
                      )
                    )}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {resolvedCopyright}
          </p>

          {legalLinks.length > 0 ? (
            <nav
              aria-label="Legal links"
              className="flex flex-wrap items-center gap-x-5 gap-y-2"
            >
              {legalLinks.map(
                (link, index) => (
                  <FooterLinkItem
                    key={`${link.label}-${index}`}
                    link={link}
                  />
                )
              )}
            </nav>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

export function FooterSkeleton({
  groups = 4,
  className,
}: {
  groups?: number;
  className?: string;
}) {
  return (
    <footer
      className={cn(
        "w-full animate-pulse border-t border-border bg-background",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
          <div>
            <div className="h-6 w-32 rounded bg-muted" />

            <div className="mt-5 space-y-2">
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-5/6 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>

            <div className="mt-5 flex gap-2">
              <div className="h-9 w-9 rounded-lg bg-muted" />
              <div className="h-9 w-9 rounded-lg bg-muted" />
              <div className="h-9 w-9 rounded-lg bg-muted" />
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from(
              { length: groups },
              (_, index) => (
                <div key={index}>
                  <div className="h-4 w-20 rounded bg-muted" />

                  <div className="mt-4 space-y-3">
                    <div className="h-3 w-24 rounded bg-muted" />
                    <div className="h-3 w-20 rounded bg-muted" />
                    <div className="h-3 w-28 rounded bg-muted" />
                    <div className="h-3 w-16 rounded bg-muted" />
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
          <div className="h-4 w-48 rounded bg-muted" />

          <div className="flex gap-4">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        </div>
      </div>
    </footer>
  );
}