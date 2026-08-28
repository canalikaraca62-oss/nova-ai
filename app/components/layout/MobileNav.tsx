"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  Bell,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderKanban,
  Grid2X2,
  Home,
  LayoutDashboard,
  MessageSquare,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type MobileNavItem = {
  label: string;
  href?: string;
  icon?: ReactNode;
  badge?: string | number;
  children?: MobileNavItem[];
  disabled?: boolean;
};

export type MobileNavSection = {
  label?: string;
  items: MobileNavItem[];
};

export type MobileNavProps = {
  sections?: MobileNavSection[];

  logo?: ReactNode;

  brand?: string;
  description?: string;

  footer?: ReactNode;
  headerAction?: ReactNode;

  className?: string;

  onNavigate?: (
    item: MobileNavItem
  ) => void;
};

/* ==================================================
   DEFAULT NAVIGATION
================================================== */

const DEFAULT_SECTIONS: MobileNavSection[] = [
  {
    items: [
      {
        label: "Home",
        href: "/",
        icon: (
          <Home className="h-5 w-5" />
        ),
      },
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: (
          <LayoutDashboard className="h-5 w-5" />
        ),
      },
    ],
  },

  {
    label: "WORKSPACE",

    items: [
      {
        label: "Chat",
        href: "/chat",
        icon: (
          <MessageSquare className="h-5 w-5" />
        ),
      },
      {
        label: "Canvas",
        href: "/canvas",
        icon: (
          <PanelLeft className="h-5 w-5" />
        ),
      },
      {
        label: "Agents",
        href: "/agents",
        icon: (
          <Bot className="h-5 w-5" />
        ),
      },
      {
        label: "Projects",
        href: "/projects",
        icon: (
          <FolderKanban className="h-5 w-5" />
        ),
      },
      {
        label: "Tasks",
        href: "/tasks",
        icon: (
          <Workflow className="h-5 w-5" />
        ),
      },
    ],
  },

  {
    label: "INTELLIGENCE",

    items: [
      {
        label: "Knowledge",
        href: "/knowledge",
        icon: (
          <Brain className="h-5 w-5" />
        ),
      },
      {
        label: "Files",
        href: "/files",
        icon: (
          <FileText className="h-5 w-5" />
        ),
      },
      {
        label: "Search",
        href: "/search",
        icon: (
          <Search className="h-5 w-5" />
        ),
      },
    ],
  },

  {
    label: "PLATFORM",

    items: [
      {
        label: "Apps",
        href: "/apps",
        icon: (
          <Grid2X2 className="h-5 w-5" />
        ),
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: (
          <Bell className="h-5 w-5" />
        ),
      },
      {
        label: "Settings",
        href: "/settings",
        icon: (
          <Settings className="h-5 w-5" />
        ),
      },
    ],
  },
];

/* ==================================================
   ROUTE HELPERS
================================================== */

