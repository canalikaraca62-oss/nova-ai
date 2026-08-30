"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "light" | "dark" | "system";

export interface AppContextValue {
  theme: ThemeMode;

  resolvedTheme: "light" | "dark";

  sidebarOpen: boolean;

  sidebarCollapsed: boolean;

  mobileNavOpen: boolean;

  commandPaletteOpen: boolean;

  isHydrated: boolean;

  setTheme: (theme: ThemeMode) => void;

  toggleTheme: () => void;

  setSidebarOpen: (open: boolean) => void;

  toggleSidebar: () => void;

  setSidebarCollapsed: (collapsed: boolean) => void;

  toggleSidebarCollapsed: () => void;

  setMobileNavOpen: (open: boolean) => void;

  toggleMobileNav: () => void;

  setCommandPaletteOpen: (open: boolean) => void;

  toggleCommandPalette: () => void;

  closeOverlays: () => void;
}

export interface AppProviderProps {
  children: React.ReactNode;

  defaultTheme?: ThemeMode;

  defaultSidebarOpen?: boolean;

  defaultSidebarCollapsed?: boolean;
}

const AppContext = createContext<AppContextValue | undefined>(
  undefined
);

const THEME_STORAGE_KEY = "syraven-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches
    ? "dark"
    : "light";
}

function resolveTheme(
  theme: ThemeMode
): "light" | "dark" {
  if (theme === "system") {
    return getSystemTheme();
  }

  return theme;
}

export function AppProvider({
  children,
  defaultTheme = "system",
  defaultSidebarOpen = true,
  defaultSidebarCollapsed = false,
}: AppProviderProps): React.ReactElement {
  const [theme, setThemeState] = useState<ThemeMode>(
    defaultTheme
  );

  const [resolvedTheme, setResolvedTheme] = useState<
    "light" | "dark"
  >("dark");

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    defaultSidebarOpen
  );

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState<boolean>(defaultSidebarCollapsed);

  const [mobileNavOpen, setMobileNavOpen] =
    useState<boolean>(false);

  const [commandPaletteOpen, setCommandPaletteOpen] =
    useState<boolean>(false);

  const [isHydrated, setIsHydrated] =
    useState<boolean>(false);

  const applyTheme = useCallback(
    (nextTheme: ThemeMode): void => {
      const nextResolvedTheme =
        resolveTheme(nextTheme);

      setThemeState(nextTheme);
      setResolvedTheme(nextResolvedTheme);

      if (typeof window !== "undefined") {
        document.documentElement.classList.toggle(
          "dark",
          nextResolvedTheme === "dark"
        );

        document.documentElement.style.colorScheme =
          nextResolvedTheme;

        window.localStorage.setItem(
          THEME_STORAGE_KEY,
          nextTheme
        );
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTheme =
      window.localStorage.getItem(
        THEME_STORAGE_KEY
      ) as ThemeMode | null;

    const initialTheme =
      storedTheme === "light" ||
      storedTheme === "dark" ||
      storedTheme === "system"
        ? storedTheme
        : defaultTheme;

    applyTheme(initialTheme);

    setIsHydrated(true);
  }, [applyTheme, defaultTheme]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      theme !== "system"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const handleChange = (
      event: MediaQueryListEvent
    ): void => {
      const nextResolvedTheme = event.matches
        ? "dark"
        : "light";

      setResolvedTheme(nextResolvedTheme);

      document.documentElement.classList.toggle(
        "dark",
        nextResolvedTheme === "dark"
      );

      document.documentElement.style.colorScheme =
        nextResolvedTheme;
    };

    mediaQuery.addEventListener(
      "change",
      handleChange
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleChange
      );
    };
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ): void => {
      const isCommandShortcut =
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k";

      if (isCommandShortcut) {
        event.preventDefault();

        setCommandPaletteOpen(
          (current) => !current
        );
      }

      if (event.key === "Escape") {
        setMobileNavOpen(false);
        setCommandPaletteOpen(false);
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
  }, []);

  const setTheme = useCallback(
    (nextTheme: ThemeMode): void => {
      applyTheme(nextTheme);
    },
    [applyTheme]
  );

  const toggleTheme = useCallback((): void => {
    setThemeState((currentTheme) => {
      const currentResolvedTheme =
        resolveTheme(currentTheme);

      const nextTheme =
        currentResolvedTheme === "dark"
          ? "light"
          : "dark";

      const nextResolvedTheme =
        resolveTheme(nextTheme);

      setResolvedTheme(nextResolvedTheme);

      if (typeof window !== "undefined") {
        document.documentElement.classList.toggle(
          "dark",
          nextResolvedTheme === "dark"
        );

        document.documentElement.style.colorScheme =
          nextResolvedTheme;

        window.localStorage.setItem(
          THEME_STORAGE_KEY,
          nextTheme
        );
      }

      return nextTheme;
    });
  }, []);

  const toggleSidebar = useCallback((): void => {
    setSidebarOpen((current) => !current);
  }, []);

  const toggleSidebarCollapsed =
    useCallback((): void => {
      setSidebarCollapsed(
        (current) => !current
      );
    }, []);

  const toggleMobileNav = useCallback((): void => {
    setMobileNavOpen((current) => !current);
  }, []);

  const toggleCommandPalette =
    useCallback((): void => {
      setCommandPaletteOpen(
        (current) => !current
      );
    }, []);

  const closeOverlays = useCallback((): void => {
    setMobileNavOpen(false);
    setCommandPaletteOpen(false);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      theme,
      resolvedTheme,
      sidebarOpen,
      sidebarCollapsed,
      mobileNavOpen,
      commandPaletteOpen,
      isHydrated,
      setTheme,
      toggleTheme,
      setSidebarOpen,
      toggleSidebar,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      setMobileNavOpen,
      toggleMobileNav,
      setCommandPaletteOpen,
      toggleCommandPalette,
      closeOverlays,
    }),
    [
      theme,
      resolvedTheme,
      sidebarOpen,
      sidebarCollapsed,
      mobileNavOpen,
      commandPaletteOpen,
      isHydrated,
      setTheme,
      toggleTheme,
      toggleSidebar,
      toggleSidebarCollapsed,
      toggleMobileNav,
      toggleCommandPalette,
      closeOverlays,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error(
      "useAppContext must be used within an AppProvider"
    );
  }

  return context;
}

export function useApp(): AppContextValue {
  return useAppContext();
}