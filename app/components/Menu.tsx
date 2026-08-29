"use client";

import React, {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export interface MenuItem {
  id?: string;
  label: React.ReactNode;

  description?: React.ReactNode;
  icon?: React.ReactNode;
  shortcut?: string;

  href?: string;
  external?: boolean;

  disabled?: boolean;
  danger?: boolean;

  onClick?: () => void;

  divider?: boolean;
}

export interface MenuProps {
  trigger: React.ReactNode;

  items: MenuItem[];

  align?: "left" | "right";
  side?: "top" | "bottom";

  width?: "sm" | "md" | "lg";

  disabled?: boolean;

  closeOnSelect?: boolean;

  className?: string;
  menuClassName?: string;

  onOpenChange?: (open: boolean) => void;
}

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

const widthClasses = {
  sm: "w-48",
  md: "w-64",
  lg: "w-80",
} as const;

function MenuItemContent({
  item,
}: {
  item: MenuItem;
}) {
  return (
    <>
      {item.icon ? (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground"
          aria-hidden="true"
        >
          {item.icon}
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate">
          {item.label}
        </span>

        {item.description ? (
          <span className="mt-0.5 text-xs font-normal text-muted-foreground">
            {item.description}
          </span>
        ) : null}
      </span>

      {item.shortcut ? (
        <kbd className="ml-3 shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {item.shortcut}
        </kbd>
      ) : null}
    </>
  );
}

export default function Menu({
  trigger,
  items,
  align = "right",
  side = "bottom",
  width = "md",
  disabled = false,
  closeOnSelect = true,
  className,
  menuClassName,
  onOpenChange,
}: MenuProps) {
  const [open, setOpen] = useState(false);

  const menuId = useId();

  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const menuRef =
    useRef<HTMLDivElement | null>(null);

  const triggerRef =
    useRef<HTMLButtonElement | null>(null);

  const setMenuOpen = (
    nextOpen: boolean
  ): void => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const closeMenu = (): void => {
    setMenuOpen(false);
  };

  const focusFirstItem = (): void => {
    const firstItem =
      menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])'
      );

    firstItem?.focus();
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (
      event: MouseEvent
    ): void => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        !containerRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };

    const handleKeyDown = (
      event: KeyboardEvent
    ): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
      }

      if (event.key === "Tab") {
        closeMenu();
      }
    };

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open]);

  const handleTriggerClick = (): void => {
    if (disabled) {
      return;
    }

    setMenuOpen(!open);
  };

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ): void => {
    if (disabled) {
      return;
    }

    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      if (!open) {
        setMenuOpen(true);

        window.setTimeout(() => {
          focusFirstItem();
        }, 0);
      }
    }
  };

  const handleItemClick = (
    item: MenuItem
  ): void => {
    if (item.disabled) {
      return;
    }

    item.onClick?.();

    if (closeOnSelect) {
      closeMenu();

      window.setTimeout(() => {
        triggerRef.current?.focus();
      }, 0);
    }
  };

  const handleItemKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    item: MenuItem
  ): void => {
    if (item.disabled) {
      return;
    }

    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      handleItemClick(item);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      const nextElement =
        event.currentTarget.nextElementSibling;

      if (nextElement instanceof HTMLElement) {
        const nextMenuItem =
          nextElement.matches(
            '[role="menuitem"]:not([aria-disabled="true"])'
          )
            ? nextElement
            : nextElement.querySelector<HTMLElement>(
                '[role="menuitem"]:not([aria-disabled="true"])'
              );

        nextMenuItem?.focus();
      }
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      const previousElement =
        event.currentTarget.previousElementSibling;

      if (previousElement instanceof HTMLElement) {
        const previousMenuItem =
          previousElement.matches(
            '[role="menuitem"]:not([aria-disabled="true"])'
          )
            ? previousElement
            : previousElement.querySelector<HTMLElement>(
                '[role="menuitem"]:not([aria-disabled="true"])'
              );

        previousMenuItem?.focus();
      }
    }
  };

  const positionClassName =
    side === "bottom"
      ? "top-full mt-2"
      : "bottom-full mb-2";

  const alignClassName =
    align === "right"
      ? "right-0"
      : "left-0";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex",
        className
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={cn(
          "inline-flex items-center justify-center",
          "focus-visible:outline-none",
          "focus-visible:ring-2",
          "focus-visible:ring-primary/30",
          "focus-visible:ring-offset-2",
          "focus-visible:ring-offset-background",
          disabled &&
            "cursor-not-allowed opacity-50"
        )}
      >
        {trigger}
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className={cn(
            "absolute z-50 overflow-hidden rounded-xl",
            "border border-border bg-popover text-popover-foreground",
            "p-1 shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
            "duration-150",
            widthClasses[width],
            positionClassName,
            alignClassName,
            menuClassName
          )}
        >
          {items.map((item, index) => {
            const itemKey =
              item.id ??
              `${String(item.label)}-${index}`;

            const itemClassName = cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5",
              "text-sm font-medium transition-colors",
              "focus:outline-none",
              item.disabled
                ? "cursor-not-allowed opacity-50"
                : item.danger
                  ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                  : "hover:bg-muted focus:bg-muted"
            );

            const content = (
              <MenuItemContent item={item} />
            );

            return (
              <React.Fragment key={itemKey}>
                {item.divider && index > 0 ? (
                  <div
                    role="separator"
                    className="my-1 h-px bg-border"
                  />
                ) : null}

                {item.href && !item.disabled ? (
                  <a
                    href={item.href}
                    target={
                      item.external
                        ? "_blank"
                        : undefined
                    }
                    rel={
                      item.external
                        ? "noopener noreferrer"
                        : undefined
                    }
                    role="menuitem"
                    tabIndex={0}
                    className={itemClassName}
                    onClick={() =>
                      handleItemClick(item)
                    }
                    onKeyDown={(event) =>
                      handleItemKeyDown(
                        event,
                        item
                      )
                    }
                  >
                    {content}
                  </a>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    aria-disabled={item.disabled}
                    tabIndex={
                      item.disabled ? -1 : 0
                    }
                    className={itemClassName}
                    onClick={() =>
                      handleItemClick(item)
                    }
                    onKeyDown={(event) =>
                      handleItemKeyDown(
                        event,
                        item
                      )
                    }
                  >
                    {content}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function MenuDivider() {
  return (
    <div
      role="separator"
      className="my-1 h-px bg-border"
    />
  );
}

export function MenuLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}