"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

import { createPortal } from "react-dom";

import {
  X,
  type LucideIcon,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type ModalSize =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "full";

export type ModalProps =
  Omit<
    HTMLAttributes<HTMLDivElement>,
    "title"
  > & {
    open?: boolean;
    defaultOpen?: boolean;

    onOpenChange?: (
      open: boolean
    ) => void;

    onClose?: () => void;

    closeOnEscape?: boolean;
    closeOnOverlayClick?: boolean;

    showCloseButton?: boolean;

    size?: ModalSize;

    title?: ReactNode;
    description?: ReactNode;

    header?: ReactNode;
    footer?: ReactNode;

    children?: ReactNode;

    overlayClassName?: string;
    contentClassName?: string;
  };

export type ModalTriggerProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    onOpenModal?: () => void;
  };

export type ModalHeaderProps =
  HTMLAttributes<HTMLDivElement>;

export type ModalBodyProps =
  HTMLAttributes<HTMLDivElement>;

export type ModalFooterProps =
  HTMLAttributes<HTMLDivElement>;

export type ModalTitleProps =
  HTMLAttributes<HTMLHeadingElement>;

export type ModalDescriptionProps =
  HTMLAttributes<HTMLParagraphElement>;

export type ModalCloseButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    onClose?: () => void;
  };

export type ModalIconProps =
  HTMLAttributes<HTMLDivElement> & {
    icon: LucideIcon;
  };

/* ==================================================
   HELPERS
================================================== */

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function getFocusableElements(
  container: HTMLElement
): HTMLElement[] {
  const selector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(",");

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      selector
    )
  ).filter((element) => {
    if (
      element.getAttribute("aria-hidden") ===
      "true"
    ) {
      return false;
    }

    return (
      !element.hasAttribute("disabled") &&
      element.tabIndex >= 0
    );
  });
}

/* ==================================================
   SIZE CONFIG
================================================== */

const MODAL_SIZE_CLASSES: Record<
  ModalSize,
  string
> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",

  full: [
    "h-[calc(100vh-2rem)]",
    "max-w-[calc(100vw-2rem)]",
  ].join(" "),
};

/* ==================================================
   MAIN MODAL
================================================== */

const Modal = forwardRef<
  HTMLDivElement,
  ModalProps
