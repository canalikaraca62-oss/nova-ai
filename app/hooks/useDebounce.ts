"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface UseDebounceOptions {
  leading?: boolean;
}

export function useDebounce<T>(
  value: T,
  delay = 300
): T {
  const [debouncedValue, setDebouncedValue] =
    useState<T>(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => {
        setDebouncedValue(value);
      },
      Math.max(0, delay)
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useDebouncedCallback<
  TArgs extends unknown[]
>(
  callback: (...args: TArgs) => void,
  delay = 300,
  options: UseDebounceOptions = {}
) {
  const { leading = false } = options;

  const callbackRef = useRef(callback);
  const timeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const leadingCalledRef =
    useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(
        timeoutRef.current
      );

      timeoutRef.current = null;
    }

    leadingCalledRef.current = false;
  }, []);

  const debounced = useCallback(
    (...args: TArgs) => {
      if (timeoutRef.current) {
        clearTimeout(
          timeoutRef.current
        );
      }

      const shouldCallLeading =
        leading &&
        !leadingCalledRef.current;

      if (shouldCallLeading) {
        callbackRef.current(
          ...args
        );

        leadingCalledRef.current = true;
      }

      timeoutRef.current = setTimeout(
        () => {
          if (!leading) {
            callbackRef.current(
              ...args
            );
          }

          leadingCalledRef.current = false;
          timeoutRef.current = null;
        },
        Math.max(0, delay)
      );
    },
    [delay, leading]
  );

  const flush = useCallback(
    (...args: TArgs) => {
      if (timeoutRef.current) {
        clearTimeout(
          timeoutRef.current
        );

        timeoutRef.current = null;
      }

      leadingCalledRef.current = false;

      callbackRef.current(
        ...args
      );
    },
    []
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(
          timeoutRef.current
        );
      }
    };
  }, []);

  return {
    debounced,
    cancel,
    flush,
  };
}

export function useDebounceState<T>(
  initialValue: T,
  delay = 300
): [
  T,
  T,
  (value: T) => void
] {
  const [value, setValue] =
    useState<T>(initialValue);

  const debouncedValue =
    useDebounce(
      value,
      delay
    );

  return [
    value,
    debouncedValue,
    setValue,
  ];
}

export default useDebounce;