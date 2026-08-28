"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { X } from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type DialogSize =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "full";

export type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
};

export type DialogProps = {
  children: ReactNode;

  open?: boolean;

  defaultOpen?: boolean;

  onOpenChange?: (
    open: boolean
  ) => void;
};

/* ==================================================
   CONTEXT
================================================== */

const DialogContext =
  createContext<DialogContextValue | null>(
    null
  );

function useDialogContext(): DialogContextValue {
  const context =
    useContext(DialogContext);

  if (!context) {
    throw new Error(
      "Dialog components must be used inside <Dialog>."
    );
  }

  return context;
}

/* ==================================================
   MAIN DIALOG PROVIDER
================================================== */

export function Dialog({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] =
    useState(defaultOpen);

  const isControlled =
    controlledOpen !== undefined;

  const open =
    isControlled
      ? controlledOpen
      : uncontrolledOpen;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <DialogContext.Provider
      value={{
        open,
        setOpen,
        close,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

/* ==================================================
   DIALOG TRIGGER
================================================== */

export type DialogTriggerProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
  };

export const DialogTrigger = forwardRef<
  HTMLButtonElement,
  DialogTriggerProps
>(function DialogTrigger(
  {
    children,
    onClick,
    asChild = false,
    ...props
  },
  ref
) {
  const { setOpen } =
    useDialogContext();

  const handleClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    onClick?.(event);

    if (!event.defaultPrevented) {
      setOpen(true);
    }
  };

  if (asChild) {
    return (
      <span
        onClick={() => setOpen(true)}
      >
        {children}
      </span>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
});

DialogTrigger.displayName =
  "DialogTrigger";

/* ==================================================
   DIALOG PORTAL
================================================== */

export type DialogPortalProps = {
  children: ReactNode;
};

export function DialogPortal({
  children,
}: DialogPortalProps) {
  return <>{children}</>;
}

/* ==================================================
   DIALOG OVERLAY
================================================== */

export type DialogOverlayProps =
  HTMLAttributes<HTMLDivElement>;

export const DialogOverlay = forwardRef<
  HTMLDivElement,
  DialogOverlayProps
>(function DialogOverlay(
  {
    className = "",
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={[
        "fixed inset-0 z-50",
        "bg-black/50",
        "backdrop-blur-[1px]",
        "animate-in fade-in duration-200",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});

DialogOverlay.displayName =
  "DialogOverlay";

/* ==================================================
   SIZE CLASSES
================================================== */

const DIALOG_SIZE_CLASSES: Record<
  DialogSize,
  string
> = {
  sm: "max-w-sm",

  md: "max-w-lg",

  lg: "max-w-2xl",

  xl: "max-w-4xl",

  full:
    "h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]",
};

/* ==================================================
   DIALOG CONTENT
================================================== */

export type DialogContentProps =
  HTMLAttributes<HTMLDivElement> & {
    size?: DialogSize;

    closeOnOverlayClick?: boolean;

    closeOnEscape?: boolean;

    showCloseButton?: boolean;
  };

export const DialogContent = forwardRef<
  HTMLDivElement,
  DialogContentProps
>(function DialogContent(
  {
    children,
    size = "md",
    closeOnOverlayClick = true,
    closeOnEscape = true,
    showCloseButton = true,
    className = "",
    ...props
  },
  ref
) {
  const {
    open,
    close,
  } = useDialogContext();

  const contentRef =
    useRef<HTMLDivElement | null>(null);

  const titleId =
    useId();

  useEffect(() => {
    if (!open || !closeOnEscape) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent | globalThis.KeyboardEvent
    ): void => {
      if (event.key === "Escape") {
        close();
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
  }, [
    open,
    close,
    closeOnEscape,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = (): void => {
    if (closeOnOverlayClick) {
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <DialogOverlay
        onClick={handleOverlayClick}
      />

      <div
        ref={(node) => {
          contentRef.current = node;

          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          "relative z-[51]",
          "flex w-full flex-col",
          "overflow-hidden",
          "rounded-2xl",
          "border border-border",
          "bg-background",
          "text-foreground",
          "shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
          DIALOG_SIZE_CLASSES[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        <DialogTitleIdContext.Provider
          value={titleId}
        >
          {children}
        </DialogTitleIdContext.Provider>

        {showCloseButton ? (
          <button
            type="button"
            onClick={close}
            aria-label="Close dialog"
            className={[
              "absolute right-4 top-4 z-10",
              "inline-flex h-8 w-8",
              "items-center justify-center",
              "rounded-lg",
              "text-muted-foreground",
              "transition-colors",
              "hover:bg-muted",
              "hover:text-foreground",
              "focus-visible:outline-none",
              "focus-visible:ring-2",
              "focus-visible:ring-primary/30",
            ].join(" ")}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
});

DialogContent.displayName =
  "DialogContent";

/* ==================================================
   TITLE ID CONTEXT
================================================== */

const DialogTitleIdContext =
  createContext<string | null>(null);

/* ==================================================
   DIALOG HEADER
================================================== */

export type DialogHeaderProps =
  HTMLAttributes<HTMLDivElement>;

export function DialogHeader({
  children,
  className = "",
  ...props
}: DialogHeaderProps) {
  return (
    <div
      className={[
        "flex flex-col gap-1.5",
        "border-b border-border",
        "px-6 py-5",
        "pr-14",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==================================================
   DIALOG TITLE
================================================== */

export type DialogTitleProps =
  HTMLAttributes<HTMLHeadingElement>;

export const DialogTitle = forwardRef<
  HTMLHeadingElement,
  DialogTitleProps
>(function DialogTitle(
  {
    children,
    className = "",
    id,
    ...props
  },
  ref
) {
  const contextId =
    useContext(
      DialogTitleIdContext
    );

  return (
    <h2
      ref={ref}
      id={id ?? contextId ?? undefined}
      className={[
        "text-lg font-semibold",
        "tracking-tight",
        "text-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </h2>
  );
});

DialogTitle.displayName =
  "DialogTitle";

/* ==================================================
   DIALOG DESCRIPTION
================================================== */

export type DialogDescriptionProps =
  HTMLAttributes<HTMLParagraphElement>;

export const DialogDescription =
  forwardRef<
    HTMLParagraphElement,
    DialogDescriptionProps
  >(function DialogDescription(
    {
      children,
      className = "",
      ...props
    },
    ref
  ) {
    return (
      <p
        ref={ref}
        className={[
          "text-sm",
          "leading-6",
          "text-muted-foreground",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </p>
    );
  });

DialogDescription.displayName =
  "DialogDescription";

/* ==================================================
   DIALOG BODY
================================================== */

export type DialogBodyProps =
  HTMLAttributes<HTMLDivElement>;

export function DialogBody({
  children,
  className = "",
  ...props
}: DialogBodyProps) {
  return (
    <div
      className={[
        "min-h-0 flex-1",
        "overflow-y-auto",
        "px-6 py-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==================================================
   DIALOG FOOTER
================================================== */

export type DialogFooterProps =
  HTMLAttributes<HTMLDivElement> & {
    align?:
      | "start"
      | "center"
      | "end"
      | "between";
  };

export function DialogFooter({
  children,
  align = "end",
  className = "",
  ...props
}: DialogFooterProps) {
  const alignment: Record<
    NonNullable<DialogFooterProps["align"]>,
    string
  > = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
  };

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-3",
        "border-t border-border",
        "px-6 py-4",
        alignment[align],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==================================================
   DIALOG CLOSE
================================================== */

export type DialogCloseProps =
  ButtonHTMLAttributes<HTMLButtonElement>;

export const DialogClose = forwardRef<
  HTMLButtonElement,
  DialogCloseProps
>(function DialogClose(
  {
    children,
    onClick,
    ...props
  },
  ref
) {
  const { close } =
    useDialogContext();

  const handleClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    onClick?.(event);

    if (!event.defaultPrevented) {
      close();
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
});

DialogClose.displayName =
  "DialogClose";

/* ==================================================
   SIMPLE DIALOG
================================================== */

export type SimpleDialogProps = {
  open: boolean;

  onOpenChange: (
    open: boolean
  ) => void;

  title?: ReactNode;

  description?: ReactNode;

  children?: ReactNode;

  footer?: ReactNode;

  size?: DialogSize;

  closeOnOverlayClick?: boolean;

  closeOnEscape?: boolean;
};

export function SimpleDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: SimpleDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        size={size}
        closeOnOverlayClick={
          closeOnOverlayClick
        }
        closeOnEscape={
          closeOnEscape
        }
      >
        {title || description ? (
          <DialogHeader>
            {title ? (
              <DialogTitle>
                {title}
              </DialogTitle>
            ) : null}

            {description ? (
              <DialogDescription>
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
        ) : null}

        {children ? (
          <DialogBody>
            {children}
          </DialogBody>
        ) : null}

        {footer ? (
          <DialogFooter>
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}