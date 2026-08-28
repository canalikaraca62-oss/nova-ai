"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Bell,
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Globe2,
  Pause,
  Play,
  Plus,
  Repeat2,
  Save,
  Trash2,
  X,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type TaskScheduleFrequency =
  | "once"
  | "daily"
  | "weekly"
  | "monthly"
  | "custom";

export type TaskScheduleStatus =
  | "active"
  | "paused";

export type TaskScheduleDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type TaskScheduleReminder = {
  id: string;
  minutesBefore: number;
};

export type TaskScheduleValue = {
  id?: string;

  enabled: boolean;

  status: TaskScheduleStatus;

  frequency: TaskScheduleFrequency;

  startDate: string;

  time: string;

  timezone: string;

  daysOfWeek: TaskScheduleDay[];

  dayOfMonth?: number;

  interval?: number;

  reminders: TaskScheduleReminder[];
};

export type TaskScheduleProps = {
  initialValue?: Partial<TaskScheduleValue>;

  onSave?: (
    value: TaskScheduleValue
  ) => void | Promise<void>;

  onCancel?: () => void;

  onDelete?: (
    value: TaskScheduleValue
  ) => void | Promise<void>;

  className?: string;

  compact?: boolean;
};

/* ==================================================
   CONSTANTS
================================================== */

const WEEK_DAYS: {
  value: TaskScheduleDay;
  label: string;
  shortLabel: string;
}[] = [
  {
    value: "monday",
    label: "Monday",
    shortLabel: "Mon",
  },
  {
    value: "tuesday",
    label: "Tuesday",
    shortLabel: "Tue",
  },
  {
    value: "wednesday",
    label: "Wednesday",
    shortLabel: "Wed",
  },
  {
    value: "thursday",
    label: "Thursday",
    shortLabel: "Thu",
  },
  {
    value: "friday",
    label: "Friday",
    shortLabel: "Fri",
  },
  {
    value: "saturday",
    label: "Saturday",
    shortLabel: "Sat",
  },
  {
    value: "sunday",
    label: "Sunday",
    shortLabel: "Sun",
  },
];

const FREQUENCY_OPTIONS: {
  value: TaskScheduleFrequency;
  label: string;
  description: string;
}[] = [
  {
    value: "once",
    label: "Once",
    description: "Run a single time",
  },
  {
    value: "daily",
    label: "Daily",
    description: "Run every day",
  },
  {
    value: "weekly",
    label: "Weekly",
    description: "Run on selected days",
  },
  {
    value: "monthly",
    label: "Monthly",
    description: "Run once each month",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Run on a custom interval",
  },
];

const REMINDER_OPTIONS: {
  value: number;
  label: string;
}[] = [
  {
    value: 5,
    label: "5 minutes before",
  },
  {
    value: 10,
    label: "10 minutes before",
  },
  {
    value: 15,
    label: "15 minutes before",
  },
  {
    value: 30,
    label: "30 minutes before",
  },
  {
    value: 60,
    label: "1 hour before",
  },
  {
    value: 120,
    label: "2 hours before",
  },
  {
    value: 1440,
    label: "1 day before",
  },
];

const DEFAULT_TIMEZONE =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions()
        .timeZone
    : "UTC";

