"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type UsagePeriod =
  | "daily"
  | "weekly"
  | "monthly"
  | "all_time";

export interface UsageMetric {
  used: number;
  limit: number | null;
}

export interface UsageData {
  period: UsagePeriod;

  requests: UsageMetric;
  tokens: UsageMetric;
  credits: UsageMetric;

  storage?: UsageMetric;

  resetAt?: string | null;

  updatedAt?: string;

  metadata?: Record<string, unknown>;
}

export interface UsageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UseUsageOptions {
  initialUsage?: UsageData | null;
  autoLoad?: boolean;
  endpoint?: string;
}

export interface UsageSummary {
  used: number;
  limit: number | null;
  remaining: number | null;
  percentage: number;
  isUnlimited: boolean;
  isLimitReached: boolean;
  isNearLimit: boolean;
}

export interface UseUsageReturn {
  usage: UsageData | null;

  isLoading: boolean;

  isRefreshing: boolean;

  error: string | null;

  requestUsage: UsageSummary | null;

  tokenUsage: UsageSummary | null;

  creditUsage: UsageSummary | null;

  storageUsage: UsageSummary | null;

  load: () => Promise<void>;

  refresh: () => Promise<void>;

  clearError: () => void;

  getMetricSummary: (
    metric: UsageMetric | undefined
  ) => UsageSummary | null;
}

const DEFAULT_ENDPOINT = "/api/usage";

function normalizeUsageValue(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function createUsageSummary(
  metric: UsageMetric | undefined
): UsageSummary | null {
  if (!metric) {
    return null;
  }

  const used = normalizeUsageValue(
    metric.used
  );

  const limit =
    metric.limit === null
      ? null
      : normalizeUsageValue(
          metric.limit
        );

  const isUnlimited =
    limit === null;

  const remaining =
    limit === null
      ? null
      : Math.max(
          0,
          limit - used
        );

  const percentage =
    limit === null || limit <= 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (used / limit) * 100
          )
        );

  const isLimitReached =
    limit !== null &&
    used >= limit;

  const isNearLimit =
    limit !== null &&
    !isLimitReached &&
    percentage >= 80;

  return {
    used,
    limit,
    remaining,
    percentage,
    isUnlimited,
    isLimitReached,
    isNearLimit,
  };
}

function isUsageData(
  value: unknown
): value is UsageData {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  return "period" in value;
}

async function parseResponse<T>(
  response: Response
): Promise<UsageResult<T>> {
  let payload: unknown = null;

  try {
    const contentType =
      response.headers.get(
        "content-type"
      ) ?? "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      payload = await response.json();
    }
  } catch {
    payload = null;
  }

  if (!response.ok) {
    let error =
      `Request failed with status ${response.status}`;

    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      error = payload.error;
    }

    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data: payload as T,
  };
}

export function useUsage(
  options: UseUsageOptions = {}
): UseUsageReturn {
  const {
    initialUsage = null,
    autoLoad = true,
    endpoint = DEFAULT_ENDPOINT,
  } = options;

  const [usage, setUsage] =
    useState<UsageData | null>(
      initialUsage
    );

  const [isLoading, setIsLoading] =
    useState(false);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const abortControllerRef =
    useRef<AbortController | null>(
      null
    );

  const load = useCallback(
    async () => {
      abortControllerRef.current?.abort();

      const controller =
        new AbortController();

      abortControllerRef.current =
        controller;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          endpoint,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
            },
            signal: controller.signal,
          }
        );

        const result =
          await parseResponse<UsageData>(
            response
          );

        if (!result.success) {
          setError(
            result.error ??
              "Usage data could not be loaded."
          );

          return;
        }

        if (
          result.data &&
          isUsageData(result.data)
        ) {
          setUsage(result.data);
        } else {
          setUsage(null);
        }
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name ===
            "AbortError"
        ) {
          return;
        }

        const message =
          requestError instanceof Error
            ? requestError.message
            : "An unexpected error occurred.";

        setError(message);
      } finally {
        if (
          abortControllerRef.current ===
          controller
        ) {
          abortControllerRef.current =
            null;
        }

        setIsLoading(false);
      }
    },
    [endpoint]
  );

  const refresh = useCallback(
    async () => {
      setIsRefreshing(true);

      try {
        await load();
      } finally {
        setIsRefreshing(false);
      }
    },
    [load]
  );

  const clearError =
    useCallback(() => {
      setError(null);
    }, []);

  const requestUsage = useMemo(
    () =>
      createUsageSummary(
        usage?.requests
      ),
    [usage]
  );

  const tokenUsage = useMemo(
    () =>
      createUsageSummary(
        usage?.tokens
      ),
    [usage]
  );

  const creditUsage = useMemo(
    () =>
      createUsageSummary(
        usage?.credits
      ),
    [usage]
  );

  const storageUsage = useMemo(
    () =>
      createUsageSummary(
        usage?.storage
      ),
    [usage]
  );

  const getMetricSummary =
    useCallback(
      (
        metric:
          | UsageMetric
          | undefined
      ): UsageSummary | null => {
        return createUsageSummary(
          metric
        );
      },
      []
    );

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    void load();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [autoLoad, load]);

  return {
    usage,

    isLoading,

    isRefreshing,

    error,

    requestUsage,

    tokenUsage,

    creditUsage,

    storageUsage,

    load,

    refresh,

    clearError,

    getMetricSummary,
  };
}

export default useUsage;