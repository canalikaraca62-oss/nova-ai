"use client";

import {
  Activity,
  Bot,
  Check,
  Command,
  FileText,
  FolderKanban,
  Keyboard,
  LayoutDashboard,
  MessageSquare,
  Mic,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type CommandPaletteItem = {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  group?: string;
  shortcut?: string[];
  href?: string;
  icon?: React.ReactNode;
  action?: () => void | Promise<void>;
  disabled?: boolean;
};

type CommandPaletteProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  commands?: CommandPaletteItem[];
  className?: string;
  placeholder?: string;
  enableGlobalShortcut?: boolean;
};

type SearchResult = {
  command: CommandPaletteItem;
  score: number;
};

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase()
    .trim();
}

function getCommandScore(
  query: string,
  command: CommandPaletteItem
) {
  const normalizedQuery =
    normalizeText(query);

  if (!normalizedQuery) {
    return 1;
  }

  const searchableText = [
    command.title,
    command.description ?? "",
    ...(command.keywords ?? []),
    command.group ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase();

  if (
    searchableText.includes(
      normalizedQuery
    )
  ) {
    const title =
      command.title.toLocaleLowerCase();

    if (
      title === normalizedQuery
    ) {
      return 1000;
    }

    if (
      title.startsWith(
        normalizedQuery
      )
    ) {
      return 900;
    }

    return 700;
  }

  let queryIndex = 0;
  let score = 0;
  let consecutive = 0;

  for (
    let index = 0;
    index < searchableText.length;
    index += 1
  ) {
    if (
      searchableText[index] ===
      normalizedQuery[queryIndex]
    ) {
      consecutive += 1;

      score +=
        10 + consecutive * 4;

      queryIndex += 1;

      if (
        queryIndex ===
        normalizedQuery.length
      ) {
        return score;
      }
    } else {
      consecutive = 0;
    }
  }

  return 0;
}

function isTypingElement(
  target: EventTarget | null
) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName =
    target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    target.isContentEditable
  );
}

function createDefaultCommands(): CommandPaletteItem[] {
  return [
    {
      id: "new-chat",
      title: "New chat",
      description:
        "Start a new AI conversation",
      group: "Create",
      keywords: [
        "chat",
        "conversation",
        "message",
        "new",
      ],
      href: "/chat",
      shortcut: ["⌘", "N"],
      icon: (
        <MessageSquare className="h-4 w-4" />
      ),
    },
    {
      id: "new-project",
      title: "New project",
      description:
        "Create and organize a new project",
      group: "Create",
      keywords: [
        "project",
        "workspace",
        "create",
      ],
      href: "/projects",
      icon: (
        <Plus className="h-4 w-4" />
      ),
    },
    {
      id: "agents",
      title: "Open agents",
      description:
        "Build and manage AI agents",
      group: "Workspace",
      keywords: [
        "agents",
        "agent",
        "automation",
        "ai",
      ],
      href: "/agents",
      icon: (
        <Bot className="h-4 w-4" />
      ),
    },
    {
      id: "canvas",
      title: "Open canvas",
      description:
        "Create, plan and visualize ideas",
      group: "Workspace",
      keywords: [
        "canvas",
        "whiteboard",
        "diagram",
        "visual",
      ],
      href: "/canvas",
      icon: (
        <PanelLeft className="h-4 w-4" />
      ),
    },
    {
      id: "knowledge",
      title: "Knowledge base",
      description:
        "Search documents and connected knowledge",
      group: "Workspace",
      keywords: [
        "knowledge",
        "documents",
        "files",
        "search",
      ],
      href: "/knowledge",
      icon: (
        <FileText className="h-4 w-4" />
      ),
    },
    {
      id: "projects",
      title: "Projects",
      description:
        "Open your project workspace",
      group: "Navigate",
      keywords: [
        "projects",
        "workspace",
      ],
      href: "/projects",
      icon: (
        <FolderKanban className="h-4 w-4" />
      ),
    },
    {
      id: "activity",
      title: "Activity",
      description:
        "View recent workspace activity",
      group: "Navigate",
      keywords: [
        "activity",
        "history",
        "events",
      ],
      href: "/activity",
      icon: (
        <Activity className="h-4 w-4" />
      ),
    },
    {
      id: "dashboard",
      title: "Dashboard",
      description:
        "Return to your main workspace",
      group: "Navigate",
      keywords: [
        "home",
        "dashboard",
        "workspace",
      ],
      href: "/apps",
      icon: (
        <LayoutDashboard className="h-4 w-4" />
      ),
    },
    {
      id: "voice",
      title: "Voice chat",
      description:
        "Start a voice conversation",
      group: "AI",
      keywords: [
        "voice",
        "microphone",
        "speak",
        "audio",
      ],
      href: "/chat",
      icon: (
        <Mic className="h-4 w-4" />
      ),
    },
    {
      id: "search",
      title: "Universal search",
      description:
        "Search across your workspace",
      group: "AI",
      keywords: [
        "search",
        "find",
        "lookup",
      ],
      href: "/search",
      shortcut: ["⌘", "K"],
      icon: (
        <Search className="h-4 w-4" />
      ),
    },
    {
      id: "settings",
      title: "Settings",
      description:
        "Manage your workspace preferences",
      group: "System",
      keywords: [
        "settings",
        "preferences",
        "configuration",
      ],
      href: "/settings",
      icon: (
        <Settings className="h-4 w-4" />
      ),
    },
  ];
}

