"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   TYPES
========================================================= */

export type AgentStatus =
  | "active"
  | "inactive"
  | "draft"
  | "running"
  | "error";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentPermission =
  | "read"
  | "write"
  | "execute"
  | "search"
  | "files"
  | "knowledge"
  | "web";

export interface Agent {
  id: string;
  name: string;
  description: string;
  avatar?: string | null;

  status: AgentStatus;

  model: string;
  systemPrompt: string;

  capabilities: string[];
  permissions: AgentPermission[];

  tags: string[];

  temperature: number;
  maxTokens: number;

  createdAt: string;
  updatedAt: string;

  lastRunAt?: string | null;
  totalRuns: number;

  metadata?: Record<string, unknown>;
}

export interface AgentRun {
  id: string;

  agentId: string;

  status: AgentRunStatus;

  input?: string;
  output?: string;

  error?: string | null;

  startedAt: string;
  completedAt?: string | null;

  duration?: number | null;

  tokensUsed?: number | null;

  metadata?: Record<string, unknown>;
}

export interface CreateAgentInput {
  name: string;

  description?: string;

  avatar?: string | null;

  status?: AgentStatus;

  model?: string;

  systemPrompt?: string;

  capabilities?: string[];

  permissions?: AgentPermission[];

  tags?: string[];

  temperature?: number;

  maxTokens?: number;

  metadata?: Record<string, unknown>;
}

export interface UpdateAgentInput {
  name?: string;

  description?: string;

  avatar?: string | null;

  status?: AgentStatus;

  model?: string;

  systemPrompt?: string;

  capabilities?: string[];

  permissions?: AgentPermission[];

  tags?: string[];

  temperature?: number;

  maxTokens?: number;

  metadata?: Record<string, unknown>;
}

export interface CreateAgentRunInput {
  agentId: string;

  status?: AgentRunStatus;

  input?: string;

  output?: string;

  error?: string | null;

  startedAt?: string;

  completedAt?: string | null;

  duration?: number | null;

  tokensUsed?: number | null;

  metadata?: Record<string, unknown>;
}

/* =========================================================
   STORE STATE
========================================================= */

interface AgentStoreContextValue {
  agents: Agent[];

  runs: AgentRun[];

  selectedAgentId: string | null;

  selectedAgent: Agent | null;

  isLoaded: boolean;

  createAgent: (
    input: CreateAgentInput
  ) => Agent;

  updateAgent: (
    id: string,
    input: UpdateAgentInput
  ) => Agent | null;

  deleteAgent: (
    id: string
  ) => void;

  duplicateAgent: (
    id: string
  ) => Agent | null;

  getAgent: (
    id: string
  ) => Agent | null;

  selectAgent: (
    id: string | null
  ) => void;

  setAgents: (
    agents: Agent[]
  ) => void;

  createRun: (
    input: CreateAgentRunInput
  ) => AgentRun;

  updateRun: (
    id: string,
    updates: Partial<
      Omit<AgentRun, "id" | "agentId">
    >
  ) => AgentRun | null;

  completeRun: (
    id: string,
    output?: string,
    metadata?: Record<string, unknown>
  ) => AgentRun | null;

  failRun: (
    id: string,
    error: string,
    metadata?: Record<string, unknown>
  ) => AgentRun | null;

  deleteRun: (
    id: string
  ) => void;

  clearAgentRuns: (
    agentId: string
  ) => void;

  getAgentRuns: (
    agentId: string
  ) => AgentRun[];

  resetStore: () => void;
}

/* =========================================================
   CONSTANTS
========================================================= */

const STORAGE_KEY =
  "syraven-agent-store-v1";

const DEFAULT_MODEL =
  "gpt-4o-mini";

const DEFAULT_TEMPERATURE =
  0.7;

const DEFAULT_MAX_TOKENS =
  4096;

/* =========================================================
   HELPERS
========================================================= */

function createId(
  prefix: string
): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

function normalizeTemperature(
  value: number | undefined
): number {
  if (
    typeof value !== "number" ||
    Number.isNaN(value)
  ) {
    return DEFAULT_TEMPERATURE;
  }

  return Math.min(
    2,
    Math.max(
      0,
      value
    )
  );
}

function normalizeMaxTokens(
  value: number | undefined
): number {
  if (
    typeof value !== "number" ||
    Number.isNaN(value)
  ) {
    return DEFAULT_MAX_TOKENS;
  }

  return Math.max(
    1,
    Math.floor(value)
  );
}

