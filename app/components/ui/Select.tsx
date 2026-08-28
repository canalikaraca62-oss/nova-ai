"use client";

import {
  forwardRef,
  useId,
  type HTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type SelectSize =
  | "sm"
  | "md"
  | "lg";

export type SelectState =
  | "default"
  | "error"
  | "success";

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type SelectOptionGroup = {
  label: string;
  options: SelectOption[];
};

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size" | "children"
> & {
  label?: ReactNode;

  description?: ReactNode;

  error?: ReactNode;

  success?: ReactNode;

  size?: SelectSize;

  options?: SelectOption[];

  groups?: SelectOptionGroup[];

  placeholder?: string;

  containerClassName?: string;

  selectClassName?: string;

  children?: ReactNode;
};

/* ==================================================
   SIZE CONFIG
================================================== */

export const SELECT_SIZE_CLASSES: Record<
  SelectSize,
  {
    select: string;
    icon: string;
  }
> = {
  sm: {
    select:
      "h-8 rounded-md px-3 pr-9 text-xs",
    icon:
      "right-2.5 h-3.5 w-3.5",
  },

  md: {
    select:
      "h-10 rounded-lg px-3.5 pr-10 text-sm",
    icon:
      "right-3 h-4 w-4",
  },

  lg: {
    select:
      "h-12 rounded-xl px-4 pr-12 text-base",
    icon:
      "right-4 h-5 w-5",
  },
};

/* ==================================================
   STATE CONFIG
================================================== */

export const SELECT_STATE_CLASSES: Record<
  SelectState,
  string
> = {
  default: [
    "border-border",
    "bg-background",
    "text-foreground",
    "hover:border-muted-foreground/50",
    "focus:border-primary",
    "focus:ring-2",
    "focus:ring-primary/20",
  ].join(" "),

  error: [
    "border-destructive",
    "bg-background",
    "text-foreground",
    "focus:border-destructive",
    "focus:ring-2",
    "focus:ring-destructive/20",
  ].join(" "),

  success: [
    "border-emerald-500",
    "bg-background",
    "text-foreground",
    "focus:border-emerald-500",
    "focus:ring-2",
    "focus:ring-emerald-500/20",
  ].join(" "),
};

/* ==================================================
   HELPERS
================================================== */

export function getSelectSizeClasses(
  size: SelectSize
) {
  return SELECT_SIZE_CLASSES[size];
}

export function getSelectStateClasses(
  state: SelectState
): string {
  return SELECT_STATE_CLASSES[state];
}

/* ==================================================
   MAIN SELECT
================================================== */

const Select = forwardRef<
  HTMLSelectElement,
  SelectProps
>(function Select(
  {
    id,
    label,
    description,
    error,
    success,

    size = "md",

    options,
    groups,

    placeholder,

    disabled = false,

    required = false,

    className = "",
    containerClassName = "",
    selectClassName = "",

    children,

    ...props
  },
  ref
) {
  const generatedId = useId();

  const selectId =
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

  const state: SelectState =
    hasError
      ? "error"
      : hasSuccess
        ? "success"
        : "default";

  const sizeClasses =
    getSelectSizeClasses(size);

  const helperId =
    `${selectId}-helper`;

  const hasHelper =
    Boolean(description) ||
    hasError ||
    hasSuccess;

  const hasOptions =
    Boolean(options?.length);

  const hasGroups =
    Boolean(groups?.length);

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
          htmlFor={selectId}
          className="flex items-center gap-1 text-sm font-medium text-foreground"
        >
          {label}

          {required ? (
            <span
              className="text-destructive"
              aria-hidden="true"
            >
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="relative w-full">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          required={required}
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
            "w-full appearance-none border",
            "outline-none",
            "transition-all duration-200",
            "disabled:cursor-not-allowed",
            "disabled:opacity-50",
            sizeClasses.select,
            getSelectStateClasses(state),
            className,
            selectClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          {placeholder ? (
            <option
              value=""
              disabled={required}
            >
              {placeholder}
            </option>
          ) : null}

          {hasOptions
            ? options?.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                )
              )
            : null}

          {hasGroups
            ? groups?.map(
                (group) => (
                  <optgroup
                    key={group.label}
                    label={group.label}
                  >
                    {group.options.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={
                            option.disabled
                          }
                        >
                          {option.label}
                        </option>
                      )
                    )}
                  </optgroup>
                )
              )
            : null}

          {children}
        </select>

        <ChevronDown
          aria-hidden="true"
          className={[
            "pointer-events-none",
            "absolute top-1/2 z-10",
            "-translate-y-1/2",
            "shrink-0",
            "text-muted-foreground",
            sizeClasses.icon,
          ].join(" ")}
        />
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

Select.displayName = "Select";

export default Select;

/* ==================================================
   SELECT OPTION
================================================== */

export type SelectOptionProps =
  React.OptionHTMLAttributes<HTMLOptionElement>;

export const SelectOption = forwardRef<
  HTMLOptionElement,
  SelectOptionProps
>(function SelectOption(
  {
    children,
    ...props
  },
  ref
) {
  return (
    <option
      ref={ref}
      {...props}
    >
      {children}
    </option>
  );
});

SelectOption.displayName =
  "SelectOption";

/* ==================================================
   SELECT GROUP
================================================== */

export type SelectGroupProps =
  React.OptgroupHTMLAttributes<HTMLOptGroupElement>;

export const SelectGroup = forwardRef<
  HTMLOptGroupElement,
  SelectGroupProps
>(function SelectGroup(
  {
    children,
    ...props
  },
  ref
) {
  return (
    <optgroup
      ref={ref}
      {...props}
    >
      {children}
    </optgroup>
  );
});

SelectGroup.displayName =
  "SelectGroup";

/* ==================================================
   SELECT LABEL
================================================== */

export type SelectLabelProps =
  React.LabelHTMLAttributes<HTMLLabelElement>;

export const SelectLabel = forwardRef<
  HTMLLabelElement,
  SelectLabelProps
>(function SelectLabel(
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

SelectLabel.displayName =
  "SelectLabel";

/* ==================================================
   SELECT DESCRIPTION
================================================== */

export type SelectDescriptionProps =
  HTMLAttributes<HTMLParagraphElement>;

export const SelectDescription = forwardRef<
  HTMLParagraphElement,
  SelectDescriptionProps
>(function SelectDescription(
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

SelectDescription.displayName =
  "SelectDescription";

/* ==================================================
   SELECT ERROR
================================================== */

export type SelectErrorProps =
  HTMLAttributes<HTMLParagraphElement>;

export const SelectError = forwardRef<
  HTMLParagraphElement,
  SelectErrorProps
>(function SelectError(
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

SelectError.displayName =
  "SelectError";