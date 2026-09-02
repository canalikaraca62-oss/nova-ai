"use client";

import type {
  FormEvent} from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type AgentRole =
  | "general"
  | "research"
  | "coding"
  | "writing"
  | "business"
  | "marketing"
  | "finance"
  | "design"
  | "data"
  | "automation";

type AgentStatus =
  | "draft"
  | "ready"
  | "saving"
  | "error";

type AgentCapability =
  | "research"
  | "web"
  | "code"
  | "writing"
  | "analysis"
  | "files"
  | "automation"
  | "vision"
  | "data";

const MODEL_OPTIONS = [
  "auto",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
] as const;

type AgentModel = (typeof MODEL_OPTIONS)[number];

interface RoleOption {
  value: AgentRole;
  label: string;
  description: string;
  icon: string;
}

interface CapabilityOption {
  value: AgentCapability;
  label: string;
  description: string;
}

interface AgentBuilderProps {
  initialAgent?: {
    id?: string;
    name?: string;
    description?: string;
    instructions?: string;
    role?: AgentRole;
    capabilities?: AgentCapability[];
    model?: AgentModel;
    temperature?: number;
    isPublic?: boolean;
  };
  onCreated?: (agent: BuiltAgent) => void;
  onCancel?: () => void;
}

export interface BuiltAgent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  role: AgentRole;
  capabilities: AgentCapability[];
  model: AgentModel;
  temperature: number;
  isPublic: boolean;
  createdAt: string;
}

const DEFAULT_ROLE_OPTION: RoleOption = {
  value: "general",
  label: "General",
  description: "Flexible assistant for everyday work.",
  icon: "✦",
};

const ROLE_OPTIONS: readonly RoleOption[] = [
  DEFAULT_ROLE_OPTION,
  {
    value: "research",
    label: "Research",
    description: "Investigates, compares and synthesizes information.",
    icon: "⌕",
  },
  {
    value: "coding",
    label: "Coding",
    description: "Builds, explains and improves software.",
    icon: "</>",
  },
  {
    value: "writing",
    label: "Writing",
    description: "Creates high-quality structured content.",
    icon: "✎",
  },
  {
    value: "business",
    label: "Business",
    description: "Supports strategy, operations and decision making.",
    icon: "▣",
  },
  {
    value: "marketing",
    label: "Marketing",
    description: "Helps with growth, positioning and campaigns.",
    icon: "◎",
  },
  {
    value: "finance",
    label: "Finance",
    description: "Assists with financial analysis and planning.",
    icon: "₿",
  },
  {
    value: "design",
    label: "Design",
    description: "Supports creative thinking and product design.",
    icon: "◇",
  },
  {
    value: "data",
    label: "Data",
    description: "Analyzes structured information and insights.",
    icon: "▤",
  },
  {
    value: "automation",
    label: "Automation",
    description: "Executes repeatable workflows and tasks.",
    icon: "↻",
  },
];