function createDefaultAgent(
  input: CreateAgentInput
): Agent {
  const timestamp = now();

  return {
    id: createId("agent"),

    name: input.name.trim(),

    description:
      input.description?.trim() ?? "",

    avatar:
      input.avatar ?? null,

    status:
      input.status ?? "draft",

    model:
      input.model?.trim() ||
      DEFAULT_MODEL,

    systemPrompt:
      input.systemPrompt ?? "",

    capabilities:
      input.capabilities ?? [],

    permissions:
      input.permissions ?? [],

    tags:
      input.tags ?? [],

    temperature:
      normalizeTemperature(
        input.temperature
      ),

    maxTokens:
      normalizeMaxTokens(
        input.maxTokens
      ),

    createdAt:
      timestamp,

    updatedAt:
      timestamp,

    lastRunAt:
      null,

    totalRuns:
      0,

    metadata:
      input.metadata ?? {},
  };
}

function createDefaultRun(
  input: CreateAgentRunInput
): AgentRun {
  return {
    id: createId("run"),

    agentId:
      input.agentId,

    status:
      input.status ?? "queued",

    input:
      input.input,

    output:
      input.output,

    error:
      input.error ?? null,

    startedAt:
      input.startedAt ?? now(),

    completedAt:
      input.completedAt ?? null,

    duration:
      input.duration ?? null,

    tokensUsed:
      input.tokensUsed ?? null,

    metadata:
      input.metadata ?? {},
  };
}

/* =========================================================
   CONTEXT
========================================================= */

const AgentStoreContext =
  createContext<
    AgentStoreContextValue | undefined
  >(undefined);

/* =========================================================
   PROVIDER
========================================================= */

