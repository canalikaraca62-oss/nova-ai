"use client";

import {
  forwardRef,
  useEffect,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  Loader2,
  Search,
  X,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type SearchInputSize =
  | "sm"
  | "md"
  | "lg";

export type SearchInputProps =
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "size" | "type" | "value" | "defaultValue" | "onChange"
  > & {
    value?: string;

    defaultValue?: string;

    onValueChange?: (
      value: string
    ) => void;

    onSearch?: (
      value: string
    ) => void;

    size?: SearchInputSize;

    loading?: boolean;

    clearable?: boolean;

    shortcut?: ReactNode;

    containerClassName?: string;

    inputClassName?: string;
  };

/* ==================================================
   SIZE CONFIG
================================================== */

const SEARCH_INPUT_SIZE_CLASSES: Record<
  SearchInputSize,
  {
    container: string;
    input: string;
    leftIcon: string;
    rightIcon: string;
    clearButton: string;
  }
> = {
  sm: {
    container: "h-8 rounded-md",
    input: "px-9 text-xs",
    leftIcon: "left-2.5 h-3.5 w-3.5",
    rightIcon: "right-2.5 h-3.5 w-3.5",
    clearButton: "h-6 w-6",
  },

  md: {
    container: "h-10 rounded-lg",
    input: "px-10 text-sm",
    leftIcon: "left-3 h-4 w-4",
    rightIcon: "right-3 h-4 w-4",
    clearButton: "h-7 w-7",
  },

  lg: {
    container: "h-12 rounded-xl",
    input: "px-12 text-base",
    leftIcon: "left-4 h-5 w-5",
    rightIcon: "right-4 h-5 w-5",
    clearButton: "h-8 w-8",
  },
};

/* ==================================================
   MAIN COMPONENT
================================================== */

const SearchInput = forwardRef<
  HTMLInputElement,
  SearchInputProps
>(function SearchInput(
  {
    value,
    defaultValue = "",
    onValueChange,
    onSearch,

    size = "md",
    loading = false,
    clearable = true,
    shortcut,

    disabled = false,

    placeholder = "Search...",

    className = "",
    containerClassName = "",
    inputClassName = "",

    onKeyDown,

    ...props
  },
  ref
) {
  const isControlled =
    value !== undefined;

  const [internalValue, setInternalValue] =
    useState<string>(defaultValue);

  const currentValue =
    isControlled
      ? value ?? ""
      : internalValue;

  const sizeClasses =
    SEARCH_INPUT_SIZE_CLASSES[size];

  /* ==================================================
     SYNC DEFAULT VALUE FOR UNCONTROLLED MODE
  ================================================== */

  useEffect(() => {
    if (!isControlled) {
      setInternalValue(defaultValue);
    }
  }, [
    defaultValue,
    isControlled,
  ]);

  /* ==================================================
     VALUE CHANGE
  ================================================== */

  const updateValue = (
    nextValue: string
  ) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  };

  /* ==================================================
     CLEAR
  ================================================== */

  const handleClear = () => {
    if (disabled || loading) {
      return;
    }

    updateValue("");

    onSearch?.("");
  };

  /* ==================================================
     KEYBOARD
  ================================================== */

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    onKeyDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (event.key === "Enter") {
      onSearch?.(currentValue);

      return;
    }

    if (
      event.key === "Escape" &&
      currentValue
    ) {
      event.preventDefault();

      handleClear();
    }
  };

  const isDisabled =
    Boolean(disabled) ||
    loading;

  const showClearButton =
    clearable &&
    !loading &&
    !disabled &&
    currentValue.length > 0;

  const showShortcut =
    Boolean(shortcut) &&
    !showClearButton &&
    !loading;

  return (
    <div
      className={[
        "relative flex w-full items-center",
        sizeClasses.container,
        containerClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Search
        aria-hidden="true"
        className={[
          "pointer-events-none absolute z-10",
          "shrink-0 text-muted-foreground",
          sizeClasses.leftIcon,
        ].join(" ")}
      />

      <input
        ref={ref}
        type="search"
        value={currentValue}
        disabled={isDisabled}
        placeholder={placeholder}
        onChange={(event) => {
          updateValue(
            event.currentTarget.value
          );
        }}
        onKeyDown={handleKeyDown}
        className={[
          "h-full w-full border border-border",
          "bg-background text-foreground",
          "outline-none",
          "transition-all duration-200",
          "placeholder:text-muted-foreground",
          "hover:border-muted-foreground/50",
          "focus:border-primary",
          "focus:ring-2 focus:ring-primary/20",
          "disabled:cursor-not-allowed",
          "disabled:opacity-50",
          sizeClasses.input,
          showClearButton ||
          loading ||
          showShortcut
            ? "pr-10"
            : "",
          className,
          inputClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />

      {loading ? (
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute z-10",
            "flex items-center justify-center",
            "text-muted-foreground",
            sizeClasses.rightIcon,
          ].join(" ")}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      ) : null}

      {showClearButton ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className={[
            "absolute z-10",
            "flex items-center justify-center",
            "rounded-md",
            "text-muted-foreground",
            "transition-colors duration-200",
            "hover:bg-muted",
            "hover:text-foreground",
            "focus-visible:outline-none",
            "focus-visible:ring-2",
            "focus-visible:ring-primary/30",
            sizeClasses.rightIcon,
            sizeClasses.clearButton,
          ].join(" ")}
        >
          <X
            className="h-4 w-4"
            aria-hidden="true"
          />
        </button>
      ) : null}

      {showShortcut ? (
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute z-10",
            "inline-flex items-center justify-center",
            "text-muted-foreground",
            sizeClasses.rightIcon,
          ].join(" ")}
        >
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none">
            {shortcut}
          </kbd>
        </span>
      ) : null}
    </div>
  );
});

SearchInput.displayName =
  "SearchInput";

export default SearchInput;

/* ==================================================
   SEARCH BUTTON
================================================== */

export type SearchButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement>;

export const SearchButton = forwardRef<
  HTMLButtonElement,
  SearchButtonProps
>(function SearchButton(
  {
    children = "Search",
    className = "",
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        "inline-flex items-center justify-center gap-2",
        "rounded-lg bg-primary px-3 py-2",
        "text-sm font-medium text-primary-foreground",
        "transition-colors",
        "hover:bg-primary/90",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-primary/30",
        "disabled:pointer-events-none",
        "disabled:opacity-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <Search
        className="h-4 w-4"
        aria-hidden="true"
      />

      {children}
    </button>
  );
});

SearchButton.displayName =
  "SearchButton";