const CAPABILITY_OPTIONS: readonly CapabilityOption[] = [
  {
    value: "research",
    label: "Research",
    description: "Investigate and synthesize information.",
  },
  {
    value: "web",
    label: "Web",
    description: "Use web-connected workflows when available.",
  },
  {
    value: "code",
    label: "Code",
    description: "Analyze and generate software.",
  },
  {
    value: "writing",
    label: "Writing",
    description: "Create structured written content.",
  },
  {
    value: "analysis",
    label: "Analysis",
    description: "Reason through complex data and decisions.",
  },
  {
    value: "files",
    label: "Files",
    description: "Work with uploaded documents and assets.",
  },
  {
    value: "automation",
    label: "Automation",
    description: "Run repeatable multi-step workflows.",
  },
  {
    value: "vision",
    label: "Vision",
    description: "Analyze supported visual content.",
  },
  {
    value: "data",
    label: "Data",
    description: "Process structured and analytical datasets.",
  },
];

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `agent_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function isAgentModel(value: string): value is AgentModel {
  return MODEL_OPTIONS.includes(value as AgentModel);
}

export default function AgentBuilder({
  initialAgent,
  onCreated,
  onCancel,
}: AgentBuilderProps) {
  const [name, setName] = useState<string>(
    initialAgent?.name ?? ""
  );

  const [description, setDescription] = useState<string>(
    initialAgent?.description ?? ""
  );

  const [instructions, setInstructions] = useState<string>(
    initialAgent?.instructions ?? ""
  );

  const [role, setRole] = useState<AgentRole>(
    initialAgent?.role ?? "general"
  );

  const [capabilities, setCapabilities] =
    useState<AgentCapability[]>(
      initialAgent?.capabilities ?? [
        "research",
        "analysis",
      ]
    );

  const [model, setModel] = useState<AgentModel>(
    initialAgent?.model ?? "auto"
  );

  const [temperature, setTemperature] =
    useState<number>(
      typeof initialAgent?.temperature === "number"
        ? initialAgent.temperature
        : 0.7
    );

  const [isPublic, setIsPublic] = useState<boolean>(
    initialAgent?.isPublic ?? false
  );

  const [status, setStatus] =
    useState<AgentStatus>("draft");

  const [error, setError] = useState<string | null>(
    null
  );

  const [isPreviewOpen, setIsPreviewOpen] =
    useState<boolean>(false);

  useEffect(() => {
    if (!initialAgent) {
      return;
    }

    setName(initialAgent.name ?? "");

    setDescription(
      initialAgent.description ?? ""
    );

    setInstructions(
      initialAgent.instructions ?? ""
    );

    setRole(
      initialAgent.role ?? "general"
    );

    setCapabilities(
      initialAgent.capabilities ?? [
        "research",
        "analysis",
      ]
    );

    setModel(
      initialAgent.model ?? "auto"
    );

    setTemperature(
      typeof initialAgent.temperature === "number"
        ? initialAgent.temperature
        : 0.7
    );

    setIsPublic(
      initialAgent.isPublic ?? false
    );
  }, [initialAgent]);

  /*
   * IMPORTANT:
   *
   * ROLE_OPTIONS[0] can be undefined when
   * noUncheckedIndexedAccess is enabled.
   *
   * Therefore we use DEFAULT_ROLE_OPTION.
   * selectedRole is now guaranteed to be RoleOption.
   */
  const selectedRole: RoleOption = useMemo(() => {
    return (
      ROLE_OPTIONS.find(
        (item) => item.value === role
      ) ?? DEFAULT_ROLE_OPTION
    );
  }, [role]);

  const completionScore = useMemo(() => {
    let score = 0;

    if (name.trim().length >= 2) {
      score += 25;
    }

    if (description.trim().length >= 10) {
      score += 20;
    }

    if (instructions.trim().length >= 20) {
      score += 30;
    }

    if (capabilities.length > 0) {
      score += 15;
    }

    if (model) {
      score += 10;
    }

    return score;
  }, [
    name,
    description,
    instructions,
    capabilities,
    model,
  ]);

  const isReady = useMemo(() => {
    return (
      name.trim().length >= 2 &&
      description.trim().length >= 5 &&
      instructions.trim().length >= 10 &&
      capabilities.length > 0
    );
  }, [
    name,
    description,
    instructions,
    capabilities,
  ]);

  const toggleCapability = useCallback(
    (capability: AgentCapability) => {
      setCapabilities((current) => {
        if (current.includes(capability)) {
          return current.filter(
            (item) => item !== capability
          );
        }

        return [
          ...current,
          capability,
        ];
      });
    },
    []
  );

  const resetBuilder = useCallback(() => {
    setName("");
    setDescription("");
    setInstructions("");
    setRole("general");

    setCapabilities([
      "research",
      "analysis",
    ]);

    setModel("auto");
    setTemperature(0.7);
    setIsPublic(false);
    setStatus("draft");
    setError(null);
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setError(null);

    if (!isReady) {
      setStatus("error");

      setError(
        "Complete the required agent configuration before saving."
      );

      return;
    }

    setStatus("saving");

    const payload = {
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      role,
      capabilities,
      model,
      temperature,
      isPublic,
    };

    try {
      const response = await fetch(
        "/api/agents",
        {
          method: initialAgent?.id
            ? "PATCH"
            : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            ...(initialAgent?.id
              ? {
                  id: initialAgent.id,
                }
              : {}),
            ...payload,
          }),
        }
      );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              agent?: Partial<BuiltAgent>;
              error?: string;
            }
          | null;

      if (!response.ok) {
        throw new Error(
          result?.error ??
            "Unable to save the agent."
        );
      }

      const returnedModel =
        result?.agent?.model;

      const safeModel: AgentModel =
        returnedModel &&
        isAgentModel(returnedModel)
          ? returnedModel
          : payload.model;

      const returnedRole =
        result?.agent?.role;

      const safeRole: AgentRole =
        returnedRole ?? payload.role;

      const returnedCapabilities =
        result?.agent?.capabilities;

      const safeCapabilities:
        AgentCapability[] =
        returnedCapabilities ??
        payload.capabilities;

      const agent: BuiltAgent = {
        id:
          result?.agent?.id ??
          initialAgent?.id ??
          createId(),

        name:
          result?.agent?.name ??
          payload.name,

        description:
          result?.agent?.description ??
          payload.description,

        instructions:
          result?.agent?.instructions ??
          payload.instructions,

        role: safeRole,

        capabilities:
          safeCapabilities,

        model: safeModel,

        temperature:
          typeof result?.agent?.temperature ===
          "number"
            ? result.agent.temperature
            : payload.temperature,

        isPublic:
          typeof result?.agent?.isPublic ===
          "boolean"
            ? result.agent.isPublic
            : payload.isPublic,

        createdAt:
          result?.agent?.createdAt ??
          new Date().toISOString(),
      };

      setStatus("ready");

      onCreated?.(agent);
    } catch (caughtError) {
      setStatus("error");

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the agent."
      );
    }
  }

  return (
    <section className="w-full">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-6xl flex-col gap-8"
      >
        <div className="flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white">
                ✦
              </span>

              <span className="text-xs font-medium uppercase tracking-[0.22em] text-white/45">
                Agent Studio
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {initialAgent?.id
                ? "Configure your agent"
                : "Build a new agent"}
            </h1>

            <p className="max-w-2xl text-sm leading-6 text-white/50">
              Define the agent&apos;s role,
              expertise, instructions, model
              behavior and operational
              capabilities.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-44 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-white/45">
                  Configuration
                </span>

                <span className="text-sm font-semibold text-white">
                  {completionScore}%
                </span>
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{
                    width: `${completionScore}%`,
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setIsPreviewOpen(
                  (current) => !current
                )
              }
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.07]"
            >
              {isPreviewOpen
                ? "Hide preview"
                : "Preview"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="mb-6">
                <h2 className="text-base font-semibold text-white">
                  Core identity
                </h2>

                <p className="mt-1 text-sm text-white/45">
                  Give the agent a clear
                  purpose and recognizable
                  identity.
                </p>
              </div>

              <div className="grid gap-5">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-white/80">
                    Agent name
                  </span>

                  <input
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value
                      )
                    }
                    maxLength={80}
                    placeholder="e.g. Strategy Copilot"
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.03]"
                  />

                  <span className="text-xs text-white/35">
                    {name.length}/80
                  </span>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-white/80">
                    Description
                  </span>

                  <textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value
                      )
                    }
                    maxLength={280}
                    rows={3}
                    placeholder="Explain what this agent specializes in."
                    className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.03]"
                  />

                  <span className="text-xs text-white/35">
                    {description.length}/280
                  </span>
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="mb-6">
                <h2 className="text-base font-semibold text-white">
                  Agent specialization
                </h2>

                <p className="mt-1 text-sm text-white/45">
                  Select the primary role that
                  best represents this agent.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {ROLE_OPTIONS.map(
                  (option) => {
                    const selected =
                      option.value === role;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setRole(option.value)
                        }
                        className={[
                          "group flex min-h-28 flex-col rounded-2xl border p-4 text-left transition",
                          selected
                            ? "border-white/40 bg-white/[0.08]"
                            : "border-white/10 bg-black/10 hover:border-white/20 hover:bg-white/[0.035]",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-lg text-white">
                            {option.icon}
                          </span>

                          {selected ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
                              ✓
                            </span>
                          ) : null}
                        </div>

                        <span className="mt-3 text-sm font-semibold text-white">
                          {option.label}
                        </span>

                        <span className="mt-1 text-xs leading-5 text-white/40">
                          {option.description}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="mb-6">
                <h2 className="text-base font-semibold text-white">
                  System instructions
                </h2>

                <p className="mt-1 text-sm text-white/45">
                  Define how the agent thinks,
                  responds and approaches its
                  work.
                </p>
              </div>

              <label className="grid gap-2">
                <textarea
                  value={instructions}
                  onChange={(event) =>
                    setInstructions(
                      event.target.value
                    )
                  }
                  rows={12}
                  placeholder={`You are a highly capable ${selectedRole.label.toLowerCase()} agent.

