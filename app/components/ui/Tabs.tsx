"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/* ==================================================
   TYPES
================================================== */

export type TabsValue = string;

export type TabsVariant =
  | "default"
  | "pills"
  | "underline";

export type TabsSize =
  | "sm"
  | "md"
  | "lg";

type TabsContextValue = {
  value: TabsValue;
  setValue: (value: TabsValue) => void;
  variant: TabsVariant;
  size: TabsSize;
  baseId: string;
};

const TabsContext = createContext<TabsContextValue | null>(
  null
);

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error(
      "Tabs components must be used inside <Tabs>."
    );
  }

  return context;
}

/* ==================================================
   TABS ROOT
================================================== */

export type TabsProps =
  Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
    value?: TabsValue;
    defaultValue?: TabsValue;
    onValueChange?: (value: TabsValue) => void;
    variant?: TabsVariant;
    size?: TabsSize;
    children: ReactNode;
  };

export function Tabs({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  variant = "default",
  size = "md",
  children,
  className = "",
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] =
    useState<TabsValue>(defaultValue);

  const isControlled =
    controlledValue !== undefined;

  const value = isControlled
    ? controlledValue
    : internalValue;

  const baseId = useId();

  const setValue = (
    nextValue: TabsValue
  ): void => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  };

  const contextValue = useMemo<TabsContextValue>(
    () => ({
      value,
      setValue,
      variant,
      size,
      baseId,
    }),
    [
      value,
      variant,
      size,
      baseId,
    ]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        className={[
          "w-full",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

/* ==================================================
   TABS LIST
================================================== */

export type TabsListProps =
  HTMLAttributes<HTMLDivElement>;

export const TabsList = forwardRef<
  HTMLDivElement,
  TabsListProps
>(function TabsList(
  {
    className = "",
    children,
    ...props
  },
  ref
) {
  const {
    variant,
  } = useTabsContext();

  const variantClasses: Record<
    TabsVariant,
    string
  > = {
    default: [
      "inline-flex",
      "items-center",
      "gap-1",
      "rounded-lg",
      "border",
      "border-border",
      "bg-muted/40",
      "p-1",
    ].join(" "),

    pills: [
      "inline-flex",
      "items-center",
      "gap-1",
      "rounded-full",
      "bg-muted/50",
      "p-1",
    ].join(" "),

    underline: [
      "flex",
      "w-full",
      "items-center",
      "gap-1",
      "border-b",
      "border-border",
    ].join(" "),
  };

  return (
    <div
      ref={ref}
      role="tablist"
      className={[
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
});

TabsList.displayName = "TabsList";

/* ==================================================
   TABS TRIGGER
================================================== */

export type TabsTriggerProps =
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "value"
  > & {
    value: TabsValue;
  };

const TABS_SIZE_CLASSES: Record<
  TabsSize,
  string
> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-base",
};

export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(function TabsTrigger(
  {
    value: triggerValue,
    className = "",
    children,
    disabled = false,
    onClick,
    ...props
  },
  ref
) {
  const {
    value,
    setValue,
    variant,
    size,
    baseId,
  } = useTabsContext();

  const isActive =
    value === triggerValue;

  const triggerId =
    `${baseId}-trigger-${triggerValue}`;

  const panelId =
    `${baseId}-panel-${triggerValue}`;

  const variantClasses: Record<
    TabsVariant,
    string
  > = {
    default: isActive
      ? [
          "bg-background",
          "text-foreground",
          "shadow-sm",
        ].join(" ")
      : [
          "text-muted-foreground",
          "hover:bg-background/60",
          "hover:text-foreground",
        ].join(" "),

    pills: isActive
      ? [
          "bg-primary",
          "text-primary-foreground",
          "shadow-sm",
        ].join(" ")
      : [
          "text-muted-foreground",
          "hover:bg-background",
          "hover:text-foreground",
        ].join(" "),

    underline: isActive
      ? [
          "relative",
          "text-foreground",
          "after:absolute",
          "after:bottom-0",
          "after:left-0",
          "after:h-0.5",
          "after:w-full",
          "after:bg-primary",
        ].join(" ")
      : [
          "text-muted-foreground",
          "hover:text-foreground",
        ].join(" "),
  };

  const handleClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    if (disabled) {
      return;
    }

    setValue(triggerValue);

    onClick?.(event);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ): void => {
    const list =
      event.currentTarget.parentElement;

    if (!list) {
      return;
    }

    const triggers = Array.from(
      list.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not([disabled])'
      )
    );

    const currentIndex =
      triggers.indexOf(
        event.currentTarget
      );

    if (currentIndex === -1) {
      return;
    }

    let nextIndex: number | null =
      null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex =
          (currentIndex + 1) %
          triggers.length;
        break;

      case "ArrowLeft":
      case "ArrowUp":
        nextIndex =
          (currentIndex - 1 +
            triggers.length) %
          triggers.length;
        break;

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex =
          triggers.length - 1;
        break;

      default:
        return;
    }

    event.preventDefault();

    const nextTrigger =
      triggers[nextIndex];

    nextTrigger?.focus();
    nextTrigger?.click();
  };

  return (
    <button
      ref={ref}
      id={triggerId}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        "inline-flex",
        "shrink-0",
        "items-center",
        "justify-center",
        "gap-2",
        "whitespace-nowrap",
        "rounded-md",
        "font-medium",
        "transition-colors",
        "outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        "disabled:pointer-events-none",
        "disabled:opacity-50",
        TABS_SIZE_CLASSES[size],
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
});

TabsTrigger.displayName =
  "TabsTrigger";

/* ==================================================
   TABS CONTENT
================================================== */

export type TabsContentProps =
  HTMLAttributes<HTMLDivElement> & {
    value: TabsValue;
    forceMount?: boolean;
  };

export const TabsContent = forwardRef<
  HTMLDivElement,
  TabsContentProps
>(function TabsContent(
  {
    value: contentValue,
    forceMount = false,
    className = "",
    children,
    ...props
  },
  ref
) {
  const {
    value,
    baseId,
  } = useTabsContext();

  const isActive =
    value === contentValue;

  const triggerId =
    `${baseId}-trigger-${contentValue}`;

  const panelId =
    `${baseId}-panel-${contentValue}`;

  if (!isActive && !forceMount) {
    return null;
  }

  return (
    <div
      ref={ref}
      id={panelId}
      role="tabpanel"
      aria-labelledby={triggerId}
      hidden={!isActive}
      tabIndex={0}
      className={[
        "mt-4",
        "outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
});

TabsContent.displayName =
  "TabsContent";

/* ==================================================
   SIMPLE TAB
   Controlled usage helper
================================================== */

export type TabItem = {
  value: TabsValue;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
};

export type SimpleTabsProps =
  Omit<
    TabsProps,
    "children"
  > & {
    items: TabItem[];
    listClassName?: string;
    triggerClassName?: string;
    contentClassName?: string;
  };

export function SimpleTabs({
  items,
  listClassName = "",
  triggerClassName = "",
  contentClassName = "",
  defaultValue,
  ...props
}: SimpleTabsProps) {
  const firstAvailableValue =
    items.find(
      (item) => !item.disabled
    )?.value ?? "";

  const resolvedDefaultValue =
    defaultValue ??
    firstAvailableValue;

  return (
    <Tabs
      defaultValue={resolvedDefaultValue}
      {...props}
    >
      <TabsList
        className={listClassName}
      >
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={triggerClassName}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {items.map((item) => (
        <TabsContent
          key={item.value}
          value={item.value}
          className={contentClassName}
        >
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/* ==================================================
   EXAMPLE
================================================== */

/*

<Tabs
  defaultValue="overview"
  variant="underline"
>
  <TabsList>
    <TabsTrigger value="overview">
      Overview
    </TabsTrigger>

    <TabsTrigger value="activity">
      Activity
    </TabsTrigger>

    <TabsTrigger value="settings">
      Settings
    </TabsTrigger>
  </TabsList>

  <TabsContent value="overview">
    Overview content
  </TabsContent>

  <TabsContent value="activity">
    Activity content
  </TabsContent>

  <TabsContent value="settings">
    Settings content
  </TabsContent>
</Tabs>

*/