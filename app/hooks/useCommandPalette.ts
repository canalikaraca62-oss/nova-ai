"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface CommandPaletteItem {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  shortcut?: string;
  group?: string;
  disabled?: boolean;
  action?: () => void | Promise<void>;
}

export interface UseCommandPaletteOptions {
  initialOpen?: boolean;
  commands?: CommandPaletteItem[];
  enableGlobalShortcut?: boolean;
}

export interface UseCommandPaletteReturn {
  isOpen: boolean;
  query: string;
  selectedIndex: number;

  commands: CommandPaletteItem[];
  filteredCommands: CommandPaletteItem[];
  selectedCommand: CommandPaletteItem | null;

  open: () => void;
  close: () => void;
  toggle: () => void;

  setQuery: (query: string) => void;

  setCommands: (
    commands: CommandPaletteItem[]
  ) => void;

  registerCommand: (
    command: CommandPaletteItem
  ) => void;

  unregisterCommand: (
    commandId: string
  ) => void;

  clearCommands: () => void;

  selectNext: () => void;
  selectPrevious: () => void;

  selectCommand: (
    command: CommandPaletteItem
  ) => void;

  executeSelected: () => Promise<void>;
  executeCommand: (
    command: CommandPaletteItem
  ) => Promise<void>;
}

function normalizeText(
  value: string
): string {
  return value
    .trim()
    .toLocaleLowerCase();
}

function commandMatchesQuery(
  command: CommandPaletteItem,
  query: string
): boolean {
  if (!query) {
    return true;
  }

  const searchableValues = [
    command.title,
    command.description ?? "",
    command.group ?? "",
    ...(command.keywords ?? []),
  ];

  return searchableValues.some(
    (value) =>
      normalizeText(value).includes(
        normalizeText(query)
      )
  );
}

export function useCommandPalette(
  options: UseCommandPaletteOptions = {}
): UseCommandPaletteReturn {
  const {
    initialOpen = false,
    commands: initialCommands = [],
    enableGlobalShortcut = true,
  } = options;

  const [isOpen, setIsOpen] =
    useState(initialOpen);

  const [query, setQueryState] =
    useState("");

  const [commands, setCommands] =
    useState<CommandPaletteItem[]>(
      initialCommands
    );

  const [selectedIndex, setSelectedIndex] =
    useState(0);

  const commandsRef =
    useRef(commands);

  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  const filteredCommands = useMemo(() => {
    return commands.filter(
      (command) =>
        !command.disabled &&
        commandMatchesQuery(
          command,
          query
        )
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex((currentIndex) => {
      if (
        filteredCommands.length === 0
      ) {
        return 0;
      }

      if (
        currentIndex >=
        filteredCommands.length
      ) {
        return 0;
      }

      return currentIndex;
    });
  }, [filteredCommands.length]);

  const selectedCommand =
    filteredCommands[
      selectedIndex
    ] ?? null;

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState("");
    setSelectedIndex(0);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((current) => {
      if (current) {
        setQueryState("");
        setSelectedIndex(0);
      }

      return !current;
    });
  }, []);

  const setQuery = useCallback(
    (nextQuery: string) => {
      setQueryState(nextQuery);
      setSelectedIndex(0);
    },
    []
  );

  const registerCommand = useCallback(
    (command: CommandPaletteItem) => {
      setCommands((currentCommands) => {
        const existingIndex =
          currentCommands.findIndex(
            (item) =>
              item.id === command.id
          );

        if (existingIndex === -1) {
          return [
            ...currentCommands,
            command,
          ];
        }

        const nextCommands = [
          ...currentCommands,
        ];

        nextCommands[
          existingIndex
        ] = command;

        return nextCommands;
      });
    },
    []
  );

  const unregisterCommand =
    useCallback(
      (commandId: string) => {
        setCommands(
          (currentCommands) =>
            currentCommands.filter(
              (command) =>
                command.id !==
                commandId
            )
        );
      },
      []
    );

  const clearCommands =
    useCallback(() => {
      setCommands([]);
      setSelectedIndex(0);
    }, []);

  const selectNext = useCallback(() => {
    setSelectedIndex(
      (currentIndex) => {
        if (
          filteredCommands.length === 0
        ) {
          return 0;
        }

        return (
          (currentIndex + 1) %
          filteredCommands.length
        );
      }
    );
  }, [filteredCommands.length]);

  const selectPrevious =
    useCallback(() => {
      setSelectedIndex(
        (currentIndex) => {
          if (
            filteredCommands.length ===
            0
          ) {
            return 0;
          }

          return (
            (currentIndex -
              1 +
              filteredCommands.length) %
            filteredCommands.length
          );
        }
      );
    }, [filteredCommands.length]);

  const executeCommand =
    useCallback(
      async (
        command: CommandPaletteItem
      ) => {
        if (command.disabled) {
          return;
        }

        if (
          typeof command.action ===
          "function"
        ) {
          await command.action();
        }

        close();
      },
      [close]
    );

  const selectCommand =
    useCallback(
      (
        command: CommandPaletteItem
      ) => {
        const index =
          filteredCommands.findIndex(
            (item) =>
              item.id === command.id
          );

        if (index !== -1) {
          setSelectedIndex(index);
        }
      },
      [filteredCommands]
    );

  const executeSelected =
    useCallback(async () => {
      if (!selectedCommand) {
        return;
      }

      await executeCommand(
        selectedCommand
      );
    }, [
      selectedCommand,
      executeCommand,
    ]);

  useEffect(() => {
    if (!enableGlobalShortcut) {
      return;
    }

    const handleKeyDown = (
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

        setIsOpen((current) => {
          if (current) {
            setQueryState("");
            setSelectedIndex(0);
          }

          return !current;
        });

        return;
      }

      if (!isOpen) {
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        close();
        return;
      }

      if (key === "arrowdown") {
        event.preventDefault();
        selectNext();
        return;
      }

      if (key === "arrowup") {
        event.preventDefault();
        selectPrevious();
        return;
      }

      if (key === "enter") {
        event.preventDefault();

        const command =
          filteredCommands[
            selectedIndex
          ];

        if (command) {
          void executeCommand(
            command
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
    enableGlobalShortcut,
    isOpen,
    close,
    selectNext,
    selectPrevious,
    filteredCommands,
    selectedIndex,
    executeCommand,
  ]);

  return {
    isOpen,
    query,
    selectedIndex,

    commands,
    filteredCommands,
    selectedCommand,

    open,
    close,
    toggle,

    setQuery,

    setCommands,

    registerCommand,
    unregisterCommand,
    clearCommands,

    selectNext,
    selectPrevious,

    selectCommand,

    executeSelected,
    executeCommand,
  };
}

export default useCommandPalette;