>(function Modal(
  {
    open,
    defaultOpen = false,

    onOpenChange,
    onClose,

    closeOnEscape = true,
    closeOnOverlayClick = true,

    showCloseButton = true,

    size = "md",

    title,
    description,

    header,
    footer,

    children,

    overlayClassName = "",
    contentClassName = "",
    className = "",

    ...props
  },
  forwardedRef
) {
  const [
    internalOpen,
    setInternalOpen,
  ] = useState<boolean>(
    defaultOpen
  );

  const isControlled =
    open !== undefined;

  const isOpen = isControlled
    ? Boolean(open)
    : internalOpen;

  const contentRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const previousActiveElementRef =
    useRef<HTMLElement | null>(
      null
    );

  const titleId = useId();
  const descriptionId = useId();

  const setModalRef = (
    element: HTMLDivElement | null
  ): void => {
    contentRef.current = element;

    if (
      typeof forwardedRef === "function"
    ) {
      forwardedRef(element);
      return;
    }

    if (forwardedRef) {
      forwardedRef.current = element;
    }
  };

  const requestOpenChange = (
    nextOpen: boolean
  ): void => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);

    if (!nextOpen) {
      onClose?.();
    }
  };

  const closeModal = (): void => {
    requestOpenChange(false);
  };

  /* ==================================================
     ESCAPE + FOCUS TRAP + SCROLL LOCK
  ================================================== */

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }

    previousActiveElementRef.current =
      document.activeElement instanceof
      HTMLElement
        ? document.activeElement
        : null;

    const previousBodyOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown = (
      event: KeyboardEvent
    ): void => {
      if (
        event.key === "Escape" &&
        closeOnEscape
      ) {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const container =
        contentRef.current;

      if (!container) {
        return;
      }

      const focusableElements =
        getFocusableElements(container);

      if (
        focusableElements.length === 0
      ) {
        event.preventDefault();
        container.focus();
        return;
      }

      const firstElement =
        focusableElements[0];

      const lastElement =
        focusableElements.at(-1);

      /*
       * TypeScript strict +
       * noUncheckedIndexedAccess safety.
       */
      if (
        !firstElement ||
        !lastElement
      ) {
        event.preventDefault();
        container.focus();
        return;
      }

      const activeElement =
        document.activeElement;

      if (event.shiftKey) {
        if (
          activeElement === firstElement ||
          !container.contains(
            activeElement
          )
        ) {
          event.preventDefault();
          lastElement.focus();
        }

        return;
      }

      if (
        activeElement === lastElement ||
        !container.contains(
          activeElement
        )
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    const focusTimer =
      window.setTimeout(() => {
        const container =
          contentRef.current;

        if (!container) {
          return;
        }

        const focusableElements =
          getFocusableElements(container);

        const firstElement =
          focusableElements[0];

        if (firstElement) {
          firstElement.focus();
          return;
        }

        container.focus();
      }, 0);

    return (): void => {
      document.body.style.overflow =
        previousBodyOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

      window.clearTimeout(
        focusTimer
      );

      const previousElement =
        previousActiveElementRef.current;

      if (
        previousElement &&
        document.contains(
          previousElement
        )
      ) {
        previousElement.focus();
      }
    };
  }, [
    isOpen,
    closeOnEscape,
    onClose,
    onOpenChange,
    isControlled,
  ]);

  if (!isOpen) {
    return null;
  }

  if (
    typeof document === "undefined"
  ) {
    return null;
  }

  const hasTitle =
    title !== undefined &&
    title !== null;

  const hasDescription =
    description !== undefined &&
    description !== null;

  const defaultHeader =
    hasTitle || hasDescription ? (
      <ModalHeader>
        <div className="min-w-0 flex-1">
          {hasTitle ? (
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              {title}
            </h2>
          ) : null}

          {hasDescription ? (
            <p
              id={descriptionId}
              className="mt-1 text-sm leading-6 text-muted-foreground"
            >
              {description}
            </p>
          ) : null}
        </div>

        {showCloseButton ? (
          <ModalCloseButton
            onClose={closeModal}
          />
        ) : null}
      </ModalHeader>
    ) : showCloseButton ? (
      <div className="absolute right-4 top-4 z-20">
        <ModalCloseButton
          onClose={closeModal}
        />
      </div>
    ) : null;

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 z-[100]",
        "flex items-center justify-center",
        "p-4 sm:p-6",
        overlayClassName
      )}
    >
      {/* Overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onMouseDown={() => {
          if (closeOnOverlayClick) {
            closeModal();
          }
        }}
      />

      {/* Dialog */}
      <div
        ref={setModalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          hasTitle
            ? titleId
            : undefined
        }
        aria-describedby={
          hasDescription
            ? descriptionId
            : undefined
        }
        tabIndex={-1}
        className={cn(
          "relative z-10",
          "flex w-full flex-col",
          "overflow-hidden",
          "border border-border",
          "bg-background",
          "shadow-2xl",
          "animate-in fade-in-0 zoom-in-95",
          "duration-200",
          "rounded-xl",
          MODAL_SIZE_CLASSES[size],
          contentClassName,
          className
        )}
        {...props}
      >
        {header ?? defaultHeader}

        <ModalBody>
          {children}
        </ModalBody>

        {footer ?? null}
      </div>
    </div>
  );

  return createPortal(
    modalContent,
    document.body
  );
});

Modal.displayName = "Modal";

export default Modal;

/* ==================================================
   MODAL TRIGGER
================================================== */

export const ModalTrigger =
  forwardRef<
    HTMLButtonElement,
    ModalTriggerProps
  >(function ModalTrigger(
    {
      children,
      onClick,
      onOpenModal,
      type = "button",
      ...props
    },
    ref
  ) {
    const handleClick = (
      event: MouseEvent<HTMLButtonElement>
    ): void => {
      onClick?.(event);

      if (event.defaultPrevented) {
        return;
      }

      onOpenModal?.();
    };

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  });

