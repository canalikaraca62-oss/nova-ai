"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ShareAccess =
  | "private"
  | "unlisted"
  | "public";

export type ShareExpiration =
  | "never"
  | "1-day"
  | "7-days"
  | "30-days"
  | "custom";

export type ShareChatSettings = {
  access: ShareAccess;
  expiresAt?: string | null;
  allowSearchEngines: boolean;
  allowCopy: boolean;
};

export type ShareChatResult = {
  url: string;
  access?: ShareAccess;
  expiresAt?: string | null;
};

export type ShareChatDialogProps = {
  open: boolean;

  chatId: string;

  chatTitle?: string;

  initialSettings?: Partial<ShareChatSettings>;

  initialShareUrl?: string | null;

  className?: string;

  disabled?: boolean;

  onClose: () => void;

  onShare?: (
    settings: ShareChatSettings
  ) =>
    | ShareChatResult
    | Promise<ShareChatResult>;

  onRevoke?: () => void | Promise<void>;

  onCopy?: (
    url: string
  ) => void | Promise<void>;
};

const DEFAULT_SETTINGS: ShareChatSettings = {
  access: "unlisted",
  expiresAt: null,
  allowSearchEngines: false,
  allowCopy: true,
};

function cn(
  ...classes: Array<
    string | null | undefined | false
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

function getAccessLabel(
  access: ShareAccess
) {
  switch (access) {
    case "private":
      return "Private";

    case "public":
      return "Public";

    default:
      return "Anyone with link";
  }
}

function getAccessDescription(
  access: ShareAccess
) {
  switch (access) {
    case "private":
      return "Only you can access this conversation.";

    case "public":
      return "Anyone can discover and access this conversation.";

    default:
      return "Anyone with the link can view this conversation.";
  }
}

function getExpirationDate(
  expiration: ShareExpiration,
  customDate?: string
) {
  if (expiration === "never") {
    return null;
  }

  if (
    expiration === "custom"
  ) {
    return customDate || null;
  }

  const date = new Date();

  if (expiration === "1-day") {
    date.setDate(
      date.getDate() + 1
    );
  }

  if (expiration === "7-days") {
    date.setDate(
      date.getDate() + 7
    );
  }

  if (expiration === "30-days") {
    date.setDate(
      date.getDate() + 30
    );
  }

  return date.toISOString();
}

function getLocalDateInputValue(
  value?: string | null
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const offset =
    date.getTimezoneOffset() *
    60 *
    1000;

  return new Date(
    date.getTime() - offset
  )
    .toISOString()
    .slice(0, 16);
}

function inferExpiration(
  expiresAt?: string | null
): ShareExpiration {
  if (!expiresAt) {
    return "never";
  }

  const expirationDate =
    new Date(expiresAt);

  const now = new Date();

  const difference =
    expirationDate.getTime() -
    now.getTime();

  const days =
    difference /
    (1000 * 60 * 60 * 24);

  if (days <= 1.5) {
    return "1-day";
  }

  if (days <= 8) {
    return "7-days";
  }

  if (days <= 31) {
    return "30-days";
  }

  return "custom";
}

export default function ShareChatDialog({
  open,
  chatId,
  chatTitle = "Untitled conversation",
  initialSettings,
  initialShareUrl = null,
  className,
  disabled = false,
  onClose,
  onShare,
  onRevoke,
  onCopy,
}: ShareChatDialogProps) {
  const dialogRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const closeButtonRef =
    useRef<HTMLButtonElement | null>(
      null
    );

  const [settings, setSettings] =
    useState<ShareChatSettings>({
      ...DEFAULT_SETTINGS,
      ...initialSettings,
    });

  const [expiration, setExpiration] =
    useState<ShareExpiration>(
      inferExpiration(
        initialSettings?.expiresAt
      )
    );

  const [customExpiration, setCustomExpiration] =
    useState(
      getLocalDateInputValue(
        initialSettings?.expiresAt
      )
    );

  const [shareUrl, setShareUrl] =
    useState<string | null>(
      initialShareUrl
    );

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [isRevoking, setIsRevoking] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextSettings = {
      ...DEFAULT_SETTINGS,
      ...initialSettings,
    };

    setSettings(nextSettings);

    setExpiration(
      inferExpiration(
        nextSettings.expiresAt
      )
    );

    setCustomExpiration(
      getLocalDateInputValue(
        nextSettings.expiresAt
      )
    );

    setShareUrl(
      initialShareUrl
    );

    setCopied(false);
    setError(null);

    const timeout =
      window.setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 0);

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    open,
    initialSettings,
    initialShareUrl,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape" &&
        !isSubmitting &&
        !isRevoking
      ) {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    open,
    isSubmitting,
    isRevoking,
    onClose,
  ]);

  const isBusy =
    disabled ||
    isSubmitting ||
    isRevoking;

  const computedExpiresAt =
    useMemo(
      () =>
        getExpirationDate(
          expiration,
          customExpiration
            ? new Date(
                customExpiration
              ).toISOString()
            : undefined
        ),
      [
        expiration,
        customExpiration,
      ]
    );

  const effectiveSettings =
    useMemo<ShareChatSettings>(
      () => ({
        ...settings,
        expiresAt:
          computedExpiresAt,
      }),
      [
        settings,
        computedExpiresAt,
      ]
    );

  if (!open) {
    return null;
  }

  const updateAccess = (
    access: ShareAccess
  ) => {
    if (isBusy) {
      return;
    }

    setSettings(
      previous => ({
        ...previous,
        access,
        allowSearchEngines:
          access === "public"
            ? previous.allowSearchEngines
            : false,
      })
    );
  };

  const handleCreateShare = async () => {
    if (isBusy) {
      return;
    }

    if (
      expiration === "custom" &&
      !customExpiration
    ) {
      setError(
        "Please select an expiration date."
      );

      return;
    }

    if (
      expiration === "custom" &&
      computedExpiresAt
    ) {
      const customDate =
        new Date(
          computedExpiresAt
        );

      if (
        customDate.getTime() <=
        Date.now()
      ) {
        setError(
          "Expiration date must be in the future."
        );

        return;
      }
    }

    setError(null);
    setCopied(false);

    try {
      setIsSubmitting(true);

      if (onShare) {
        const result =
          await onShare(
            effectiveSettings
          );

        setShareUrl(
          result.url
        );

        setSettings(
          previous => ({
            ...previous,
            access:
              result.access ??
              previous.access,
            expiresAt:
              result.expiresAt ??
              previous.expiresAt,
          })
        );

        return;
      }

      const fallbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/share/${encodeURIComponent(chatId)}`
          : `/share/${encodeURIComponent(chatId)}`;

      setShareUrl(
        fallbackUrl
      );
    } catch (shareError) {
      console.error(
        "Chat share failed:",
        shareError
      );

      setError(
        "Unable to create the share link. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (
      !shareUrl ||
      isBusy
    ) {
      return;
    }

    try {
      if (onCopy) {
        await onCopy(
          shareUrl
        );
      } else if (
        typeof navigator !==
          "undefined" &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(
          shareUrl
        );
      } else {
        throw new Error(
          "Clipboard API unavailable."
        );
      }

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (copyError) {
      console.error(
        "Chat link copy failed:",
        copyError
      );

      setError(
        "Unable to copy the link."
      );
    }
  };

  const handleRevoke = async () => {
    if (
      !shareUrl ||
      isBusy
    ) {
      return;
    }

    setError(null);

    try {
      setIsRevoking(true);

      await onRevoke?.();

      setShareUrl(null);
      setCopied(false);
    } catch (revokeError) {
      console.error(
        "Chat share revoke failed:",
        revokeError
      );

      setError(
        "Unable to revoke the share link."
      );
    } finally {
      setIsRevoking(false);
    }
  };

  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (
      event.target !== event.currentTarget ||
      isBusy
    ) {
      return;
    }

    onClose();
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center p-4",
        className
      )}
      onMouseDown={
        handleBackdropClick
      }
      aria-hidden={false}
    >
      <div className="absolute inset-0 bg-zinc-950/55 backdrop-blur-sm" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-chat-dialog-title"
        className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-5 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="18"
                    cy="5"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />

                  <circle
                    cx="6"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />

                  <circle
                    cx="18"
                    cy="19"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />

                  <path
                    d="m8.6 10.5 6.8-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  <path
                    d="m8.6 13.5 6.8 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <h2
                  id="share-chat-dialog-title"
                  className="text-lg font-semibold text-zinc-950 dark:text-white"
                >
                  Share conversation
                </h2>

                <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {chatTitle}
                </p>
              </div>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close share dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="2"
                />

                <path
                  d="M12 8v5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                <path
                  d="M12 16h.01"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              <span>{error}</span>
            </div>
          )}

          {shareUrl ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="m5 12 4 4L19 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                      Share link is active
                    </p>

                    <p className="mt-1 text-xs leading-5 text-emerald-700/80 dark:text-emerald-300/80">
                      Access is currently set to{" "}
                      {getAccessLabel(
                        settings.access
                      )}
                      .
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  Share link
                </label>

                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy()
                    }
                    disabled={isBusy}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    {copied ? (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="m5 12 4 4L19 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>

                        Copied
                      </>
                    ) : (
                      "Copy"
                    )}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-400">
                    Access
                  </p>

                  <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                    {getAccessLabel(
                      settings.access
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-400">
                    Expiration
                  </p>

                  <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                    {effectiveSettings.expiresAt
                      ? new Date(
                          effectiveSettings.expiresAt
                        ).toLocaleString()
                      : "Never"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:justify-between dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() =>
                    void handleRevoke()
                  }
                  disabled={isBusy}
                  className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-950/20"
                >
                  {isRevoking
                    ? "Revoking..."
                    : "Revoke link"}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isBusy}
                  className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <section>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Who can access?
                  </h3>

                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Choose how this conversation can be accessed.
                  </p>
                </div>

                <div className="space-y-2">
                  {(
                    [
                      "private",
                      "unlisted",
                      "public",
                    ] as ShareAccess[]
                  ).map(
                    access => {
                      const active =
                        settings.access ===
                        access;

                      return (
                        <button
                          key={access}
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            updateAccess(
                              access
                            )
                          }
                          className={cn(
                            "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            active
                              ? "border-violet-500/40 bg-violet-500/5"
                              : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                              active
                                ? "border-violet-600"
                                : "border-zinc-300 dark:border-zinc-700"
                            )}
                          >
                            {active && (
                              <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                            )}
                          </span>

                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                              {getAccessLabel(
                                access
                              )}
                            </span>

                            <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                              {getAccessDescription(
                                access
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </section>

              {settings.access !==
                "private" && (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Link expiration
                    </h3>

                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Control how long the share link remains active.
                    </p>
                  </div>

                  <select
                    value={expiration}
                    disabled={isBusy}
                    onChange={event =>
                      setExpiration(
                        event.target
                          .value as ShareExpiration
                      )
                    }
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none transition focus:border-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <option value="never">
                      Never expires
                    </option>

                    <option value="1-day">
                      1 day
                    </option>

                    <option value="7-days">
                      7 days
                    </option>

                    <option value="30-days">
                      30 days
                    </option>

                    <option value="custom">
                      Custom date
                    </option>
                  </select>

                  {expiration ===
                    "custom" && (
                    <input
                      type="datetime-local"
                      value={
                        customExpiration
                      }
                      min={
                        getLocalDateInputValue(
                          new Date().toISOString()
                        )
                      }
                      disabled={isBusy}
                      onChange={event =>
                        setCustomExpiration(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none transition focus:border-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  )}
                </section>
              )}

              {settings.access ===
                "public" && (
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                        Search engine visibility
                      </p>

                      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        Allow this shared conversation to be discoverable by search engines.
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={
                        settings.allowSearchEngines
                      }
                      disabled={isBusy}
                      onClick={() =>
                        setSettings(
                          previous => ({
                            ...previous,
                            allowSearchEngines:
                              !previous.allowSearchEngines,
                          })
                        )
                      }
                      className={cn(
                        "relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
                        settings.allowSearchEngines
                          ? "bg-violet-600"
                          : "bg-zinc-200 dark:bg-zinc-800"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                          settings.allowSearchEngines
                            ? "translate-x-6"
                            : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </section>
              )}

              {settings.access !==
                "private" && (
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                        Allow copying
                      </p>

                      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        Allow viewers to copy the conversation content.
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={
                        settings.allowCopy
                      }
                      disabled={isBusy}
                      onClick={() =>
                        setSettings(
                          previous => ({
                            ...previous,
                            allowCopy:
                              !previous.allowCopy,
                          })
                        )
                      }
                      className={cn(
                        "relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
                        settings.allowCopy
                          ? "bg-violet-600"
                          : "bg-zinc-200 dark:bg-zinc-800"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                          settings.allowCopy
                            ? "translate-x-6"
                            : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </section>
              )}

              {settings.access ===
                "private" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  Private conversations cannot generate an external share link.
                </div>
              ) : (
                <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isBusy}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void handleCreateShare()
                    }
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray="40"
                            strokeLinecap="round"
                          />
                        </svg>

                        Creating...
                      </>
                    ) : (
                      "Create share link"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}