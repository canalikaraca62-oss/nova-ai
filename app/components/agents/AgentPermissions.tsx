"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Network,
  RotateCcw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

export type PermissionRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type PermissionValue =
  | "allow"
  | "ask"
  | "deny";

export interface AgentPermission {
  id: string;
  name: string;
  description?: string;
  category:
    | "tools"
    | "data"
    | "execution"
    | "network"
    | "security"
    | string;

  value: PermissionValue;
  risk?: PermissionRisk;

  enabled?: boolean;
  locked?: boolean;
  required?: boolean;
}

export interface AgentPermissionPreset {
  id: string;
  name: string;
  description: string;
  permissions: Record<
    string,
    PermissionValue
  >;
}

interface AgentPermissionsProps {
  agentId?: string;

  permissions?: AgentPermission[];

  isLoading?: boolean;
  isSaving?: boolean;
  disabled?: boolean;

  showPresets?: boolean;
  showSaveButton?: boolean;

  onChange?: (
    permissions: AgentPermission[],
  ) => void;

  onSave?: (
    permissions: AgentPermission[],
  ) => void | Promise<void>;

  onReset?: (
    permissions: AgentPermission[],
  ) => void;

  className?: string;
}

const DEFAULT_PERMISSIONS: AgentPermission[] = [
  {
    id: "tool_execution",
    name: "Tool execution",
    description:
      "Allow the agent to execute approved tools and integrations.",
    category: "tools",
    value: "ask",
    risk: "medium",
  },
  {
    id: "code_execution",
    name: "Code execution",
    description:
      "Allow sandboxed code execution during agent runs.",
    category: "execution",
    value: "ask",
    risk: "high",
  },
  {
    id: "file_read",
    name: "Read files",
    description:
      "Allow access to files explicitly available to this agent.",
    category: "data",
    value: "allow",
    risk: "low",
  },
  {
    id: "file_write",
    name: "Modify files",
    description:
      "Allow the agent to create, update, or remove approved files.",
    category: "data",
    value: "ask",
    risk: "high",
  },
  {
    id: "external_requests",
    name: "External requests",
    description:
      "Allow outbound requests to approved external services.",
    category: "network",
    value: "ask",
    risk: "high",
  },
  {
    id: "credential_access",
    name: "Credential access",
    description:
      "Allow use of secrets and credentials explicitly assigned to the agent.",
    category: "security",
    value: "deny",
    risk: "critical",
  },
];

const DEFAULT_PRESETS: AgentPermissionPreset[] = [
  {
    id: "restricted",
    name: "Restricted",
    description:
      "Minimal access. The agent can only read approved data.",
    permissions: {
      tool_execution: "deny",
      code_execution: "deny",
      file_read: "allow",
      file_write: "deny",
      external_requests: "deny",
      credential_access: "deny",
    },
  },
  {
    id: "standard",
    name: "Standard",
    description:
      "Balanced permissions with approval for sensitive actions.",
    permissions: {
      tool_execution: "ask",
      code_execution: "ask",
      file_read: "allow",
      file_write: "ask",
      external_requests: "ask",
      credential_access: "deny",
    },
  },
  {
    id: "autonomous",
    name: "Autonomous",
    description:
      "Broader access for trusted production agents.",
    permissions: {
      tool_execution: "allow",
      code_execution: "ask",
      file_read: "allow",
      file_write: "ask",
      external_requests: "ask",
      credential_access: "ask",
    },
  },
];

const CATEGORY_CONFIG = {
  tools: {
    label: "Tools",
    icon: Wrench,
  },
  data: {
    label: "Data",
    icon: Database,
  },
  execution: {
    label: "Execution",
    icon: Terminal,
  },
  network: {
    label: "Network",
    icon: Network,
  },
  security: {
    label: "Security",
    icon: KeyRound,
  },
};