function isItemActive(
  pathname: string | null,
  href?: string
): boolean {
  if (!pathname || !href) {
    return false;
  }

  if (href === "/") {
    return pathname === "/";
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

function hasActiveChild(
  pathname: string | null,
  item: MobileNavItem
): boolean {
  if (
    !item.children ||
    item.children.length === 0
  ) {
    return false;
  }

  return item.children.some(
    (
      child: MobileNavItem
    ): boolean => {
      return (
        isItemActive(
          pathname,
          child.href
        ) ||
        hasActiveChild(
          pathname,
          child
        )
      );
    }
  );
}

/* ==================================================
   MOBILE NAV ITEM
================================================== */

type MobileNavItemRowProps = {
  item: MobileNavItem;
  pathname: string | null;
  depth?: number;

  onNavigate?: (
    item: MobileNavItem
  ) => void;
};

function MobileNavItemRow({
  item,
  pathname,
  depth = 0,
  onNavigate,
}: MobileNavItemRowProps): ReactNode {
  const hasChildren: boolean =
    Boolean(
      item.children &&
      item.children.length > 0
    );

  const isActive: boolean =
    isItemActive(
      pathname,
      item.href
    ) ||
    hasActiveChild(
      pathname,
      item
    );

  const [
    expanded,
    setExpanded,
  ] = useState<boolean>(
    isActive
  );

  useEffect((): void => {
    if (isActive) {
      setExpanded(true);
    }
  }, [isActive]);

  const rowClassName: string = [
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors",
    depth > 0
      ? "ml-4 w-[calc(100%-1rem)]"
      : "",
    isActive
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
    item.disabled
      ? "pointer-events-none opacity-40"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content: ReactNode = (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {item.icon}
      </span>

      <span className="min-w-0 flex-1 truncate">
        {item.label}
      </span>

      {item.badge !== undefined ? (
        <span
          className={[
            "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
            isActive
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {item.badge}
        </span>
      ) : null}

      {hasChildren ? (
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 transition-transform duration-200",
            expanded
              ? "rotate-180"
              : "",
          ].join(" ")}
        />
      ) : null}
    </>
  );

  const handleNavigate = (): void => {
    onNavigate?.(item);
  };

  const handleToggle = (): void => {
    setExpanded(
      (
        current: boolean
      ): boolean => !current
    );

    onNavigate?.(item);
  };

  return (
    <div className="space-y-1">
      {hasChildren ? (
        <button
          type="button"
          disabled={item.disabled}
          onClick={handleToggle}
          className={[
            rowClassName,
            "text-left",
          ].join(" ")}
        >
          {content}
        </button>
      ) : item.href ? (
        <Link
          href={
            item.disabled
              ? "#"
              : item.href
          }
          onClick={handleNavigate}
          className={rowClassName}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          disabled={item.disabled}
          onClick={handleNavigate}
          className={[
            rowClassName,
            "text-left",
          ].join(" ")}
        >
          {content}
        </button>
      )}

      {hasChildren && expanded ? (
        <div className="space-y-1">
          {item.children?.map(
            (
              child: MobileNavItem
            ) => (
              <MobileNavItemRow
                key={
                  child.href ??
                  child.label
                }
                item={child}
                pathname={pathname}
                depth={depth + 1}
                onNavigate={onNavigate}
              />
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ==================================================
   MOBILE NAV
================================================== */

export default function MobileNav({
  sections = DEFAULT_SECTIONS,

  logo,

  brand = "Syraven",
  description = "AI Workspace",

  footer,
  headerAction,

  className = "",

  onNavigate,
}: MobileNavProps): ReactNode {
  const pathname: string | null =
    usePathname();

  const handleNewChat = (): void => {
    onNavigate?.({
      label: "New chat",
      href: "/chat",
    });
  };

  const handleSettings = (): void => {
    onNavigate?.({
      label: "Settings",
      href: "/settings",
    });
  };

  return (
    <div
      className={[
        "flex h-full w-full flex-col bg-background",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="flex min-h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        {logo ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            {logo}
          </div>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {brand}
          </p>

          {description ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {headerAction ? (
          <div className="shrink-0">
            {headerAction}
          </div>
        ) : null}
      </div>

      {/* =========================================
          PRIMARY ACTION
      ========================================== */}

      <div className="shrink-0 p-4">
        <Link
          href="/chat"
          onClick={handleNewChat}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
        >
          <Plus className="h-4 w-4" />

          New chat
        </Link>
      </div>

      {/* =========================================
          NAVIGATION
      ========================================== */}

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-5"
        aria-label="Main navigation"
      >
        <div className="space-y-6">
          {sections.map(
            (
              section: MobileNavSection,
              sectionIndex: number
            ) => (
              <section
                key={
                  section.label ??
                  `section-${sectionIndex}`
                }
              >
                {section.label ? (
                  <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                    {section.label}
                  </p>
                ) : null}

                <div className="space-y-1">
                  {section.items.map(
                    (
                      item: MobileNavItem
                    ) => (
                      <MobileNavItemRow
                        key={
                          item.href ??
                          item.label
                        }
                        item={item}
                        pathname={pathname}
                        onNavigate={onNavigate}
                      />
                    )
                  )}
                </div>
              </section>
            )
          )}
        </div>
      </nav>

      {/* =========================================
          FOOTER
      ========================================== */}

      {footer ? (
        <div className="shrink-0 border-t border-white/10">
          {footer}
        </div>
      ) : (
        <div className="shrink-0 border-t border-white/10 p-3">
          <Link
            href="/settings"
            onClick={handleSettings}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />

            <span className="flex-1">
              Workspace settings
            </span>

            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

/* ==================================================
   EXPORTS
================================================== */

export {
  DEFAULT_SECTIONS,
  hasActiveChild,
  isItemActive,
};