export function AgentStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [agents, setAgentsState] =
    useState<Agent[]>([]);

  const [runs, setRuns] =
    useState<AgentRun[]>([]);

  const [
    selectedAgentId,
    setSelectedAgentId,
  ] = useState<string | null>(
    null
  );

  const [isLoaded, setIsLoaded] =
    useState(false);

  /* =====================================================
     LOAD PERSISTED STORE
  ===================================================== */

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        setIsLoaded(true);
        return;
      }

      const parsed =
        JSON.parse(raw) as {
          agents?: Agent[];
          runs?: AgentRun[];
          selectedAgentId?: string | null;
        };

      if (
        Array.isArray(
          parsed.agents
        )
      ) {
        setAgentsState(
          parsed.agents
        );
      }

      if (
        Array.isArray(
          parsed.runs
        )
      ) {
        setRuns(
          parsed.runs
        );
      }

      if (
        typeof parsed.selectedAgentId ===
          "string" ||
        parsed.selectedAgentId === null
      ) {
        setSelectedAgentId(
          parsed.selectedAgentId
        );
      }
    } catch (error) {
      console.error(
        "SYRAVEN AGENT STORE LOAD ERROR:",
        error
      );
    } finally {
      setIsLoaded(true);
    }
  }, []);

  /* =====================================================
     PERSIST STORE
  ===================================================== */

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          agents,
          runs,
          selectedAgentId,
        })
      );
    } catch (error) {
      console.error(
        "SYRAVEN AGENT STORE SAVE ERROR:",
        error
      );
    }
  }, [
    agents,
    runs,
    selectedAgentId,
    isLoaded,
  ]);

  /* =====================================================
     AGENT SELECTOR
  ===================================================== */

  const selectedAgent =
    useMemo(() => {
      if (!selectedAgentId) {
        return null;
      }

      return (
        agents.find(
          (agent) =>
            agent.id ===
            selectedAgentId
        ) ?? null
      );
    }, [
      agents,
      selectedAgentId,
    ]);

  /* =====================================================
     AGENT CRUD
  ===================================================== */

  const createAgent =
    useCallback(
      (
        input: CreateAgentInput
      ): Agent => {
        const agent =
          createDefaultAgent(
            input
          );

        setAgentsState(
          (current) => [
            agent,
            ...current,
          ]
        );

        setSelectedAgentId(
          agent.id
        );

        return agent;
      },
      []
    );

  const updateAgent =
    useCallback(
      (
        id: string,
        input: UpdateAgentInput
      ): Agent | null => {
        let updatedAgent:
          | Agent
          | null =
          null;

        setAgentsState(
          (current) =>
            current.map(
              (agent) => {
                if (
                  agent.id !== id
                ) {
                  return agent;
                }

                updatedAgent = {
                  ...agent,

                  ...input,

                  name:
                    input.name !==
                    undefined
                      ? input.name.trim()
                      : agent.name,

                  description:
                    input.description !==
                    undefined
                      ? input.description.trim()
                      : agent.description,

                  temperature:
                    input.temperature !==
                    undefined
                      ? normalizeTemperature(
                          input.temperature
                        )
                      : agent.temperature,

                  maxTokens:
                    input.maxTokens !==
                    undefined
                      ? normalizeMaxTokens(
                          input.maxTokens
                        )
                      : agent.maxTokens,

                  updatedAt:
                    now(),
                };

                return updatedAgent;
              }
            )
        );

        return updatedAgent;
      },
      []
    );

  const deleteAgent =
    useCallback(
      (
        id: string
      ) => {
        setAgentsState(
          (current) =>
            current.filter(
              (agent) =>
                agent.id !== id
            )
        );

        setRuns(
          (current) =>
            current.filter(
              (run) =>
                run.agentId !== id
            )
        );

        setSelectedAgentId(
          (current) =>
            current === id
              ? null
              : current
        );
      },
      []
    );

  const duplicateAgent =
    useCallback(
      (
        id: string
      ): Agent | null => {
        const source =
          agents.find(
            (agent) =>
              agent.id === id
          );

        if (!source) {
          return null;
        }

        const timestamp =
          now();

        const duplicated: Agent = {
          ...source,

          id:
            createId("agent"),

          name:
            `${source.name} Copy`,

          status:
            "draft",

          createdAt:
            timestamp,

          updatedAt:
            timestamp,

          lastRunAt:
            null,

          totalRuns:
            0,
        };

        setAgentsState(
          (current) => [
            duplicated,
            ...current,
          ]
        );

        setSelectedAgentId(
          duplicated.id
        );

        return duplicated;
      },
      [agents]
    );

  const getAgent =
    useCallback(
      (
        id: string
      ): Agent | null => {
        return (
          agents.find(
            (agent) =>
              agent.id === id
          ) ?? null
        );
      },
      [agents]
    );

  const selectAgent =
    useCallback(
      (
        id: string | null
      ) => {
        setSelectedAgentId(
          id
        );
      },
      []
    );

  const setAgents =
    useCallback(
      (
        nextAgents: Agent[]
      ) => {
        setAgentsState(
          nextAgents
        );

        setSelectedAgentId(
          (current) => {
            if (!current) {
              return current;
            }

            const exists =
              nextAgents.some(
                (agent) =>
                  agent.id ===
                  current
              );

            return exists
              ? current
              : null;
          }
        );
      },
      []
    );

  /* =====================================================
     RUN MANAGEMENT
  ===================================================== */

  const createRun =
    useCallback(
      (
        input: CreateAgentRunInput
      ): AgentRun => {
        const run =
          createDefaultRun(
            input
          );

        setRuns(
          (current) => [
            run,
            ...current,
          ]
        );

        setAgentsState(
          (current) =>
            current.map(
              (agent) =>
                agent.id ===
                input.agentId
                  ? {
                      ...agent,

                      status:
                        run.status ===
                        "running"
                          ? "running"
                          : agent.status,

                      lastRunAt:
                        run.startedAt,

                      totalRuns:
                        agent.totalRuns +
                        1,

                      updatedAt:
                        now(),
                    }
                  : agent
            )
        );

        return run;
      },
      []
    );

  const updateRun =
    useCallback(
      (
        id: string,
        updates: Partial<
          Omit<
            AgentRun,
            "id" | "agentId"
          >
        >
      ): AgentRun | null => {
        let updatedRun:
          | AgentRun
          | null =
          null;

        setRuns(
          (current) =>
            current.map(
              (run) => {
                if (
                  run.id !== id
                ) {
                  return run;
                }

                updatedRun = {
                  ...run,
                  ...updates,
                };

                return updatedRun;
              }
            )
        );

        return updatedRun;
      },
      []
    );

  const completeRun =
    useCallback(
      (
        id: string,
        output?: string,
        metadata?: Record<
          string,
          unknown
        >
      ): AgentRun | null => {
        const completedAt =
          now();

        let completedRun:
          | AgentRun
          | null =
          null;

        setRuns(
          (current) =>
            current.map(
              (run) => {
                if (
                  run.id !== id
                ) {
                  return run;
                }

                const started =
                  new Date(
                    run.startedAt
                  ).getTime();

                const completed =
                  new Date(
                    completedAt
                  ).getTime();

                completedRun = {
                  ...run,

                  status:
                    "completed",

                  output:
                    output ??
                    run.output,

                  completedAt,

                  duration:
                    Math.max(
                      0,
                      completed - started
                    ),

                  metadata: {
                    ...run.metadata,
                    ...metadata,
                  },
                };

                return completedRun;
              }
            )
        );

        if (completedRun) {
          setAgentsState(
            (current) =>
              current.map(
                (agent) =>
                  agent.id ===
                  completedRun?.agentId
                    ? {
                        ...agent,

                        status:
                          "active",

                        lastRunAt:
                          completedRun?.completedAt ??
                          agent.lastRunAt,

                        updatedAt:
                          now(),
                      }
                    : agent
              )
          );
        }

        return completedRun;
      },
      []
    );

  const failRun =
    useCallback(
      (
        id: string,
        error: string,
        metadata?: Record<
          string,
          unknown
        >
      ): AgentRun | null => {
        const completedAt =
          now();

        let failedRun:
          | AgentRun
          | null =
          null;

        setRuns(
          (current) =>
            current.map(
              (run) => {
                if (
                  run.id !== id
                ) {
                  return run;
                }

                const started =
                  new Date(
                    run.startedAt
                  ).getTime();

                const completed =
                  new Date(
                    completedAt
                  ).getTime();

                failedRun = {
                  ...run,

                  status:
                    "failed",

                  error,

                  completedAt,

                  duration:
                    Math.max(
                      0,
                      completed - started
                    ),

                  metadata: {
                    ...run.metadata,
                    ...metadata,
                  },
                };

                return failedRun;
              }
            )
        );

        if (failedRun) {
          setAgentsState(
            (current) =>
              current.map(
                (agent) =>
                  agent.id ===
                  failedRun?.agentId
                    ? {
                        ...agent,

                        status:
                          "error",

                        updatedAt:
                          now(),
                      }
                    : agent
              )
          );
        }

        return failedRun;
      },
      []
    );

  const deleteRun =
    useCallback(
      (
        id: string
      ) => {
        setRuns(
          (current) =>
            current.filter(
              (run) =>
                run.id !== id
            )
        );
      },
      []
    );

  const clearAgentRuns =
    useCallback(
      (
        agentId: string
      ) => {
        setRuns(
          (current) =>
            current.filter(
              (run) =>
                run.agentId !==
                agentId
            )
        );
      },
      []
    );

  const getAgentRuns =
    useCallback(
      (
        agentId: string
      ): AgentRun[] => {
        return runs
          .filter(
            (run) =>
              run.agentId ===
              agentId
          )
          .sort(
            (a, b) =>
              new Date(
                b.startedAt
              ).getTime() -
              new Date(
                a.startedAt
              ).getTime()
          );
      },
      [runs]
    );

  /* =====================================================
     RESET
  ===================================================== */

  const resetStore =
    useCallback(() => {
      setAgentsState([]);
      setRuns([]);
      setSelectedAgentId(null);

      try {
        window.localStorage.removeItem(
          STORAGE_KEY
        );
      } catch (error) {
        console.error(
          "SYRAVEN AGENT STORE RESET ERROR:",
          error
        );
      }
    }, []);

  /* =====================================================
     CONTEXT VALUE
  ===================================================== */

  const value =
    useMemo<
      AgentStoreContextValue
    >(
      () => ({
        agents,
        runs,

        selectedAgentId,
        selectedAgent,

        isLoaded,

        createAgent,
        updateAgent,
        deleteAgent,
        duplicateAgent,
        getAgent,

        selectAgent,
        setAgents,

        createRun,
        updateRun,
        completeRun,
        failRun,
        deleteRun,

        clearAgentRuns,
        getAgentRuns,

        resetStore,
      }),
      [
        agents,
        runs,

        selectedAgentId,
        selectedAgent,

        isLoaded,

        createAgent,
        updateAgent,
        deleteAgent,
        duplicateAgent,
        getAgent,

        selectAgent,
        setAgents,

        createRun,
        updateRun,
        completeRun,
        failRun,
        deleteRun,

        clearAgentRuns,
        getAgentRuns,

        resetStore,
      ]
    );

  return (
    <AgentStoreContext.Provider
      value={value}
    >
      {children}
    </AgentStoreContext.Provider>
  );
}

/* =========================================================
   STORE HOOK
========================================================= */

export function useAgentStore() {
  const context =
    useContext(
      AgentStoreContext
    );

  if (!context) {
    throw new Error(
      "useAgentStore must be used inside AgentStoreProvider."
    );
  }

  return context;
}

/* =========================================================
   OPTIONAL SAFE HOOK
========================================================= */

export function useOptionalAgentStore() {
  return useContext(
    AgentStoreContext
  );
}

export default AgentStoreProvider;