function getCategoryConfig(
  category: string,
) {
  return (
    CATEGORY_CONFIG[
      category as keyof typeof CATEGORY_CONFIG
    ] ?? {
      label:
        category.charAt(0).toUpperCase() +
        category.slice(1),
      icon: Shield,
    }
  );
}

function getRiskClasses(
  risk?: PermissionRisk,
) {
  switch (risk) {
    case "critical":
      return {
        badge:
          "border-red-500/25 bg-red-500/10 text-red-300",
        dot: "bg-red-400",
      };

    case "high":
      return {
        badge:
          "border-orange-500/25 bg-orange-500/10 text-orange-300",
        dot: "bg-orange-400",
      };

    case "medium":
      return {
        badge:
          "border-amber-500/25 bg-amber-500/10 text-amber-300",
        dot: "bg-amber-400",
      };

    case "low":
    default:
      return {
        badge:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
        dot: "bg-emerald-400",
      };
  }
}

function getPermissionConfig(
  value: PermissionValue,
) {
  switch (value) {
    case "allow":
      return {
        label: "Allow",
        icon: ShieldCheck,
        className:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      };

    case "ask":
      return {
        label: "Ask",
        icon: ShieldAlert,
        className:
          "border-amber-500/25 bg-amber-500/10 text-amber-300",
      };

    case "deny":
    default:
      return {
        label: "Deny",
        icon: Lock,
        className:
          "border-zinc-500/25 bg-zinc-500/10 text-zinc-400",
      };
  }
}

