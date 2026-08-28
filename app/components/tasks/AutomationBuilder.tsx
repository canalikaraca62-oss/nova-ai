"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";

import {
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  GitBranch,
  Globe,
  Mail,
  Plus,
  Save,
  Settings2,
  Trash2,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type AutomationTriggerType =
  | "manual"
  | "schedule"
  | "event"
  | "webhook";

export type AutomationActionType =
  | "notification"
  | "email"
  | "webhook"
  | "task"
  | "custom";

export type AutomationCondition = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

export type AutomationAction = {
  id: string;
  type: AutomationActionType;
  label: string;
  description?: string;
  enabled: boolean;
};

export type AutomationBuilderValue = {
  name: string;
  description: string;
  enabled: boolean;

  trigger: AutomationTriggerType;

  schedule?: string;

  event?: string;

  webhookUrl?: string;

  conditions: AutomationCondition[];

  actions: AutomationAction[];
};

export type AutomationBuilderProps = {
  initialValue?: Partial<AutomationBuilderValue>;

  onSave?: (
    value: AutomationBuilderValue
  ) => void | Promise<void>;

  onCancel?: () => void;

  className?: string;
};

/* ==================================================
   CONSTANTS
================================================== */

const TRIGGER_OPTIONS: {
  type: AutomationTriggerType;
  label: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    type: "manual",
    label: "Manual",
    description: "Run this automation manually.",
    icon: <Zap className="h-5 w-5" />,
  },
  {
    type: "schedule",
    label: "Schedule",
    description: "Run automatically on a schedule.",
    icon: (
      <CalendarClock className="h-5 w-5" />
    ),
  },
  {
    type: "event",
    label: "Event",
    description: "Run when a workspace event occurs.",
    icon: (
      <GitBranch className="h-5 w-5" />
    ),
  },
  {
    type: "webhook",
    label: "Webhook",
    description: "Run when an external webhook is received.",
    icon: <Webhook className="h-5 w-5" />,
  },
];

const ACTION_OPTIONS: {
  type: AutomationActionType;
  label: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    type: "notification",
    label: "Send notification",
    description:
      "Send an in-app notification.",
    icon: <Bell className="h-4 w-4" />,
  },
  {
    type: "email",
    label: "Send email",
    description:
      "Send an email notification.",
    icon: <Mail className="h-4 w-4" />,
  },
  {
    type: "webhook",
    label: "Call webhook",
    description:
      "Send data to an external endpoint.",
    icon: <Webhook className="h-4 w-4" />,
  },
  {
    type: "task",
    label: "Create task",
    description:
      "Create a new workspace task.",
    icon: <Workflow className="h-4 w-4" />,
  },
  {
    type: "custom",
    label: "Custom action",
    description:
      "Run a custom automation action.",
    icon: <Settings2 className="h-4 w-4" />,
  },
];

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

function getActionOption(
  type: AutomationActionType
): {
  type: AutomationActionType;
  label: string;
  description: string;
  icon: ReactNode;
} {
  const option =
    ACTION_OPTIONS.find(
      (
        current
      ) =>
        current.type === type
    );

  return (
    option ?? {
      type: "custom",
      label: "Custom action",
      description:
        "Run a custom automation action.",
      icon: (
        <Settings2 className="h-4 w-4" />
      ),
    }
  );
}

/* ==================================================
   COMPONENT
================================================== */

