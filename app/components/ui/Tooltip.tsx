"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/* ==================================================
   TYPES
================================================== */

export type TooltipSide =
  | "top"
  | "right"
  | "bottom"
  | "left";

export type TooltipAlign =
  | "start"
  | "center"
  | "end";

export type TooltipContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
};

const TooltipContext =
  createContext<TooltipContextValue | null>(
    null
  );

function useTooltipContext(): TooltipContextValue {
  const context = useContext(TooltipContext);

  if (!context) {
    throw new Error(
      "Tooltip components must be used inside <Tooltip>."
    );
  }

  return context;
}

/* ==================================================
   TOOLTIP ROOT
================================================== */

export type TooltipProps =
  HTMLAttributes<HTMLDivElement> & {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  };

export function Tooltip({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  className = "",
  ...props
}: TooltipProps) {
  const [internalOpen, setInternalOpen] =
    useState<boolean>(defaultOpen);

  const isControlled =
    controlledOpen !== undefined;

  const open = isControlled
    ? controlledOpen
    : internalOpen;

  const contentId = useId();

  const setOpen = (
    nextOpen: boolean
  ): void => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  return (
    <TooltipContext.Provider
      value={{
        open,
        setOpen,
        contentId,
      }}
    >
      <div
        className={[
          "relative inline-flex",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
}

/* ==================================================
   TOOLTIP TRIGGER
================================================== */

export type TooltipTriggerProps =
  HTMLAttributes<HTMLElement> & {
    children: ReactNode;
    asChild?: boolean;
  };

export const TooltipTrigger = forwardRef<
  HTMLSpanElement,
  TooltipTriggerProps
>(function TooltipTrigger(
  {
    children,
    asChild = false,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    className = "",
    ...props
  },
  ref
) {
  const {
    open,
    setOpen,
    contentId,
  } = useTooltipContext();

  const handleMouseEnter = (
    event: React.MouseEvent<HTMLSpanElement>
  ): void => {
    setOpen(true);
    onMouseEnter?.(event);
  };

  const handleMouseLeave = (
    event: React.MouseEvent<HTMLSpanElement>
  ): void => {
    setOpen(false);
    onMouseLeave?.(event);
  };

  const handleFocus = (
    event: React.FocusEvent<HTMLSpanElement>
  ): void => {
    setOpen(true);
    onFocus?.(event);
  };

  const handleBlur = (
    event: React.FocusEvent<HTMLSpanElement>
  ): void => {
    setOpen(false);
    onBlur?.(event);
  };

  if (asChild) {
    return (
      <span
        ref={ref}
        aria-describedby={
          open
            ? contentId
            : undefined
        }
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={className}
        {...props}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      ref={ref}
      tabIndex={0}
      aria-describedby={
        open
          ? contentId
          : undefined
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={[
        "inline-flex",
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
    </span>
  );
});

TooltipTrigger.displayName =
  "TooltipTrigger";

/* ==================================================
   TOOLTIP CONTENT
================================================== */

export type TooltipContentProps =
  HTMLAttributes<HTMLDivElement> & {
    side?: TooltipSide;
    align?: TooltipAlign;
    children: ReactNode;
  };

const TOOLTIP_SIDE_CLASSES: Record<
  TooltipSide,
  string
> = {
  top: [
    "bottom-full",
    "mb-2",
  ].join(" "),

  right: [
    "left-full",
    "ml-2",
  ].join(" "),

  bottom: [
    "top-full",
    "mt-2",
  ].join(" "),

  left: [
    "right-full",
    "mr-2",
  ].join(" "),
};

const TOOLTIP_ALIGN_CLASSES: Record<
  TooltipSide,
  Record<TooltipAlign, string>
> = {
  top: {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  },

  bottom: {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  },

  left: {
    start: "top-0",
    center: "top-1/2 -translate-y-1/2",
    end: "bottom-0",
  },

  right: {
    start: "top-0",
    center: "top-1/2 -translate-y-1/2",
    end: "bottom-0",
  },
};

export const TooltipContent = forwardRef<
  HTMLDivElement,
  TooltipContentProps
>(function TooltipContent(
  {
    side = "top",
    align = "center",
    children,
    className = "",
    ...props
  },
  ref
) {
  const {
    open,
    contentId,
  } = useTooltipContext();

  if (!open) {
    return null;
  }

  return (
    <div
      ref={ref}
      id={contentId}
      role="tooltip"
      className={[
        "absolute",
        "z-50",
        "max-w-xs",
        "rounded-md",
        "border",
        "border-border",
        "bg-popover",
        "px-3",
        "py-2",
        "text-xs",
        "text-popover-foreground",
        "shadow-md",
        "animate-in",
        "fade-in-0",
        "zoom-in-95",
        TOOLTIP_SIDE_CLASSES[side],
        TOOLTIP_ALIGN_CLASSES[side][align],
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

TooltipContent.displayName =
  "TooltipContent";

/* ==================================================
   SIMPLE TOOLTIP
================================================== */

export type SimpleTooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  align?: TooltipAlign;
  className?: string;
  contentClassName?: string;
};

export function SimpleTooltip({
  content,
  children,
  side = "top",
  align = "center",
  className = "",
  contentClassName = "",
}: SimpleTooltipProps) {
  return (
    <Tooltip className={className}>
      <TooltipTrigger>
        {children}
      </TooltipTrigger>

      <TooltipContent
        side={side}
        align={align}
        className={contentClassName}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/* ==================================================
   EXAMPLE
================================================== */

/*

<Tooltip>
  <TooltipTrigger>
    Hover me
  </TooltipTrigger>

  <TooltipContent>
    This is a tooltip
  </TooltipContent>
</Tooltip>

<SimpleTooltip
  content="Open settings"
>
  <button type="button">
    Settings
  </button>
</SimpleTooltip>

*/