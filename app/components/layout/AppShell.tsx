"use client";

import type {
  ReactNode,
} from "react";

import {
  useEffect,
  useState,
} from "react";

import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

type AppShellProps = {
  children: ReactNode;

  sidebar?: ReactNode;
  mobileNav?: ReactNode;
  topBar?: ReactNode;

  title?: string;
  subtitle?: string;

  actions?: ReactNode;

  defaultSidebarOpen?: boolean;

  sidebarWidth?: string;

  className?: string;
  contentClassName?: string;

  onSidebarChange?: (
    open: boolean
  ) => void;
};

export default function AppShell({
  children,

  sidebar,
  mobileNav,
  topBar,

  title,
  subtitle,

  actions,

  defaultSidebarOpen = true,

  sidebarWidth = "280px",

  className = "",
  contentClassName = "",

  onSidebarChange,
}: AppShellProps) {
  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(
    defaultSidebarOpen
  );

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  const updateSidebar = (
    nextValue: boolean
  ) => {
    setSidebarOpen(
      nextValue
    );

    onSidebarChange?.(
      nextValue
    );
  };

  const toggleSidebar = () => {
    updateSidebar(
      !sidebarOpen
    );
  };

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape"
      ) {
        setMobileMenuOpen(
          false
        );
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const originalOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        originalOverflow;
    };
  }, [
    mobileMenuOpen,
  ]);

  return (
    <div
      className={[
        "relative flex min-h-dvh w-full overflow-hidden bg-background text-foreground",
        className,
      ].join(" ")}
    >
      {/* =========================================
          DESKTOP SIDEBAR
      ========================================== */}

      {sidebar ? (
        <aside
          className={[
            "relative hidden shrink-0 overflow-hidden border-r border-white/10 bg-background transition-[width] duration-200 ease-out lg:block",
            sidebarOpen
              ? ""
              : "w-0 border-r-0",
          ].join(" ")}
          style={{
            width: sidebarOpen
              ? sidebarWidth
              : "0px",
          }}
        >
          <div
            className="h-dvh"
            style={{
              width:
                sidebarWidth,
            }}
          >
            {sidebar}
          </div>
        </aside>
      ) : null}

      {/* =========================================
          MOBILE SIDEBAR OVERLAY
      ========================================== */}

      {sidebar ? (
        <>
          <div
            className={[
              "fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity lg:hidden",
              mobileMenuOpen
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0",
            ].join(" ")}
            onClick={() => {
              setMobileMenuOpen(
                false
              );
            }}
            aria-hidden="true"
          />

          <aside
            className={[
              "fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] border-r border-white/10 bg-background shadow-2xl transition-transform duration-200 ease-out lg:hidden",
              mobileMenuOpen
                ? "translate-x-0"
                : "-translate-x-full",
            ].join(" ")}
          >
            <div className="relative h-dvh">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(
                    false
                  );
                }}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>

              {mobileNav ?? sidebar}
            </div>
          </aside>
        </>
      ) : null}

      {/* =========================================
          MAIN APPLICATION
      ========================================== */}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* =====================================
            APPLICATION HEADER
        ====================================== */}

        <header className="flex min-h-14 shrink-0 items-center border-b border-white/10 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* Mobile menu */}

            {sidebar ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(
                    true
                  );
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
            ) : null}

            {/* Desktop sidebar toggle */}

            {sidebar ? (
              <button
                type="button"
                onClick={
                  toggleSidebar
                }
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
                aria-label={
                  sidebarOpen
                    ? "Collapse sidebar"
                    : "Expand sidebar"
                }
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4.5 w-4.5" />
                ) : (
                  <PanelLeftOpen className="h-4.5 w-4.5" />
                )}
              </button>
            ) : null}

            {/* Title */}

            {title ||
            subtitle ? (
              <div className="min-w-0">
                {title ? (
                  <h1 className="truncate text-sm font-semibold sm:text-base">
                    {title}
                  </h1>
                ) : null}

                {subtitle ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Custom top bar */}

            {topBar ? (
              <div className="min-w-0 flex-1">
                {topBar}
              </div>
            ) : null}
          </div>

          {/* Header actions */}

          {actions ? (
            <div className="ml-3 flex shrink-0 items-center gap-2">
              {actions}
            </div>
          ) : null}
        </header>

        {/* =====================================
            MAIN CONTENT
        ====================================== */}

        <main
          className={[
            "min-h-0 flex-1 overflow-y-auto",
            contentClassName,
          ].join(" ")}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export type {
  AppShellProps,
};