"use client";

import React, {
  useEffect,
  useState,
} from "react";

export type ChatSettingsValue = {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  webSearchEnabled: boolean;
  memoryEnabled: boolean;
  streamingEnabled: boolean;
};

export type ChatSettingsProps = {
  value?: Partial<ChatSettingsValue>;

  defaultValue?: Partial<ChatSettingsValue>;

  disabled?: boolean;

  isSaving?: boolean;

  className?: string;

  availableModels?: string[];

  onChange?: (
    value: ChatSettingsValue
  ) => void;

  onSave?: (
    value: ChatSettingsValue
  ) => void | Promise<void>;

  onReset?: () => void | Promise<void>;
};

const DEFAULT_SETTINGS: ChatSettingsValue = {
  model: "auto",
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: "",
  webSearchEnabled: false,
  memoryEnabled: true,
  streamingEnabled: true,
};

function cn(
  ...classes: Array<
    string | undefined | null | false
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

export default function ChatSettings({
  value,
  defaultValue,
  disabled = false,
  isSaving = false,
  className,

  availableModels = [
    "auto",
    "gpt-4o",
    "gpt-4o-mini",
    "llama-3.3-70b-versatile",
  ],

  onChange,
  onSave,
  onReset,
}: ChatSettingsProps) {
  const initialSettings: ChatSettingsValue = {
    ...DEFAULT_SETTINGS,
    ...defaultValue,
    ...value,
  };

  const [
    settings,
    setSettings,
  ] = useState<ChatSettingsValue>(
    initialSettings
  );

  const [
    localSaving,
    setLocalSaving,
  ] = useState(false);

  useEffect(() => {
    if (!value) {
      return;
    }

    setSettings(previous => ({
      ...previous,
      ...value,
    }));
  }, [value]);

  const updateSettings = (
    patch: Partial<ChatSettingsValue>
  ) => {
    setSettings(previous => {
      const next = {
        ...previous,
        ...patch,
      };

      onChange?.(next);

      return next;
    });
  };

  const handleSave = async () => {
    if (
      disabled ||
      isSaving ||
      localSaving
    ) {
      return;
    }

    try {
      setLocalSaving(true);

      await onSave?.(
        settings
      );
    } catch (error) {
      console.error(
        "Chat settings save failed:",
        error
      );
    } finally {
      setLocalSaving(false);
    }
  };

  const handleReset = async () => {
    if (
      disabled ||
      isSaving ||
      localSaving
    ) {
      return;
    }

    const nextSettings = {
      ...DEFAULT_SETTINGS,
      ...defaultValue,
    };

    setSettings(
      nextSettings
    );

    onChange?.(
      nextSettings
    );

    try {
      await onReset?.();
    } catch (error) {
      console.error(
        "Chat settings reset failed:",
        error
      );
    }
  };

  const saving =
    isSaving || localSaving;

  return (
    <section
      className={cn(
        "w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
    >
      {/* HEADER */}

      <div className="border-b border-zinc-200 px-5 py-5 dark:border-zinc-800 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white">
              Chat settings
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Control how the AI responds in
              this conversation.
            </p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />

              <path
                d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56v.08h-3v-.08A1.7 1.7 0 0 0 10.66 18.7a1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15.04a1.7 1.7 0 0 0-1.56-1.04h-.08v-3h.08A1.7 1.7 0 0 0 7 9.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.72 5.9l.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.7 4.74v-.08h3v.08A1.7 1.7 0 0 0 15.74 6.3a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.56 1.04h.08v3h-.08A1.7 1.7 0 0 0 19.4 15Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-5 sm:p-6">
        {/* MODEL */}

        <div>
          <div className="mb-3">
            <label className="text-sm font-semibold text-zinc-900 dark:text-white">
              AI model
            </label>

            <p className="mt-1 text-xs text-zinc-500">
              Choose the model used for this
              conversation.
            </p>
          </div>

          <select
            value={settings.model}
            disabled={
              disabled || saving
            }
            onChange={event =>
              updateSettings({
                model:
                  event.target.value,
              })
            }
            className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          >
            {availableModels.map(
              model => (
                <option
                  key={model}
                  value={model}
                >
                  {model === "auto"
                    ? "Auto select"
                    : model}
                </option>
              )
            )}
          </select>
        </div>

        {/* TEMPERATURE */}

        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <label className="text-sm font-semibold text-zinc-900 dark:text-white">
                Creativity
              </label>

              <p className="mt-1 text-xs text-zinc-500">
                Lower values are more focused.
                Higher values are more creative.
              </p>
            </div>

            <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-bold tabular-nums text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {settings.temperature.toFixed(
                1
              )}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.temperature}
            disabled={
              disabled || saving
            }
            onChange={event =>
              updateSettings({
                temperature: clamp(
                  Number(
                    event.target.value
                  ),
                  0,
                  2
                ),
              })
            }
            className="mt-4 h-2 w-full cursor-pointer accent-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            <span>Focused</span>
            <span>Balanced</span>
            <span>Creative</span>
          </div>
        </div>

        {/* MAX TOKENS */}

        <div>
          <div className="mb-3">
            <label className="text-sm font-semibold text-zinc-900 dark:text-white">
              Maximum response length
            </label>

            <p className="mt-1 text-xs text-zinc-500">
              Limits the maximum size of an AI
              response.
            </p>
          </div>

          <input
            type="number"
            min="256"
            max="128000"
            step="256"
            value={settings.maxTokens}
            disabled={
              disabled || saving
            }
            onChange={event =>
              updateSettings({
                maxTokens: clamp(
                  Number(
                    event.target.value
                  ) || 256,
                  256,
                  128000
                ),
              })
            }
            className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          />
        </div>

        {/* SYSTEM PROMPT */}

        <div>
          <div className="mb-3">
            <label className="text-sm font-semibold text-zinc-900 dark:text-white">
              Custom instructions
            </label>

            <p className="mt-1 text-xs text-zinc-500">
              Define behavior, tone, rules, or
              additional context for the AI.
            </p>
          </div>

          <textarea
            value={settings.systemPrompt}
            disabled={
              disabled || saving
            }
            onChange={event =>
              updateSettings({
                systemPrompt:
                  event.target.value,
              })
            }
            placeholder="Example: Be concise, explain complex concepts clearly, and always provide actionable next steps."
            rows={6}
            className="w-full resize-y rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          />
        </div>

        {/* CAPABILITIES */}

        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Capabilities
            </h3>

            <p className="mt-1 text-xs text-zinc-500">
              Enable advanced conversation
              features.
            </p>
          </div>

          <SettingToggle
            title="Web search"
            description="Allow the AI to use web-connected search results when available."
            checked={
              settings.webSearchEnabled
            }
            disabled={
              disabled || saving
            }
            onChange={checked =>
              updateSettings({
                webSearchEnabled:
                  checked,
              })
            }
          />

          <SettingToggle
            title="Conversation memory"
            description="Allow relevant context and preferences to be retained during the conversation."
            checked={
              settings.memoryEnabled
            }
            disabled={
              disabled || saving
            }
            onChange={checked =>
              updateSettings({
                memoryEnabled:
                  checked,
              })
            }
          />

          <SettingToggle
            title="Stream responses"
            description="Display the response progressively as it is generated."
            checked={
              settings.streamingEnabled
            }
            disabled={
              disabled || saving
            }
            onChange={checked =>
              updateSettings({
                streamingEnabled:
                  checked,
              })
            }
            last
          />
        </div>
      </div>

      {/* FOOTER */}

      <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <button
          type="button"
          disabled={
            disabled || saving
          }
          onClick={() =>
            void handleReset()
          }
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
        >
          Reset settings
        </button>

        <button
          type="button"
          disabled={
            disabled || saving
          }
          onClick={() =>
            void handleSave()
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Saving...
            </>
          ) : (
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

              Save settings
            </>
          )}
        </button>
      </div>
    </section>
  );
}

type SettingToggleProps = {
  title: string;

  description: string;

  checked: boolean;

  disabled?: boolean;

  last?: boolean;

  onChange: (
    checked: boolean
  ) => void;
};

function SettingToggle({
  title,
  description,
  checked,
  disabled = false,
  last = false,
  onChange,
}: SettingToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-5 px-4 py-4",
        !last &&
          "border-b border-zinc-200 dark:border-zinc-800"
      )}
    >
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
          {title}
        </h4>

        <p className="mt-1 text-xs leading-5 text-zinc-500">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() =>
          onChange(!checked)
        }
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
          checked
            ? "bg-violet-600"
            : "bg-zinc-200 dark:bg-zinc-800"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked
              ? "translate-x-6"
              : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}