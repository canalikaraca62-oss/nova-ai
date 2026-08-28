"use client";

import {
  forwardRef,
  useId,
  useState,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type InputSize = "sm" | "md" | "lg";

export type InputState =
  | "default"
  | "error"
  | "success";

export type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  success?: ReactNode;

  leftIcon?: ReactNode;
  rightIcon?: ReactNode;

  size?: InputSize;
  loading?: boolean;

  containerClassName?: string;
  inputClassName?: string;
};

/* ==================================================
   SIZE CONFIG
================================================== */

export const INPUT_SIZE_CLASSES: Record<
  InputSize,
  {
    input: string;
    icon: string;
    leftPadding: string;
    rightPadding: string;
  }
> = {
  sm: {
    input:
      "h-8 rounded-md px-3 text-xs",
    icon:
      "h-3.5 w-3.5",
    leftPadding:
      "pl-9",
    rightPadding:
      "pr-9",
  },

  md: {
    input:
      "h-10 rounded-lg px-3.5 text-sm",
    icon:
      "h-4 w-4",
    leftPadding:
      "pl-10",
    rightPadding:
      "pr-10",
  },

  lg: {
    input:
      "h-12 rounded-xl px-4 text-base",
    icon:
      "h-5 w-5",
    leftPadding:
      "pl-12",
    rightPadding:
      "pr-12",
  },
};

/* ==================================================
   STATE CONFIG
================================================== */

export const INPUT_STATE_CLASSES: Record<
  InputState,
  string
> = {
  default:
    [
      "border-border",
      "bg-background",
      "text-foreground",
      "placeholder:text-muted-foreground",
      "hover:border-muted-foreground/50",
      "focus:border-primary",
      "focus:ring-2",
      "focus:ring-primary/20",
    ].join(" "),

  error:
    [
      "border-destructive",
      "bg-background",
      "text-foreground",
      "placeholder:text-muted-foreground",
      "focus:border-destructive",
      "focus:ring-2",
      "focus:ring-destructive/20",
    ].join(" "),

  success:
    [
      "border-emerald-500",
      "bg-background",
      "text-foreground",
      "placeholder:text-muted-foreground",
      "focus:border-emerald-500",
      "focus:ring-2",
      "focus:ring-emerald-500/20",
    ].join(" "),
};

/* ==================================================
   HELPERS
================================================== */

export function getInputSizeClasses(
  size: InputSize
) {
  return INPUT_SIZE_CLASSES[size];
}

export function getInputStateClasses(
  state: InputState
): string {
  return INPUT_STATE_CLASSES[state];
}

/* ==================================================
   MAIN INPUT
================================================== */

const Input = forwardRef<
  HTMLInputElement,
  InputProps