export default function AutomationBuilder({
  initialValue,
  onSave,
  onCancel,
  className = "",
}: AutomationBuilderProps): ReactNode {
  const [name, setName] =
    useState<string>(
      initialValue?.name ?? ""
    );

  const [
    description,
    setDescription,
  ] = useState<string>(
    initialValue?.description ?? ""
  );

  const [enabled, setEnabled] =
    useState<boolean>(
      initialValue?.enabled ?? true
    );

  const [trigger, setTrigger] =
    useState<AutomationTriggerType>(
      initialValue?.trigger ??
        "manual"
    );

  const [schedule, setSchedule] =
    useState<string>(
      initialValue?.schedule ??
        "0 9 * * 1-5"
    );

  const [event, setEvent] =
    useState<string>(
      initialValue?.event ??
        "task.completed"
    );

  const [
    webhookUrl,
    setWebhookUrl,
  ] = useState<string>(
    initialValue?.webhookUrl ??
      ""
  );

  const [
    conditions,
    setConditions,
  ] = useState<
    AutomationCondition[]
  >(
    initialValue?.conditions ?? []
  );

  const [actions, setActions] =
    useState<AutomationAction[]>(
      initialValue?.actions ?? []
    );

  const [
    isSaving,
    setIsSaving,
  ] = useState<boolean>(
    false
  );

  const canSave: boolean =
    useMemo((): boolean => {
      return (
        name.trim().length > 0 &&
        actions.length > 0 &&
        !isSaving
      );
    }, [
      actions.length,
      isSaving,
      name,
    ]);

  /* ================================================
     CONDITIONS
  ================================================= */

  const addCondition = (): void => {
    setConditions(
      (
        current: AutomationCondition[]
      ): AutomationCondition[] => [
        ...current,
        {
          id: createId(),
          field: "",
          operator: "equals",
          value: "",
        },
      ]
    );
  };

  const updateCondition = (
    id: string,
    updates: Partial<AutomationCondition>
  ): void => {
    setConditions(
      (
        current: AutomationCondition[]
      ): AutomationCondition[] =>
        current.map(
          (
            condition: AutomationCondition
          ): AutomationCondition =>
            condition.id === id
              ? {
                  ...condition,
                  ...updates,
                }
              : condition
        )
    );
  };

  const removeCondition = (
    id: string
  ): void => {
    setConditions(
      (
        current: AutomationCondition[]
      ): AutomationCondition[] =>
        current.filter(
          (
            condition: AutomationCondition
          ): boolean =>
            condition.id !== id
        )
    );
  };

  /* ================================================
     ACTIONS
  ================================================= */

  const addAction = (
    type: AutomationActionType
  ): void => {
    const option =
      getActionOption(type);

    setActions(
      (
        current: AutomationAction[]
      ): AutomationAction[] => [
        ...current,
        {
          id: createId(),
          type,
          label: option.label,
          description:
            option.description,
          enabled: true,
        },
      ]
    );
  };

  const toggleAction = (
    id: string
  ): void => {
    setActions(
      (
        current: AutomationAction[]
      ): AutomationAction[] =>
        current.map(
          (
            action: AutomationAction
          ): AutomationAction =>
            action.id === id
              ? {
                  ...action,
                  enabled:
                    !action.enabled,
                }
              : action
        )
    );
  };

  const removeAction = (
    id: string
  ): void => {
    setActions(
      (
        current: AutomationAction[]
      ): AutomationAction[] =>
        current.filter(
          (
            action: AutomationAction
          ): boolean =>
            action.id !== id
        )
    );
  };

  const duplicateAction = (
    action: AutomationAction
  ): void => {
    setActions(
      (
        current: AutomationAction[]
      ): AutomationAction[] => [
        ...current,
        {
          ...action,
          id: createId(),
          label: `${action.label} copy`,
        },
      ]
    );
  };

  /* ================================================
     SAVE
  ================================================= */

  const handleSave = async (): Promise<void> => {
    if (!canSave) {
      return;
    }

    const value: AutomationBuilderValue = {
      name: name.trim(),
      description: description.trim(),
      enabled,
      trigger,
      schedule:
        trigger === "schedule"
          ? schedule
          : undefined,
      event:
        trigger === "event"
          ? event
          : undefined,
      webhookUrl:
        trigger === "webhook"
          ? webhookUrl.trim()
          : undefined,
      conditions,
      actions,
    };

    try {
      setIsSaving(true);

      await onSave?.(value);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={[
        "mx-auto w-full max-w-5xl space-y-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Workflow className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold">
                Automation builder
              </h2>

              <p className="text-sm text-muted-foreground">
                Configure triggers, conditions
                and actions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canSave}
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
              : "Save automation"}
          </button>
        </div>
      </div>

      {/* =========================================
          BASIC DETAILS
      ========================================== */}

      <section className="rounded-2xl border border-border/60 bg-background p-5">
        <div className="mb-5">
          <h3 className="font-semibold">
            Automation details
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Give this automation a clear
            name and description.
          </p>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium">
              Name
            </span>

            <input
              value={name}
              onChange={(
                inputEvent: ChangeEvent<HTMLInputElement>
              ): void => {
                setName(
                  inputEvent.target.value
                );
              }}
              placeholder="e.g. Daily project report"
              className="h-11 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">
              Description
            </span>

            <textarea
              value={description}
              onChange={(
                inputEvent: ChangeEvent<HTMLTextAreaElement>
              ): void => {
                setDescription(
                  inputEvent.target.value
                );
              }}
              rows={3}
              placeholder="What should this automation do?"
              className="resize-none rounded-xl border border-border/60 bg-background px-3 py-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </label>

          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                Automation status
              </p>

              <p className="text-xs text-muted-foreground">
                Enable or pause this automation.
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
              aria-pressed={enabled}
              className={[
                "relative h-6 w-11 rounded-full transition-colors",
                enabled
                  ? "bg-primary"
                  : "bg-muted-foreground/30",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
                  enabled
                    ? "translate-x-6"
                    : "translate-x-1",
                ].join(" ")}
              />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================
          TRIGGER
      ========================================== */}

      <section className="rounded-2xl border border-border/60 bg-background p-5">
        <div className="mb-5">
          <h3 className="font-semibold">
            Trigger
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Choose when the automation should run.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TRIGGER_OPTIONS.map(
            (
              option: {
                type: AutomationTriggerType;
                label: string;
                description: string;
                icon: ReactNode;
              }
            ) => (
              <button
                key={option.type}
                type="button"
                onClick={(): void => {
                  setTrigger(
                    option.type
                  );
                }}
                className={[
                  "flex min-h-32 flex-col items-start rounded-xl border p-4 text-left transition-colors",
                  trigger ===
                  option.type
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:bg-muted/50",
                ].join(" ")}
              >
                <span
                  className={[
                    "mb-3 flex h-9 w-9 items-center justify-center rounded-lg",
                    trigger ===
                    option.type
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {option.icon}
                </span>

                <span className="text-sm font-medium">
                  {option.label}
                </span>

                <span className="mt-1 text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </button>
            )
          )}
        </div>

        {trigger === "schedule" ? (
          <div className="mt-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium">
                Schedule
              </span>

              <input
                value={schedule}
                onChange={(
                  inputEvent: ChangeEvent<HTMLInputElement>
                ): void => {
                  setSchedule(
                    inputEvent.target.value
                  );
                }}
                placeholder="0 9 * * 1-5"
                className="h-11 rounded-xl border border-border/60 bg-background px-3 font-mono text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />

              <span className="text-xs text-muted-foreground">
                Cron format. Example: 0 9 * * 1-5
              </span>
            </label>
          </div>
        ) : null}

        {trigger === "event" ? (
          <div className="mt-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium">
                Workspace event
              </span>

              <div className="relative">
                <select
                  value={event}
                  onChange={(
                    inputEvent: ChangeEvent<HTMLSelectElement>
                  ): void => {
                    setEvent(
                      inputEvent.target.value
                    );
                  }}
                  className="h-11 w-full appearance-none rounded-xl border border-border/60 bg-background px-3 pr-10 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="task.created">
                    Task created
                  </option>

                  <option value="task.completed">
                    Task completed
                  </option>

                  <option value="project.updated">
                    Project updated
                  </option>

                  <option value="agent.completed">
                    Agent completed
                  </option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </label>
          </div>
        ) : null}

        {trigger === "webhook" ? (
          <div className="mt-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium">
                Webhook endpoint
              </span>

              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />

                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(
                    inputEvent: ChangeEvent<HTMLInputElement>
                  ): void => {
                    setWebhookUrl(
                      inputEvent.target.value
                    );
                  }}
                  placeholder="https://example.com/webhook"
                  className="h-11 flex-1 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </label>
          </div>
        ) : null}
      </section>

      {/* =========================================
          CONDITIONS
      ========================================== */}

      <section className="rounded-2xl border border-border/60 bg-background p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">
              Conditions
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Run only when these conditions are met.
            </p>
          </div>

          <button
            type="button"
            onClick={addCondition}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border/60 px-3 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" />

            Add condition
          </button>
        </div>

        {conditions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No conditions configured.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conditions.map(
              (
                condition: AutomationCondition
              ) => (
                <div
                  key={condition.id}
                  className="grid gap-2 rounded-xl bg-muted/30 p-3 sm:grid-cols-[1fr_140px_1fr_auto]"
                >
                  <input
                    value={
                      condition.field
                    }
                    onChange={(
                      inputEvent: ChangeEvent<HTMLInputElement>
                    ): void => {
                      updateCondition(
                        condition.id,
                        {
                          field:
                            inputEvent
                              .target
                              .value,
                        }
                      );
                    }}
                    placeholder="Field"
                    className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/50"
                  />

                  <select
                    value={
                      condition.operator
                    }
                    onChange={(
                      inputEvent: ChangeEvent<HTMLSelectElement>
                    ): void => {
                      updateCondition(
                        condition.id,
                        {
                          operator:
                            inputEvent
                              .target
                              .value,
                        }
                      );
                    }}
                    className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="equals">
                      Equals
                    </option>

                    <option value="not_equals">
                      Does not equal
                    </option>

                    <option value="contains">
                      Contains
                    </option>

                    <option value="greater_than">
                      Greater than
                    </option>
                  </select>

                  <input
                    value={
                      condition.value
                    }
                    onChange={(
                      inputEvent: ChangeEvent<HTMLInputElement>
                    ): void => {
                      updateCondition(
                        condition.id,
                        {
                          value:
                            inputEvent
                              .target
                              .value,
                        }
                      );
                    }}
                    placeholder="Value"
                    className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/50"
                  />

                  <button
                    type="button"
                    onClick={(): void => {
                      removeCondition(
                        condition.id
                      );
                    }}
                    aria-label="Remove condition"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* =========================================
          ACTIONS
      ========================================== */}

      <section className="rounded-2xl border border-border/60 bg-background p-5">
        <div className="mb-5">
          <h3 className="font-semibold">
            Actions
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Choose what happens after the trigger.
          </p>
        </div>

        <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ACTION_OPTIONS.map(
            (
              option: {
                type: AutomationActionType;
                label: string;
                description: string;
                icon: ReactNode;
              }
            ) => (
              <button
                key={option.type}
                type="button"
                onClick={(): void => {
                  addAction(
                    option.type
                  );
                }}
                className="flex items-start gap-3 rounded-xl border border-border/60 p-3 text-left transition-colors hover:bg-muted/50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {option.icon}
                </span>

                <span>
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            )
          )}
        </div>

        {actions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center">
            <Workflow className="mx-auto h-5 w-5 text-muted-foreground" />

            <p className="mt-3 text-sm font-medium">
              No actions yet
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Choose an action above to build your workflow.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map(
              (
                action: AutomationAction,
                index: number
              ) => {
                const option =
                  getActionOption(
                    action.type
                  );

                return (
                  <div
                    key={action.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {option.icon}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {action.label}
                      </span>

                      {action.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {action.description}
                        </span>
                      ) : null}
                    </span>

                    <button
                      type="button"
                      onClick={(): void => {
                        toggleAction(
                          action.id
                        );
                      }}
                      className={[
                        "hidden h-8 items-center gap-1 rounded-lg px-2 text-xs sm:inline-flex",
                        action.enabled
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {action.enabled ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : null}

                      {action.enabled
                        ? "Enabled"
                        : "Disabled"}
                    </button>

                    <button
                      type="button"
                      onClick={(): void => {
                        duplicateAction(
                          action
                        );
                      }}
                      aria-label="Duplicate action"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Copy className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(): void => {
                        removeAction(
                          action.id
                        );
                      }}
                      aria-label="Remove action"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* ==================================================
   EXPORTS
================================================== */

export {
  ACTION_OPTIONS,
  TRIGGER_OPTIONS,
  createId,
  getActionOption,
};