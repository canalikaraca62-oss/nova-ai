"use client";

import React, { useEffect, useState } from "react";
import Logo from "./Logo";

export interface NavbarItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

export interface NavbarAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface NavbarProps {
  brandName?: string;
  brandTagline?: string;

  logoHref?: string;

  items?: NavbarItem[];

  actions?: NavbarAction[];

  activeId?: string;

  sticky?: boolean;

  showMobileMenu?: boolean;

  className?: string;

  children?: React.ReactNode;

  onItemChange?: (item: NavbarItem) => void;
}

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function MenuIcon(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function CloseIcon(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function NavbarItemButton({
  item,
  isActive,
  onSelect,
}: {
  item: NavbarItem;
  isActive: boolean;
  onSelect: (item: NavbarItem) => void;
}): React.ReactElement {
  const className = cn(
    "inline-flex items-center gap-2 rounded-lg px-3 py-2",
    "text-sm font-medium transition-colors",
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-primary/30",
    "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-background",
    isActive
      ? "bg-muted text-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
    item.disabled && "cursor-not-allowed opacity-50"
  );

  const content = (
    <>
      {item.icon ? (
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {item.icon}
        </span>
      ) : null}

      <span>{item.label}</span>

      {item.badge ? (
        <span className="ml-1 shrink-0">
          {item.badge}
        </span>
      ) : null}
    </>
  );

  const handleClick = (): void => {
    if (item.disabled) {
      return;
    }

    item.onClick?.();
    onSelect(item);
  };

  if (item.href && !item.disabled) {
    return (
      <a
        href={item.href}
        className={className}
        aria-current={isActive ? "page" : undefined}
        onClick={handleClick}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={item.disabled}
      aria-current={isActive ? "page" : undefined}
    >
      {content}
    </button>
  );
}

function NavbarActionButton({
  action,
}: {
  action: NavbarAction;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2",
        "text-sm font-medium text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-primary/30",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-background",
        action.disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {action.icon ? (
        <span
          className="flex h-4 w-4 items-center justify-center"
          aria-hidden="true"
        >
          {action.icon}
        </span>
      ) : null}

      <span>{action.label}</span>
    </button>
  );
}

export default function Navbar({
  brandName = "SYRAVEN",
  brandTagline,
  logoHref = "/",
  items = [],
  actions = [],
  activeId,
  sticky = true,
  showMobileMenu = true,
  className,
  children,
  onItemChange,
}: NavbarProps): React.ReactElement {
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    if (mobileOpen) {
      window.addEventListener("keydown", handleEscape);
    }

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileOpen]);

  const handleSelect = (item: NavbarItem): void => {
    setMobileOpen(false);
    onItemChange?.(item);
  };

  return (
    <header
      className={cn(
        "z-40 w-full border-b border-border bg-background/95",
        "backdrop-blur supports-[backdrop-filter]:bg-background/80",
        sticky && "sticky top-0",
        className
      )}
    >
      <div className="mx-auto flex min-h-16 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Logo
            name={brandName}
            tagline={brandTagline}
            href={logoHref}
            size="md"
          />

          {items.length > 0 ? (
            <nav
              className="hidden items-center gap-1 md:flex"
              aria-label="Primary navigation"
            >
              {items.map((item) => (
                <NavbarItemButton
                  key={item.id}
                  item={item}
                  isActive={item.id === activeId}
                  onSelect={handleSelect}
                />
              ))}
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {children ? (
            <div className="hidden items-center gap-2 md:flex">
              {children}
            </div>
          ) : null}

          {actions.length > 0 ? (
            <div className="hidden items-center gap-1 md:flex">
              {actions.map((action) => (
                <NavbarActionButton
                  key={action.id}
                  action={action}
                />
              ))}
            </div>
          ) : null}

          {showMobileMenu && (items.length > 0 || actions.length > 0) ? (
            <button
              type="button"
              onClick={() => setMobileOpen((current) => !current)}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-lg",
                "text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
                "focus-visible:outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-primary/30",
                "focus-visible:ring-offset-2",
                "focus-visible:ring-offset-background",
                "md:hidden"
              )}
              aria-label={
                mobileOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          ) : null}
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-border bg-background md:hidden">
          <nav
            className="mx-auto flex w-full max-w-screen-2xl flex-col gap-1 px-4 py-4 sm:px-6"
            aria-label="Mobile navigation"
          >
            {items.map((item) => (
              <NavbarItemButton
                key={item.id}
                item={item}
                isActive={item.id === activeId}
                onSelect={handleSelect}
              />
            ))}

            {actions.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
                {actions.map((action) => (
                  <NavbarActionButton
                    key={action.id}
                    action={action}
                  />
                ))}
              </div>
            ) : null}

            {children ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                {children}
              </div>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}