>(function Input(
  {
    id,
    label,
    description,
    error,
    success,
    leftIcon,
    rightIcon,
    size = "md",
    loading = false,
    disabled = false,
    className = "",
    containerClassName = "",
    inputClassName = "",
    type = "text",
    ...props
  },
  ref
) {
  const generatedId = useId();

  const inputId =
    id ?? generatedId;

  const hasError =
    error !== undefined &&
    error !== null &&
    error !== false;

  const hasSuccess =
    !hasError &&
    success !== undefined &&
    success !== null &&
    success !== false;

  const state: InputState =
    hasError
      ? "error"
      : hasSuccess
        ? "success"
        : "default";

  const styles =
    getInputSizeClasses(size);

  const helperId =
    `${inputId}-helper`;

  const hasHelper =
    Boolean(description) ||
    hasError ||
    hasSuccess;

  const hasRightElement =
    loading ||
    Boolean(rightIcon);

  const isDisabled =
    Boolean(disabled) ||
    loading;

  return (
    <div
      className={[
        "flex w-full flex-col gap-1.5",
        containerClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label ? (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
      ) : null}

      <div className="relative flex w-full items-center">
        {leftIcon ? (
          <span
            className={[
              "pointer-events-none",
              "absolute left-3 z-10",
              "flex items-center justify-center",
              "text-muted-foreground",
            ].join(" ")}
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={isDisabled}
          aria-invalid={
            hasError
              ? true
              : undefined
          }
          aria-describedby={
            hasHelper
              ? helperId
              : undefined
          }
          className={[
            "w-full border outline-none",
            "transition-all duration-200",
            "disabled:cursor-not-allowed",
            "disabled:opacity-50",
            styles.input,
            getInputStateClasses(state),
            leftIcon
              ? styles.leftPadding
              : "",
            hasRightElement
              ? styles.rightPadding
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
            className={[
              "pointer-events-none",
              "absolute right-3 z-10",
              "flex items-center justify-center",
              "text-muted-foreground",
            ].join(" ")}
            aria-hidden="true"
          >
            <Loader2
              className={[
                styles.icon,
                "animate-spin",
              ].join(" ")}
            />
          </span>
        ) : null}

        {!loading && rightIcon ? (
          <span
            className={[
              "absolute right-3 z-10",
              "flex items-center justify-center",
              "text-muted-foreground",
            ].join(" ")}
          >
            {rightIcon}
          </span>
        ) : null}
      </div>

      {description &&
      !hasError &&
      !hasSuccess ? (
        <p
          id={helperId}
          className="text-xs leading-5 text-muted-foreground"
        >
          {description}
        </p>
      ) : null}

      {hasError ? (
        <div
          id={helperId}
          className="flex items-start gap-1.5 text-xs leading-5 text-destructive"
        >
          <AlertCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />

          <span>
            {error}
          </span>
        </div>
      ) : null}

      {hasSuccess ? (
        <div
          id={helperId}
          className="flex items-start gap-1.5 text-xs leading-5 text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />

          <span>
            {success}
          </span>
        </div>
      ) : null}
    </div>
  );
});

Input.displayName = "Input";

export default Input;

/* ==================================================
   INPUT LABEL
================================================== */

export type InputLabelProps =
  LabelHTMLAttributes<HTMLLabelElement>;

export const InputLabel = forwardRef<
  HTMLLabelElement,
  InputLabelProps
>(function InputLabel(
  {
    children,
    className = "",
    ...props
  },
  ref
) {
  return (
    <label
      ref={ref}
      className={[
        "text-sm font-medium text-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </label>
  );
});

InputLabel.displayName =
  "InputLabel";

/* ==================================================
   INPUT ERROR
================================================== */

export type InputErrorProps =
  HTMLAttributes<HTMLParagraphElement>;

export const InputError = forwardRef<
  HTMLParagraphElement,
  InputErrorProps
>(function InputError(
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
        "text-xs leading-5 text-destructive",
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

InputError.displayName =
  "InputError";

/* ==================================================
   INPUT DESCRIPTION
================================================== */

export type InputDescriptionProps =
  HTMLAttributes<HTMLParagraphElement>;

export const InputDescription = forwardRef<
  HTMLParagraphElement,
  InputDescriptionProps
>(function InputDescription(
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
        "text-xs leading-5 text-muted-foreground",
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

InputDescription.displayName =
  "InputDescription";

/* ==================================================
   PASSWORD INPUT
================================================== */

export type PasswordInputProps =
  Omit<
    InputProps,
    "type" | "rightIcon"
  >;

export const PasswordInput = forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(function PasswordInput(
  {
    disabled = false,
    ...props
  },
  ref
) {
  const [visible, setVisible] =
    useState(false);

  const togglePasswordVisibility = () => {
    setVisible(
      (current) => !current
    );
  };

  return (
    <Input
      ref={ref}
      {...props}
      disabled={disabled}
      type={
        visible
          ? "text"
          : "password"
      }
      rightIcon={
        <button
          type="button"
          onClick={togglePasswordVisibility}
          disabled={disabled}
          aria-label={
            visible
              ? "Şifreyi gizle"
              : "Şifreyi göster"
          }
          aria-pressed={visible}
          className={[
            "flex h-7 w-7",
            "items-center justify-center",
            "rounded-md",
            "text-muted-foreground",
            "transition-colors duration-200",
            "hover:bg-muted",
            "hover:text-foreground",
            "focus-visible:outline-none",
            "focus-visible:ring-2",
            "focus-visible:ring-primary/30",
            "disabled:pointer-events-none",
            "disabled:opacity-50",
          ].join(" ")}
        >
          {visible ? (
            <EyeOff
              className="h-4 w-4"
              aria-hidden="true"
            />
          ) : (
            <Eye
              className="h-4 w-4"
              aria-hidden="true"
            />
          )}
        </button>
      }
    />
  );
});

PasswordInput.displayName =
  "PasswordInput";