export default function AgentPermissions({
  agentId,
  permissions = DEFAULT_PERMISSIONS,

  isLoading = false,
  isSaving = false,
  disabled = false,

  showPresets = true,
  showSaveButton = true,

  onChange,
  onSave,
  onReset,

  className = "",
}: AgentPermissionsProps) {
  const [currentPermissions, setCurrentPermissions] =
    useState<AgentPermission[]>(permissions);

  const [originalPermissions, setOriginalPermissions] =
    useState<AgentPermission[]>(permissions);

  const [expandedCategories, setExpandedCategories] =
    useState<Record<string, boolean>>({
      tools: true,
      data: true,
      execution: true,
      network: true,
      security: true,
    });

  const [showPresetsPanel, setShowPresetsPanel] =
    useState(false);

  useEffect(() => {
    setCurrentPermissions(permissions);
    setOriginalPermissions(permissions);
  }, [permissions]);

  const groupedPermissions = useMemo(() => {
    return currentPermissions.reduce<
      Record<string, AgentPermission[]>
    >((groups, permission) => {
      const category =
        permission.category || "other";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(permission);

      return groups;
    }, {});
  }, [currentPermissions]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(currentPermissions) !==
      JSON.stringify(originalPermissions);
  }, [
    currentPermissions,
    originalPermissions,
  ]);

  const permissionStats = useMemo(() => {
    return currentPermissions.reduce(
      (stats, permission) => {
        stats[permission.value] += 1;

        return stats;
      },
      {
        allow: 0,
        ask: 0,
        deny: 0,
      },
    );
  }, [currentPermissions]);

  const updatePermission = (
    id: string,
    value: PermissionValue,
  ) => {
    if (disabled || isSaving) {
      return;
    }

    const nextPermissions =
      currentPermissions.map((permission) => {
        if (permission.id !== id) {
          return permission;
        }

        if (
          permission.locked ||
          permission.required
        ) {
          return permission;
        }

        return {
          ...permission,
          value,
        };
      });

    setCurrentPermissions(nextPermissions);
    onChange?.(nextPermissions);
  };

  const applyPreset = (
    preset: AgentPermissionPreset,
  ) => {
    if (disabled || isSaving) {
      return;
    }

    const nextPermissions =
      currentPermissions.map((permission) => {
        if (
          permission.locked ||
          permission.required
        ) {
          return permission;
        }

        const presetValue =
          preset.permissions[permission.id];

        if (!presetValue) {
          return permission;
        }

        return {
          ...permission,
          value: presetValue,
        };
      });

    setCurrentPermissions(nextPermissions);
    onChange?.(nextPermissions);
    setShowPresetsPanel(false);
  };

  const handleReset = () => {
    if (disabled || isSaving) {
      return;
    }

    setCurrentPermissions(originalPermissions);
    onChange?.(originalPermissions);
    onReset?.(originalPermissions);
  };

  const handleSave = async () => {
    if (
      disabled ||
      isSaving ||
      !onSave
    ) {
      return;
    }

    await onSave(currentPermissions);
    setOriginalPermissions(currentPermissions);
  };

  const toggleCategory = (
    category: string,
  ) => {
    setExpandedCategories((current) => ({
      ...current,
      [category]: !current[category],
    }));
  };

  return (
    <section
      className={[
        "w-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-950/70 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="border-b border-white/[0.06] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
                  <Shield className="h-5 w-5 text-violet-300" />
                </div>

                <div>
                  <h2 className="text-base font-semibold text-white">
                    Agent permissions
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Control what this agent can
                    access and which actions require
                    approval.
                  </p>
                </div>
              </div>

              {agentId ? (
                <p className="mt-4 font-mono text-[11px] text-zinc-600">
                  Agent ID: {agentId}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-xl border border-white/[0.07] bg-black/20">
                <div className="border-r border-white/[0.06] px-3 py-2 text-center">
                  <div className="text-sm font-semibold text-emerald-300">
                    {permissionStats.allow}
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Allow
                  </div>
                </div>

                <div className="border-r border-white/[0.06] px-3 py-2 text-center">
                  <div className="text-sm font-semibold text-amber-300">
                    {permissionStats.ask}
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Ask
                  </div>
                </div>

                <div className="px-3 py-2 text-center">
                  <div className="text-sm font-semibold text-zinc-400">
                    {permissionStats.deny}
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Deny
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showPresets ? (
          <div className="border-b border-white/[0.06] bg-white/[0.015] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-300">
                  Permission profile
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                  Apply a predefined security
                  configuration.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowPresetsPanel(
                    (current) => !current,
                  )
                }
                disabled={disabled || isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4 text-violet-300" />
                Apply profile

                <ChevronDown
                  className={[
                    "h-4 w-4 transition-transform",
                    showPresetsPanel
                      ? "rotate-180"
                      : "",
                  ].join(" ")}
                />
              </button>
            </div>

            {showPresetsPanel ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {DEFAULT_PRESETS.map(
                  (preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        applyPreset(preset)
                      }
                      disabled={
                        disabled || isSaving
                      }
                      className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-left transition hover:border-violet-500/30 hover:bg-violet-500/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            {preset.name}
                          </h3>

                          <p className="mt-2 text-xs leading-5 text-zinc-500">
                            {preset.description}
                          </p>
                        </div>

                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                      </div>
                    </button>
                  ),
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-4 p-5 sm:p-6">
            {Array.from({
              length: 5,
            }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5"
              >
                <div className="h-4 w-36 rounded bg-white/[0.06]" />

                <div className="mt-3 h-3 w-full rounded bg-white/[0.04]" />

                <div className="mt-2 h-3 w-2/3 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <div className="space-y-4">
              {Object.entries(
                groupedPermissions,
              ).map(
                ([
                  category,
                  categoryPermissions,
                ]) => {
                  const config =
                    getCategoryConfig(category);

                  const Icon =
                    config.icon;

                  const isExpanded =
                    expandedCategories[
                      category
                    ] ?? true;

                  return (
                    <div
                      key={category}
                      className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/[0.12]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleCategory(
                            category,
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 border-b border-white/[0.06] bg-white/[0.015] px-4 py-4 text-left transition hover:bg-white/[0.03]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04]">
                            <Icon className="h-4 w-4 text-violet-300" />
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-white">
                              {config.label}
                            </h3>

                            <p className="mt-0.5 text-xs text-zinc-600">
                              {
                                categoryPermissions.length
                              }{" "}
                              permissions
                            </p>
                          </div>
                        </div>

                        <ChevronDown
                          className={[
                            "h-4 w-4 text-zinc-500 transition-transform",
                            isExpanded
                              ? ""
                              : "-rotate-90",
                          ].join(" ")}
                        />
                      </button>

                      {isExpanded ? (
                        <div className="divide-y divide-white/[0.05]">
                          {categoryPermissions.map(
                            (
                              permission,
                            ) => {
                              const risk =
                                getRiskClasses(
                                  permission.risk,
                                );

                              const isLocked =
                                Boolean(
                                  permission.locked ||
                                    permission.required,
                                );

                              return (
                                <div
                                  key={
                                    permission.id
                                  }
                                  className="flex flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="text-sm font-medium text-zinc-200">
                                        {
                                          permission.name
                                        }
                                      </h4>

                                      {permission.risk ? (
                                        <span
                                          className={[
                                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                            risk.badge,
                                          ].join(
                                            " ",
                                          )}
                                        >
                                          <span
                                            className={[
                                              "h-1.5 w-1.5 rounded-full",
                                              risk.dot,
                                            ].join(
                                              " ",
                                            )}
                                          />

                                          {
                                            permission.risk
                                          }{" "}
                                          risk
                                        </span>
                                      ) : null}

                                      {isLocked ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600">
                                          <Lock className="h-3 w-3" />
                                          Locked
                                        </span>
                                      ) : null}
                                    </div>

                                    {permission.description ? (
                                      <p className="mt-1.5 max-w-2xl text-xs leading-5 text-zinc-500">
                                        {
                                          permission.description
                                        }
                                      </p>
                                    ) : null}
                                  </div>

                                  <div className="flex shrink-0 overflow-hidden rounded-xl border border-white/[0.07] bg-black/20">
                                    {(
                                      [
                                        "allow",
                                        "ask",
                                        "deny",
                                      ] as PermissionValue[]
                                    ).map(
                                      (
                                        value,
                                      ) => {
                                        const config =
                                          getPermissionConfig(
                                            value,
                                          );

                                        const Icon =
                                          config.icon;

                                        const isSelected =
                                          permission.value ===
                                          value;

                                        return (
                                          <button
                                            key={
                                              value
                                            }
                                            type="button"
                                            disabled={
                                              disabled ||
                                              isSaving ||
                                              isLocked
                                            }
                                            onClick={() =>
                                              updatePermission(
                                                permission.id,
                                                value,
                                              )
                                            }
                                            className={[
                                              "relative flex min-w-[76px] items-center justify-center gap-1.5 border-r border-white/[0.06] px-3 py-2.5 text-xs font-medium transition last:border-r-0 disabled:cursor-not-allowed disabled:opacity-40",
                                              isSelected
                                                ? config.className
                                                : "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300",
                                            ].join(
                                              " ",
                                            )}
                                          >
                                            <Icon className="h-3.5 w-3.5" />

                                            {
                                              config.label
                                            }
                                          </button>
                                        );
                                      },
                                    )}
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                },
              )}
            </div>

            {currentPermissions.some(
              (permission) =>
                permission.risk ===
                  "critical" &&
                permission.value ===
                  "allow",
            ) ? (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

                <div>
                  <p className="text-sm font-semibold text-red-200">
                    Critical permission enabled
                  </p>

                  <p className="mt-1 text-xs leading-5 text-red-200/60">
                    This agent has direct access to a
                    critical capability. Review access
                    controls before deploying it to
                    production.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-white/[0.06] bg-white/[0.015] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-xs">
            {hasChanges ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400" />

                <span className="text-amber-300">
                  Unsaved permission changes
                </span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />

                <span className="text-zinc-500">
                  All permission settings are saved
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasChanges ? (
              <button
                type="button"
                onClick={handleReset}
                disabled={
                  disabled || isSaving
                }
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            ) : null}

            {showSaveButton ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  disabled ||
                  isSaving ||
                  !hasChanges ||
                  !onSave
                }
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                Save permissions
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}