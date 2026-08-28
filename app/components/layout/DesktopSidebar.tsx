"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  Bell,
  Bot,
  Box,
  Brain,
  ChevronDown,
  ChevronRight,
  Command,
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

export type SidebarItem = {
  label: string;
  href?: string;
  icon?: ReactNode;
  badge?: string | number;
  children?: SidebarItem[];
  disabled?: boolean;
};

export type SidebarSection = {
  label?: string;
  items: SidebarItem[];
};

export type DesktopSidebarProps = {
  sections?: SidebarSection[];

  logo?: ReactNode;

  brand?: string;
  description?: string;

  footer?: ReactNode;
  headerAction?: ReactNode;

  className?: string;

  onItemClick?: (
    item: SidebarItem
  ) => void;
};

/* ==================================================
   DEFAULT NAVIGATION
================================================== */

const DEFAULT_SECTIONS: SidebarSection[] = [
  {
    items: [
      {
        label: "Home",
        href: "/",
        icon: (
          <Home className="h-4 w-4" />
        ),
      },
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: (
          <LayoutDashboard className="h-4 w-4" />
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
          <MessageSquare className="h-4 w-4" />
        ),
      },
      {
        label: "Canvas",
        href: "/canvas",
        icon: (
          <PanelLeft className="h-4 w-4" />
        ),
      },
      {
        label: "Agents",
        href: "/agents",
        icon: (
          <Bot className="h-4 w-4" />
        ),
      },
      {
        label: "Projects",
        href: "/projects",
        icon: (
          <FolderKanban className="h-4 w-4" />
        ),
      },
      {
        label: "Tasks",
        href: "/tasks",
        icon: (
          <Workflow className="h-4 w-4" />
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
          <Brain className="h-4 w-4" />
        ),
      },
      {
        label: "Files",
        href: "/files",
        icon: (
          <FileText className="h-4 w-4" />
        ),
      },
      {
        label: "Search",
        href: "/search",
        icon: (
          <Search className="h-4 w-4" />
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
          <Grid2X2 className="h-4 w-4" />
        ),
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: (
          <Bell className="h-4 w-4" />
        ),
      },
      {
        label: "Settings",
        href: "/settings",
        icon: (
          <Settings className="h-4 w-4" />
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
  if (
    !pathname ||
    !href
  ) {
    return false;
  }

  if (href === "/") {
    return pathname === "/";
  }

  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`
    )
  );
}

function hasActiveChild(
  pathname: string | null,
  item: SidebarItem
): boolean {
  if (
    !item.children ||
    item.children.length === 0
  ) {
    return false;
  }

  return item.children.some(
    (child: SidebarItem): boolean => {
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
   SIDEBAR ITEM
================================================== */

type SidebarItemRowProps = {
  item: SidebarItem;
  pathname: string | null;
  depth?: number;

  onItemClick?: (
    item: SidebarItem
  ) => void;
};

function SidebarItemRow({
  item,
  pathname,
  depth = 0,
  onItemClick,
}: SidebarItemRowProps) {
  const hasChildren =
    Boolean(
      item.children &&
        item.children.length > 0
    );

  const active =
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
    active
  );

  const rowClassName = [
    "flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors",
    depth > 0
      ? "ml-4 w-[calc(100%-1rem)]"
      : "",
    active
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
    item.disabled
      ? "pointer-events-none opacity-40"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {item.icon}
      </span>

      <span className="min-w-0 flex-1 truncate">
        {item.label}
      </span>

      {item.badge !== undefined ? (
        <span
          className={[
            "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
            active
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
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            expanded
              ? "rotate-180"
              : "",
          ].join(" ")}
        />
      ) : null}
    </>
  );

  const handleClick = (): void => {
    onItemClick?.(item);
  };

  const handleToggle = (): void => {
    setExpanded(
      (current: boolean): boolean =>
        !current
    );

    onItemClick?.(item);
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
          onClick={handleClick}
          className={rowClassName}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          disabled={item.disabled}
          onClick={handleClick}
          className={[
            rowClassName,
            "text-left",
          ].join(" ")}
        >
          {content}
        </button>
      )}

      {hasChildren &&
      expanded ? (
        <div className="space-y-1">
          {item.children?.map(
            (child: SidebarItem) => (
              <SidebarItemRow
                key={
                  child.href ??
                  child.label
                }
                item={child}
                pathname={pathname}
                depth={depth + 1}
                onItemClick={
                  onItemClick
                }
              />
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ==================================================
   DESKTOP SIDEBAR
================================================== */

export default function DesktopSidebar({
  sections = DEFAULT_SECTIONS,

  logo,

  brand = "Syraven",
  description = "AI Workspace",

  footer,
  headerAction,

  className = "",

  onItemClick,
}: DesktopSidebarProps) {
  const pathname =
    usePathname();

  return (
    <aside
      className={[
        "flex h-full w-full flex-col bg-background",
        className,
      ].join(" ")}
    >
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        {logo ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            {logo}
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {brand}
          </p>

          {description ? (
            <p className="truncate text-[10px] text-muted-foreground">
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

      <div className="p-3">
        <Link
          href="/chat"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />

          New chat
        </Link>
      </div>

      {/* =========================================
          NAVIGATION
      ========================================== */}

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"
        aria-label="Main navigation"
      >
        <div className="space-y-5">
          {sections.map(
            (
              section: SidebarSection,
              sectionIndex: number
            ) => (
              <section
                key={
                  section.label ??
                  `section-${sectionIndex}`
                }
              >
                {section.label ? (
                  <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
                    {section.label}
                  </p>
                ) : null}

                <div className="space-y-1">
                  {section.items.map(
                    (
                      item: SidebarItem
                    ) => (
                      <SidebarItemRow
                        key={
                          item.href ??
                          item.label
                        }
                        item={item}
                        pathname={pathname}
                        onItemClick={
                          onItemClick
                        }
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
          COMMAND PALETTE TRIGGER
      ========================================== */}

      <div className="px-3 pb-3">
        <button
          type="button"
          className="flex h-10 w-full items-center gap-3 rounded-xl border border-white/10 px-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Command className="h-4 w-4" />

          <span className="flex-1">
            Command
          </span>

          <kbd className="rounded border border-white/10 bg-muted px-1.5 py-0.5 text-[10px]">
            ⌘ K
          </kbd>
        </button>
      </div>

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
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Box className="h-4 w-4" />

            <span>
              Workspace settings
            </span>

            <ChevronRight className="ml-auto h-4 w-4" />
          </Link>
        </div>
      )}
    </aside>
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