Your responsibilities:
- Understand the user's objective
- Ask for clarification when required
- Produce structured, accurate results
- Be transparent about uncertainty
- Prefer useful action over unnecessary verbosity`}
                  className="min-h-80 w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-4 font-mono text-sm leading-7 text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.03]"
                />

                <div className="flex items-center justify-between text-xs text-white/35">
                  <span>
                    Clear instructions produce
                    more predictable behavior.
                  </span>

                  <span>
                    {instructions.length}
                    {" "}characters
                  </span>
                </div>
              </label>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="mb-6">
                <h2 className="text-base font-semibold text-white">
                  Capabilities
                </h2>

                <p className="mt-1 text-sm text-white/45">
                  Choose the tools and
                  operational capabilities
                  available to this agent.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {CAPABILITY_OPTIONS.map(
                  (capability) => {
                    const selected =
                      capabilities.includes(
                        capability.value
                      );

                    return (
                      <button
                        key={capability.value}
                        type="button"
                        onClick={() =>
                          toggleCapability(
                            capability.value
                          )
                        }
                        className={[
                          "flex items-start gap-3 rounded-2xl border p-4 text-left transition",
                          selected
                            ? "border-white/30 bg-white/[0.07]"
                            : "border-white/10 bg-black/10 hover:border-white/20",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px]",
                            selected
                              ? "border-white bg-white text-black"
                              : "border-white/20 text-transparent",
                          ].join(" ")}
                        >
                          ✓
                        </span>

                        <span>
                          <span className="block text-sm font-medium text-white">
                            {capability.label}
                          </span>

                          <span className="mt-1 block text-xs leading-5 text-white/40">
                            {capability.description}
                          </span>
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="mb-6">
                <h2 className="text-base font-semibold text-white">
                  Runtime behavior
                </h2>

                <p className="mt-1 text-sm text-white/45">
                  Control model selection and
                  response creativity.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-white/80">
                    Model
                  </span>

                  <select
                    value={model}
                    onChange={(event) => {
                      const value =
                        event.target.value;

                      if (isAgentModel(value)) {
                        setModel(value);
                      }
                    }}
                    className="h-12 rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-white/30"
                  >
                    {MODEL_OPTIONS.map(
                      (option) => (
                        <option
                          key={option}
                          value={option}
                        >
                          {option === "auto"
                            ? "Automatic routing"
                            : option}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/80">
                      Creativity
                    </span>

                    <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/60">
                      {temperature.toFixed(1)}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(event) =>
                      setTemperature(
                        Number(
                          event.target.value
                        )
                      )
                    }
                    className="w-full accent-white"
                  />

                  <div className="flex justify-between text-xs text-white/30">
                    <span>Focused</span>
                    <span>Balanced</span>
                    <span>Creative</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Agent visibility
                  </h2>

                  <p className="mt-1 max-w-xl text-sm leading-6 text-white/45">
                    Public agents can be
                    discoverable in shared
                    environments depending on
                    workspace permissions.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isPublic}
                  onClick={() =>
                    setIsPublic(
                      (current) => !current
                    )
                  }
                  className={[
                    "relative h-8 w-14 shrink-0 rounded-full border transition",
                    isPublic
                      ? "border-white bg-white"
                      : "border-white/15 bg-black/30",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 h-6 w-6 rounded-full transition",
                      isPublic
                        ? "left-7 bg-black"
                        : "left-1 bg-white/60",
                    ].join(" ")}
                  />
                </button>
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetBuilder}
                  disabled={
                    status === "saving"
                  }
                  className="rounded-xl px-4 py-3 text-sm text-white/50 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset
                </button>

                {onCancel ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={
                      status === "saving"
                    }
                    className="rounded-xl px-4 py-3 text-sm text-white/50 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={
                  !isReady ||
                  status === "saving"
                }
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status === "saving"
                  ? "Saving agent..."
                  : initialAgent?.id
                    ? "Save changes"
                    : "Create agent"}
              </button>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="sticky top-6 rounded-3xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">
                  Live summary
                </span>

                <span
                  className={[
                    "rounded-full border px-2.5 py-1 text-[11px]",
                    status === "ready"
                      ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200"
                      : status === "error"
                        ? "border-red-400/20 bg-red-400/[0.08] text-red-200"
                        : "border-white/10 bg-white/[0.04] text-white/45",
                  ].join(" ")}
                >
                  {status}
                </span>
              </div>

              <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl text-white">
                {selectedRole.icon}
              </div>

              <h3 className="mt-4 text-lg font-semibold text-white">
                {name.trim() ||
                  "Untitled Agent"}
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/45">
                {description.trim() ||
                  "Your agent description will appear here."}
              </p>

              <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
                <SummaryRow
                  label="Role"
                  value={selectedRole.label}
                />

                <SummaryRow
                  label="Model"
                  value={
                    model === "auto"
                      ? "Automatic"
                      : model
                  }
                />

                <SummaryRow
                  label="Capabilities"
                  value={`${capabilities.length} enabled`}
                />

                <SummaryRow
                  label="Visibility"
                  value={
                    isPublic
                      ? "Public"
                      : "Private"
                  }
                />
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">
                    Build readiness
                  </span>

                  <span className="text-sm font-semibold text-white">
                    {completionScore}%
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{
                      width: `${completionScore}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {isPreviewOpen ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">
                  Behavior preview
                </span>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-sm leading-6 text-white/70">
                    I&apos;m{" "}
                    <span className="font-semibold text-white">
                      {name.trim() ||
                        "your new agent"}
                    </span>
                    . I specialize in{" "}
                    {selectedRole.label.toLowerCase()}
                    {" "}work and currently have{" "}
                    {capabilities.length}{" "}
                    enabled capabilities.
                  </p>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </form>
    </section>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-white/40">
        {label}
      </span>

      <span className="max-w-[190px] truncate text-right text-xs font-medium text-white/75">
        {value}
      </span>
    </div>
  );
}