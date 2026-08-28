"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import {
  Bell,
  ChevronDown,
  Command,
  Menu,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type TopBarProps = {
  /**
   * Optional title override.
   * If omitted, a readable title is generated
   * from the current pathname.
   */
  title?: string;

  /**
   * Optional content shown below or beside the title.
   */
  subtitle?: string;

  /**
   * Controls the mobile navigation button.
   */
  onMenuClick?: () => void;

  /**
   * Controls global search.
   */
  onSearch?: (query: string) => void;

  /**
   * Called when the search field is submitted.
   */
  onSearchSubmit?: (query: string) => void;

  /**
   * Optional callback for command palette.
   */
  onCommandClick?: () => void;

  /**
   * Optional callback for notifications.
   */
  onNotificationsClick?: () => void;

  /**
   * Optional notification count.
   */
  notificationCount?: number;

  /**
   * Right-side custom content.
   */
  actions?: ReactNode;

  /**
   * User area override.
   */
  user?: ReactNode;

  /**
   * Show global search.
   */
  showSearch?: boolean;

  /**
   * Show command palette trigger.
   */
  showCommand?: boolean;

  /**
   * Show notification button.
   */
  showNotifications?: boolean;

  /**
   * Search placeholder.
   */
  searchPlaceholder?: string;

  /**
   * Extra class names.
   */
  className?: string;
};

/* ==================================================
   HELPERS
================================================== */

function formatSegment(
  segment: string
): string {
  return segment
    .replace(/[-_]/g, " ")
    .replace(
      /\b\w/g,
      (character: string): string =>
        character.toUpperCase()
    );
}

function getTitleFromPathname(
  pathname: string | null
): string {
  if (!pathname || pathname === "/") {
    return "Workspace";
  }

  const segments: string[] =
    pathname
      .split("/")
      .filter(Boolean);

  const lastSegment: string | undefined =
    segments.at(-1);

  if (!lastSegment) {
    return "Workspace";
  }

  if (
    lastSegment === "new" &&
    segments.length > 1
  ) {
    const parentSegment: string =
      segments[
        segments.length - 2
      ];

    return `New ${formatSegment(
      parentSegment
    ).replace(/s$/, "")}`;
  }

  return formatSegment(
    lastSegment
  );
}

/* ==================================================
   ICON BUTTON
================================================== */

type IconButtonProps = {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  badge?: number;
};

function IconButton({
  label,
  onClick,
  children,
  badge,
}: IconButtonProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {children}

      {badge !== undefined &&
      badge > 0 ? (
        <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
          {badge > 99
            ? "99+"
            : badge}
        </span>
      ) : null}
    </button>
  );
}

/* ==================================================
   DEFAULT USER MENU
================================================== */

function DefaultUserMenu(): ReactNode {
  const [
    open,
    setOpen,
  ] = useState<boolean>(
    false
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(): void => {
          setOpen(
            (current: boolean): boolean =>
              !current
          );
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-xl px-2 text-sm transition-colors hover:bg-muted"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          S
        </div>

        <span className="hidden max-w-28 truncate text-sm font-medium lg:block">
          Workspace
        </span>

        <ChevronDown className="hidden h-4 w-4 text-muted-foreground lg:block" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border/60 bg-background p-1 shadow-xl"
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={(): void => {
              setOpen(false);
            }}
            className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />

            Settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/* ==================================================
   TOP BAR
================================================== */

export default function TopBar({
  title,
  subtitle,

  onMenuClick,

  onSearch,
  onSearchSubmit,

  onCommandClick,

  onNotificationsClick,
  notificationCount = 0,

  actions,

  user,

  showSearch = true,
  showCommand = true,
  showNotifications = true,

  searchPlaceholder = "Search everything...",

  className = "",
}: TopBarProps): ReactNode {
  const pathname: string | null =
    usePathname();

  const [
    query,
    setQuery,
  ] = useState<string>("");

  const [
    searchOpen,
    setSearchOpen,
  ] = useState<boolean>(
    false
  );

  const resolvedTitle: string =
    title ??
    getTitleFromPathname(
      pathname
    );

  useEffect((): (() => void) => {
    const handleKeyDown = (
      event: globalThis.KeyboardEvent
    ): void => {
      const isCommandShortcut: boolean =
        (event.metaKey ||
          event.ctrlKey) &&
        event.key.toLowerCase() === "k";

      if (!isCommandShortcut) {
        return;
      }

      event.preventDefault();

      if (onCommandClick) {
        onCommandClick();
        return;
      }

      setSearchOpen(true);
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return (): void => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [onCommandClick]);

  const handleSearchChange = (
    event: ChangeEvent<HTMLInputElement>
  ): void => {
    const nextQuery: string =
      event.target.value;

    setQuery(nextQuery);

    onSearch?.(nextQuery);
  };

  const handleSearchKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ): void => {
    if (event.key === "Enter") {
      event.preventDefault();

      onSearchSubmit?.(
        query.trim()
      );
    }

    if (event.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const openSearch = (): void => {
    setSearchOpen(true);
  };

  const closeSearch = (): void => {
    setSearchOpen(false);
  };

  return (
    <header
      className={[
        "sticky top-0 z-40 flex h-16 w-full items-center border-b border-border/60 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4 lg:px-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* =========================================
          LEFT
      ========================================== */}

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden h-8 w-px bg-border/60 lg:block" />

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="hidden h-4 w-4 shrink-0 text-primary sm:block" />

            <h2 className="truncate text-sm font-semibold sm:text-base">
              {resolvedTitle}
            </h2>
          </div>

          {subtitle ? (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {/* =========================================
          DESKTOP SEARCH
      ========================================== */}

      {showSearch ? (
        <div className="hidden w-full max-w-xl px-4 md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="search"
              value={query}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label="Global search"
              className="h-10 w-full rounded-xl border border-border/60 bg-muted/40 pl-10 pr-16 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10"
            />

            <button
              type="button"
              onClick={openSearch}
              className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Open search"
            >
              <Command className="h-3 w-3" />

              <span>K</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* =========================================
          RIGHT
      ========================================== */}

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        {actions}

        {showSearch ? (
          <button
            type="button"
            onClick={openSearch}
            aria-label="Open search"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          >
            <Search className="h-5 w-5" />
          </button>
        ) : null}

        {showCommand ? (
          <IconButton
            label="Open command palette"
            onClick={onCommandClick}
          >
            <Command className="h-4 w-4" />
          </IconButton>
        ) : null}

        {showNotifications ? (
          <IconButton
            label="Notifications"
            onClick={
              onNotificationsClick
            }
            badge={notificationCount}
          >
            <Bell className="h-4 w-4" />
          </IconButton>
        ) : null}

        <div className="ml-1 hidden h-8 w-px bg-border/60 sm:block" />

        <div className="ml-1">
          {user ?? (
            <DefaultUserMenu />
          )}
        </div>
      </div>

      {/* =========================================
          MOBILE SEARCH OVERLAY
      ========================================== */}

      {searchOpen ? (
        <div className="absolute inset-0 z-50 flex items-center gap-2 border-b border-border/60 bg-background px-3 sm:px-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              autoFocus
              type="search"
              value={query}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label="Global search"
              className="h-10 w-full rounded-xl border border-border/60 bg-muted/40 pl-10 pr-3 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close search"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </header>
  );
}

/* ==================================================
   EXPORTS
================================================== */

export {
  DefaultUserMenu,
  IconButton,
  formatSegment,
  getTitleFromPathname,
};