ModalTrigger.displayName =
  "ModalTrigger";

/* ==================================================
   MODAL HEADER
================================================== */

export const ModalHeader =
  forwardRef<
    HTMLDivElement,
    ModalHeaderProps
  >(function ModalHeader(
    {
      children,
      className = "",
      ...props
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-start",
          "justify-between",
          "gap-4",
          "border-b border-border",
          "px-5 py-4",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  });

ModalHeader.displayName =
  "ModalHeader";

/* ==================================================
   MODAL BODY
================================================== */

export const ModalBody =
  forwardRef<
    HTMLDivElement,
    ModalBodyProps
  >(function ModalBody(
    {
      children,
      className = "",
      ...props
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          "min-h-0 flex-1",
          "overflow-y-auto",
          "px-5 py-4",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  });

ModalBody.displayName =
  "ModalBody";

/* ==================================================
   MODAL FOOTER
================================================== */

export const ModalFooter =
  forwardRef<
    HTMLDivElement,
    ModalFooterProps
  >(function ModalFooter(
    {
      children,
      className = "",
      ...props
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col-reverse",
          "gap-2",
          "border-t border-border",
          "px-5 py-4",
          "sm:flex-row",
          "sm:items-center",
          "sm:justify-end",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  });

ModalFooter.displayName =
  "ModalFooter";

/* ==================================================
   MODAL TITLE
================================================== */

export const ModalTitle =
  forwardRef<
    HTMLHeadingElement,
    ModalTitleProps
  >(function ModalTitle(
    {
      children,
      className = "",
      ...props
    },
    ref
  ) {
    return (
      <h2
        ref={ref}
        className={cn(
          "text-lg font-semibold",
          "tracking-tight",
          "text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </h2>
    );
  });

ModalTitle.displayName =
  "ModalTitle";

/* ==================================================
   MODAL DESCRIPTION
================================================== */

export const ModalDescription =
  forwardRef<
    HTMLParagraphElement,
    ModalDescriptionProps
  >(function ModalDescription(
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
        className={cn(
          "mt-1 text-sm",
          "leading-6",
          "text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
      </p>
    );
  });

ModalDescription.displayName =
  "ModalDescription";

/* ==================================================
   MODAL CLOSE BUTTON
================================================== */

export const ModalCloseButton =
  forwardRef<
    HTMLButtonElement,
    ModalCloseButtonProps
  >(function ModalCloseButton(
    {
      onClose,
      onClick,
      type = "button",
      className = "",
      ...props
    },
    ref
  ) {
    const handleClick = (
      event: MouseEvent<HTMLButtonElement>
    ): void => {
      onClick?.(event);

      if (event.defaultPrevented) {
        return;
      }

      onClose?.();
    };

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        aria-label="Close modal"
        className={cn(
          "inline-flex h-9 w-9",
          "shrink-0 items-center",
          "justify-center rounded-lg",
          "text-muted-foreground",
          "transition-colors",
          "hover:bg-muted",
          "hover:text-foreground",
          "focus-visible:outline-none",
          "focus-visible:ring-2",
          "focus-visible:ring-primary/30",
          className
        )}
        {...props}
      >
        <X
          className="h-4 w-4"
          aria-hidden="true"
        />
      </button>
    );
  });

ModalCloseButton.displayName =
  "ModalCloseButton";

/* ==================================================
   MODAL ICON
================================================== */

export const ModalIcon =
  forwardRef<
    HTMLDivElement,
    ModalIconProps
  >(function ModalIcon(
    {
      icon: Icon,
      className = "",
      ...props
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-10 w-10",
          "items-center justify-center",
          "rounded-xl",
          "bg-primary/10",
          "text-primary",
          className
        )}
        {...props}
      >
        <Icon
          className="h-5 w-5"
          aria-hidden="true"
        />
      </div>
    );
  });

ModalIcon.displayName =
  "ModalIcon";