export default function CommandPalette({
  open,
  defaultOpen = false,
  onOpenChange,
  commands,
  className = "",
  placeholder = "Search commands, pages and actions...",
  enableGlobalShortcut = true,
}: CommandPaletteProps) {
  const router = useRouter();

  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const [internalOpen, setInternalOpen] =
    useState(defaultOpen);

  const [query, setQuery] =
    useState("");

  const [selectedIndex, setSelectedIndex] =
    useState(0);

  const [isExecuting, setIsExecuting] =
    useState(false);

  const listboxId = useId();

  const isControlled =
    typeof open === "boolean";

  const isOpen =
    isControlled
      ? open
      : internalOpen;

  const allCommands = useMemo(
    () =>
      commands && commands.length > 0
        ? commands
        : createDefaultCommands(),
    [commands]
  );

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [
      isControlled,
      onOpenChange,
    ]
  );

  const results = useMemo(() => {
    const nextResults: SearchResult[] =
      allCommands
        .filter(
          (command) =>
            !command.disabled
        )
        .map((command) => ({
          command,
          score: getCommandScore(
            query,
            command
          ),
        }))
        .filter(
          (result) =>
            result.score > 0
        )
        .sort(
          (first, second) =>
            second.score - first.score
        );

    return nextResults;
  }, [
    allCommands,
    query,
  ]);

  const groupedResults = useMemo(() => {
    const groups = new Map<
      string,
      SearchResult[]
    >();

    for (
      const result of results
    ) {
      const group =
        result.command.group ??
        "Commands";

      const current =
        groups.get(group) ?? [];

      current.push(result);

      groups.set(
        group,
        current
      );
    }

    return Array.from(
      groups.entries()
    );
  }, [results]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, [setOpen]);

  const executeCommand = useCallback(
    async (
      command: CommandPaletteItem
    ) => {
      if (
        command.disabled ||
        isExecuting
      ) {
        return;
      }

      try {
        setIsExecuting(true);

        if (command.action) {
          await command.action();
        }

        if (command.href) {
          router.push(command.href);
        }

        closePalette();
      } catch (error) {
        console.error(
          "COMMAND EXECUTION ERROR:",
          error
        );
      } finally {
        setIsExecuting(false);
      }
    },
    [
      closePalette,
      isExecuting,
      router,
    ]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeout =
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 30);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!enableGlobalShortcut) {
      return;
    }

    const handleGlobalKeyDown = (
      event: KeyboardEvent
    ) => {
      const key =
        event.key.toLowerCase();

      if (
        (event.metaKey ||
          event.ctrlKey) &&
        key === "k"
      ) {
        event.preventDefault();

        if (isOpen) {
          closePalette();
        } else {
          setOpen(true);
        }

        return;
      }

      if (
        !isOpen &&
        !isTypingElement(event.target) &&
        event.key === "/"
      ) {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener(
      "keydown",
      handleGlobalKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleGlobalKeyDown
      );
    };
  }, [
    closePalette,
    enableGlobalShortcut,
    isOpen,
    setOpen,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape"
      ) {
        event.preventDefault();
        closePalette();
        return;
      }

      if (
        results.length === 0
      ) {
        return;
      }

      if (
        event.key === "ArrowDown"
      ) {
        event.preventDefault();

        setSelectedIndex(
          (current) =>
            (current + 1) %
            results.length
        );

        return;
      }

      if (
        event.key === "ArrowUp"
      ) {
        event.preventDefault();

        setSelectedIndex(
          (current) =>
            (current -
              1 +
              results.length) %
            results.length
        );

        return;
      }

      if (
        event.key === "Enter"
      ) {
        event.preventDefault();

        const selected =
          results[selectedIndex];

        if (selected) {
          void executeCommand(
            selected.command
          );
        }
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    closePalette,
    executeCommand,
    isOpen,
    results,
    selectedIndex,
  ]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className={[
          "inline-flex items-center gap-2",
          "rounded-xl border border-white/10",
          "bg-background/70 px-3 py-2",
          "text-sm text-muted-foreground",
          "transition-colors",
          "hover:border-white/20",
          "hover:bg-muted/60",
          className,
        ].join(" ")}
        aria-label="Open command palette"
      >
        <Command className="h-4 w-4" />

        <span className="hidden sm:inline">
          Command
        </span>

        <kbd className="hidden rounded border border-white/10 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘ K
        </kbd>
      </button>
    );
  }

  let flatIndex = -1;

  return (
    <div
      className={[
        "fixed inset-0 z-[100]",
        "flex items-start justify-center",
        "bg-black/60 px-4 pt-[10vh]",
        "backdrop-blur-sm",
        className,
      ].join(" ")}
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          closePalette();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={[
          "w-full max-w-2xl overflow-hidden",
          "rounded-2xl border border-white/10",
          "bg-background shadow-2xl",
          "ring-1 ring-black/20",
        ].join(" ")}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />

          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(
                event.target.value
              );
            }}
            placeholder={placeholder}
            className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={
              results[selectedIndex]
                ? `command-item-${results[selectedIndex].command.id}`
                : undefined
            }
          />

          <button
            type="button"
            onClick={closePalette}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          id={listboxId}
          role="listbox"
          className="max-h-[min(65vh,600px)] overflow-y-auto p-2"
        >
          {groupedResults.length > 0 ? (
            groupedResults.map(
              ([group, groupResults]) => (
                <div
                  key={group}
                  className="mb-3 last:mb-0"
                >
                  <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {group}
                  </div>

                  <div className="space-y-1">
                    {groupResults.map(
                      ({ command }) => {
                        flatIndex += 1;

                        const currentIndex =
                          flatIndex;

                        const isSelected =
                          currentIndex ===
                          selectedIndex;

                        return (
                          <button
                            key={command.id}
                            id={`command-item-${command.id}`}
                            type="button"
                            role="option"
                            aria-selected={
                              isSelected
                            }
                            onMouseEnter={() => {
                              setSelectedIndex(
                                currentIndex
                              );
                            }}
                            onClick={() => {
                              void executeCommand(
                                command
                              );
                            }}
                            disabled={
                              command.disabled ||
                              isExecuting
                            }
                            className={[
                              "flex w-full items-center gap-3",
                              "rounded-xl px-3 py-3 text-left",
                              "transition-all duration-150",
                              "disabled:cursor-not-allowed",
                              "disabled:opacity-50",
                              isSelected
                                ? [
                                    "bg-primary",
                                    "text-primary-foreground",
                                    "shadow-sm",
                                  ].join(" ")
                                : [
                                    "text-foreground",
                                    "hover:bg-muted/70",
                                  ].join(" "),
                            ].join(" ")}
                          >
                            <div
                              className={[
                                "flex h-9 w-9 shrink-0",
                                "items-center justify-center",
                                "rounded-lg border",
                                isSelected
                                  ? [
                                      "border-primary-foreground/20",
                                      "bg-primary-foreground/10",
                                    ].join(" ")
                                  : [
                                      "border-white/10",
                                      "bg-muted/50",
                                      "text-muted-foreground",
                                    ].join(" "),
                              ].join(" ")}
                            >
                              {command.icon ?? (
                                <Sparkles className="h-4 w-4" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {command.title}
                                </span>

                                {isSelected ? (
                                  <Check className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                ) : null}
                              </div>

                              {command.description ? (
                                <p
                                  className={[
                                    "mt-0.5 truncate text-xs",
                                    isSelected
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground",
                                  ].join(" ")}
                                >
                                  {command.description}
                                </p>
                              ) : null}
                            </div>

                            {command.shortcut?.length ? (
                              <div className="flex shrink-0 items-center gap-1">
                                {command.shortcut.map(
                                  (
                                    key,
                                    shortcutIndex
                                  ) => (
                                    <kbd
                                      key={`${command.id}-${shortcutIndex}`}
                                      className={[
                                        "rounded border px-1.5 py-0.5",
                                        "text-[10px] font-medium",
                                        isSelected
                                          ? [
                                              "border-primary-foreground/20",
                                              "bg-primary-foreground/10",
                                              "text-primary-foreground/80",
                                            ].join(
                                              " "
                                            )
                                          : [
                                              "border-white/10",
                                              "bg-muted/60",
                                              "text-muted-foreground",
                                            ].join(
                                              " "
                                            ),
                                      ].join(" ")}
                                    >
                                      {key}
                                    </kbd>
                                  )
                                )}
                              </div>
                            ) : null}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )
            )
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-muted/40">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>

              <p className="text-sm font-medium">
                No commands found
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Try another search term.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5" />

              Navigate
            </span>

            <span className="hidden sm:inline">
              ↑ ↓ Select
            </span>

            <span className="hidden sm:inline">
              ↵ Open
            </span>
          </div>

          <span>
            ESC Close
          </span>
        </div>
      </div>
    </div>
  );
}

export type {
  CommandPaletteItem,
  CommandPaletteProps,
};