/* ==================================================
   HELPERS
================================================== */

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getTodayDate(): string {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFrequencyLabel(
  frequency: TaskScheduleFrequency
): string {
  const option =
    FREQUENCY_OPTIONS.find(
      (
        item: {
          value: TaskScheduleFrequency;
          label: string;
          description: string;
        }
      ): boolean =>
        item.value === frequency
    );

  return option?.label ?? "Once";
}

function getReminderLabel(
  minutes: number
): string {
  const option =
    REMINDER_OPTIONS.find(
      (
        item: {
          value: number;
          label: string;
        }
      ): boolean =>
        item.value === minutes
    );

  if (option) {
    return option.label;
  }

  if (minutes < 60) {
    return `${minutes} minutes before`;
  }

  if (minutes === 60) {
    return "1 hour before";
  }

  if (minutes < 1440) {
    return `${Math.floor(
      minutes / 60
    )} hours before`;
  }

  return `${Math.floor(
    minutes / 1440
  )} days before`;
}

function getNextRunText(
  value: TaskScheduleValue
): string {
  if (!value.enabled) {
    return "Schedule disabled";
  }

  if (
    value.status === "paused"
  ) {
    return "Schedule paused";
  }

  if (!value.startDate) {
    return "Start date not set";
  }

  switch (
    value.frequency
  ) {
    case "once":
      return `Once on ${value.startDate} at ${value.time}`;

    case "daily":
      return `Every day at ${value.time}`;

    case "weekly": {
      const selectedDays =
        value.daysOfWeek
          .map(
            (
              day: TaskScheduleDay
            ): string => {
              const item =
                WEEK_DAYS.find(
                  (
                    current
                  ) =>
                    current.value ===
                    day
                );

              return (
                item?.shortLabel ??
                day
              );
            }
          )
          .join(", ");

      return selectedDays
        ? `Every ${selectedDays} at ${value.time}`
        : `Weekly at ${value.time}`;
    }

    case "monthly":
      return `Monthly on day ${
        value.dayOfMonth ?? 1
      } at ${value.time}`;

    case "custom":
      return `Every ${
        value.interval ?? 1
      } day(s) at ${value.time}`;

    default:
      return "Schedule configured";
  }
}

/* ==================================================
   COMPONENT
================================================== */

export default function TaskSchedule({
  initialValue,
  onSave,
  onCancel,
  onDelete,
  className = "",
  compact = false,
}: TaskScheduleProps): ReactNode {
  const [enabled, setEnabled] =
    useState<boolean>(
      initialValue?.enabled ?? true
    );

  const [status, setStatus] =
    useState<TaskScheduleStatus>(
      initialValue?.status ??
        "active"
    );

  const [
    frequency,
    setFrequency,
  ] =
    useState<TaskScheduleFrequency>(
      initialValue?.frequency ??
        "once"
    );

  const [
    startDate,
    setStartDate,
  ] = useState<string>(
    initialValue?.startDate ??
      getTodayDate()
  );

  const [time, setTime] =
    useState<string>(
      initialValue?.time ??
        "09:00"
    );

  const [
    timezone,
    setTimezone,
  ] = useState<string>(
    initialValue?.timezone ??
      DEFAULT_TIMEZONE
  );

  const [
    daysOfWeek,
    setDaysOfWeek,
  ] = useState<TaskScheduleDay[]>(
    initialValue?.daysOfWeek ?? []
  );

  const [
    dayOfMonth,
    setDayOfMonth,
  ] = useState<number>(
    initialValue?.dayOfMonth ??
      1
  );

  const [
    interval,
    setIntervalValue,
  ] = useState<number>(
    initialValue?.interval ??
      1
  );

  const [
    reminders,
    setReminders,
  ] = useState<TaskScheduleReminder[]>(
    initialValue?.reminders ?? []
  );

  const [
    reminderValue,
    setReminderValue,
  ] = useState<number>(15);

  const [
    isSaving,
    setIsSaving,
  ] = useState<boolean>(false);

  /* ================================================
     NORMALIZE STATUS
  ================================================= */

  useEffect((): void => {
    if (!enabled) {
      setStatus("paused");
      return;
    }

    if (status === "paused") {
      setStatus("active");
    }
  }, [
    enabled,
    status,
  ]);

  /* ================================================
     DERIVED VALUE
  ================================================= */

  const scheduleValue =
    useMemo(
      (): TaskScheduleValue => ({
        id: initialValue?.id,

        enabled,

        status,

        frequency,

        startDate,

        time,

        timezone,

        daysOfWeek,

        dayOfMonth:
          frequency === "monthly"
            ? dayOfMonth
            : undefined,

        interval:
          frequency === "custom"
            ? interval
            : undefined,

        reminders,
      }),
      [
        initialValue?.id,
        enabled,
        status,
        frequency,
        startDate,
        time,
        timezone,
        daysOfWeek,
        dayOfMonth,
        interval,
        reminders,
      ]
    );

  const scheduleSummary =
    useMemo(
      (): string =>
        getNextRunText(
          scheduleValue
        ),
      [scheduleValue]
    );

  /* ================================================
     WEEK DAYS
  ================================================= */

  const toggleDay = (
    day: TaskScheduleDay
  ): void => {
    setDaysOfWeek(
      (
        current: TaskScheduleDay[]
      ): TaskScheduleDay[] => {
        const exists =
          current.includes(day);

        if (exists) {
          return current.filter(
            (
              currentDay: TaskScheduleDay
            ): boolean =>
              currentDay !== day
          );
        }

        return [
          ...current,
          day,
        ];
      }
    );
  };

  /* ================================================
     REMINDERS
  ================================================= */

  const addReminder =
    (): void => {
      const exists =
        reminders.some(
          (
            reminder: TaskScheduleReminder
          ): boolean =>
            reminder.minutesBefore ===
            reminderValue
        );

      if (exists) {
        return;
      }

      setReminders(
        (
          current: TaskScheduleReminder[]
        ): TaskScheduleReminder[] => [
          ...current,
          {
            id: createId(),
            minutesBefore:
              reminderValue,
          },
        ].sort(
          (
            first,
            second
          ): number =>
            second.minutesBefore -
            first.minutesBefore
        )
      );
    };

  const removeReminder = (
    id: string
  ): void => {
    setReminders(
      (
        current: TaskScheduleReminder[]
      ): TaskScheduleReminder[] =>
        current.filter(
          (
            reminder: TaskScheduleReminder
          ): boolean =>
            reminder.id !== id
        )
    );
  };

  /* ================================================
     SAVE
  ================================================= */

  const handleSave =
    async (): Promise<void> => {
      try {
        setIsSaving(true);

        await onSave?.(
          scheduleValue
        );
      } finally {
        setIsSaving(false);
      }
    };

  const handleDelete =
    async (): Promise<void> => {
      await onDelete?.(
        scheduleValue
      );
    };

  /* ================================================
     RENDER
  ================================================= */

  return (
    <section
      className={[
        "mx-auto w-full",
        compact
          ? "max-w-2xl"
          : "max-w-4xl",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* =========================================
          HEADER
      ========================================== */}

      {!compact ? (
        <div className="mb-6 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarClock className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold">
                Task schedule
              </h2>

              <p className="text-sm text-muted-foreground">
                Control when this task should
                run and when reminders are sent.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
            ) : null}

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isSaving ? (
                <Clock3 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              {isSaving
                ? "Saving..."
                : "Save schedule"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        {/* =======================================
            ENABLE / STATUS
        ======================================== */}

        <section className="rounded-2xl border border-border/60 bg-background p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold">
                Schedule status
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Enable or pause automatic task
                scheduling.
              </p>
            </div>

            <button
              type="button"
              onClick={(): void => {
                setEnabled(
                  (
                    current: boolean
                  ): boolean =>
                    !current
                );
              }}
              className={[
                "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors",
                enabled
                  ? "bg-primary"
                  : "bg-muted",
              ].join(" ")}
              aria-label={
                enabled
                  ? "Disable schedule"
                  : "Enable schedule"
              }
              aria-pressed={enabled}
            >
              <span
                className={[
                  "inline-flex h-6 w-6 items-center justify-center rounded-full bg-background shadow-sm transition-transform",
                  enabled
                    ? "translate-x-7"
                    : "translate-x-1",
                ].join(" ")}
              >
                {enabled ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </span>
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
                enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {enabled ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}

              {enabled
                ? "Active"
                : "Paused"}
            </span>

            <span className="text-xs text-muted-foreground">
              {status === "active"
                ? "Automation is ready to run."
                : "Automation will not run until enabled."}
            </span>
          </div>
        </section>

        {/* =======================================
            FREQUENCY
        ======================================== */}

        <section className="rounded-2xl border border-border/60 bg-background p-5">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <Repeat2 className="h-5 w-5 text-primary" />

              <h3 className="font-semibold">
                Schedule frequency
              </h3>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Choose how often the task should
              run.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FREQUENCY_OPTIONS.map(
              (
                option: {
                  value: TaskScheduleFrequency;
                  label: string;
                  description: string;
                }
              ) => {
                const selected =
                  frequency ===
                  option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(): void => {
                      setFrequency(
                        option.value
                      );
                    }}
                    className={[
                      "rounded-xl border p-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:bg-muted/50",
                    ].join(" ")}
                  >
                    <div className="text-sm font-medium">
                      {option.label}
                    </div>

                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      {
                        option.description
                      }
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </section>

        {/* =======================================
            DATE / TIME
        ======================================== */}

        <section className="rounded-2xl border border-border/60 bg-background p-5">
          <div className="mb-5">
            <h3 className="font-semibold">
              Date and time
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Set when the schedule begins.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground" />

                Start date
              </span>

              <input
                type="date"
                value={startDate}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ): void => {
                  setStartDate(
                    event.target.value
                  );
                }}
                className="h-11 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
            </label>

            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Clock3 className="h-4 w-4 text-muted-foreground" />

                Time
              </span>

              <input
                type="time"
                value={time}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ): void => {
                  setTime(
                    event.target.value
                  );
                }}
                className="h-11 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
            </label>

            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Globe2 className="h-4 w-4 text-muted-foreground" />

                Timezone
              </span>

              <input
                value={timezone}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ): void => {
                  setTimezone(
                    event.target.value
                  );
                }}
                placeholder="Europe/Istanbul"
                className="h-11 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
            </label>
          </div>
        </section>

        {/* =======================================
            WEEKLY
        ======================================== */}

        {frequency === "weekly" ? (
          <section className="rounded-2xl border border-border/60 bg-background p-5">
            <div className="mb-5">
              <h3 className="font-semibold">
                Days of the week
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Select the days when this task
                should run.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map(
                (
                  day: {
                    value: TaskScheduleDay;
                    label: string;
                    shortLabel: string;
                  }
                ) => {
                  const selected =
                    daysOfWeek.includes(
                      day.value
                    );

                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={(): void => {
                        toggleDay(
                          day.value
                        );
                      }}
                      className={[
                        "inline-flex h-10 min-w-[58px] items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 hover:bg-muted",
                      ].join(" ")}
                    >
                      {
                        day.shortLabel
                      }
                    </button>
                  );
                }
              )}
            </div>
          </section>
        ) : null}

        {/* =======================================
            MONTHLY
        ======================================== */}

        {frequency === "monthly" ? (
          <section className="rounded-2xl border border-border/60 bg-background p-5">
            <div className="mb-5">
              <h3 className="font-semibold">
                Day of month
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Select the day when the task
                should run each month.
              </p>
            </div>

            <label className="grid max-w-xs gap-2">
              <span className="text-sm font-medium">
                Day
              </span>

              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ): void => {
                  const value =
                    Number(
                      event.target.value
                    );

                  setDayOfMonth(
                    Math.min(
                      31,
                      Math.max(
                        1,
                        Number.isNaN(
                          value
                        )
                          ? 1
                          : value
                      )
                    )
                  );
                }}
                className="h-11 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
            </label>
          </section>
        ) : null}

        {/* =======================================
            CUSTOM
        ======================================== */}

        {frequency === "custom" ? (
          <section className="rounded-2xl border border-border/60 bg-background p-5">
            <div className="mb-5">
              <h3 className="font-semibold">
                Custom interval
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Define the interval in days.
              </p>
            </div>

            <div className="flex max-w-sm items-center gap-3">
              <input
                type="number"
                min={1}
                value={interval}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>
                ): void => {
                  const value =
                    Number(
                      event.target.value
                    );

                  setIntervalValue(
                    Math.max(
                      1,
                      Number.isNaN(
                        value
                      )
                        ? 1
                        : value
                    )
                  );
                }}
                className="h-11 w-24 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />

              <span className="text-sm text-muted-foreground">
                day(s)
              </span>
            </div>
          </section>
        ) : null}

        {/* =======================================
            REMINDERS
        ======================================== */}

        <section className="rounded-2xl border border-border/60 bg-background p-5">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />

              <h3 className="font-semibold">
                Reminders
              </h3>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Send notifications before the task
              is scheduled to run.
            </p>
          </div>

          {reminders.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {reminders.map(
                (
                  reminder: TaskScheduleReminder
                ) => (
                  <button
                    key={reminder.id}
                    type="button"
                    onClick={(): void => {
                      removeReminder(
                        reminder.id
                      );
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary/10 px-3 text-xs font-medium text-primary transition-opacity hover:opacity-75"
                  >
                    <Bell className="h-3.5 w-3.5" />

                    {getReminderLabel(
                      reminder.minutesBefore
                    )}

                    <X className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
              No reminders configured.
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <select
                value={reminderValue}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>
                ): void => {
                  setReminderValue(
                    Number(
                      event.target.value
                    )
                  );
                }}
                className="h-10 w-full appearance-none rounded-xl border border-border/60 bg-background px-3 pr-10 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              >
                {REMINDER_OPTIONS.map(
                  (
                    option: {
                      value: number;
                      label: string;
                    }
                  ) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>

            <button
              type="button"
              onClick={addReminder}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/60 px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" />

              Add reminder
            </button>
          </div>
        </section>

        {/* =======================================
            SUMMARY
        ======================================== */}

        <section className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

            <div className="min-w-0">
              <h3 className="font-medium">
                Schedule summary
              </h3>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {scheduleSummary}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg bg-background px-2.5 py-1 text-xs text-muted-foreground">
                  {getFrequencyLabel(
                    frequency
                  )}
                </span>

                <span className="rounded-lg bg-background px-2.5 py-1 text-xs text-muted-foreground">
                  {timezone}
                </span>

                {reminders.length > 0 ? (
                  <span className="rounded-lg bg-background px-2.5 py-1 text-xs text-muted-foreground">
                    {
                      reminders.length
                    }{" "}
                    reminder
                    {reminders.length !==
                    1
                      ? "s"
                      : ""}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* =======================================
            ACTIONS
        ======================================== */}

        {!compact ? (
          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {onDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />

                  Delete schedule
                </button>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2">
              {onCancel ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
              ) : null}

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
              >
                {isSaving ? (
                  <Clock3 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {isSaving
                  ? "Saving..."
                  : "Save schedule"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ==================================================
   EXPORTS
================================================== */

export {
  WEEK_DAYS,
  FREQUENCY_OPTIONS,
  REMINDER_OPTIONS,
  DEFAULT_TIMEZONE,
  createId,
  getTodayDate,
  getFrequencyLabel,
  getReminderLabel,
  getNextRunText,
};