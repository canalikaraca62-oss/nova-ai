"use client";

import {
  Bell,
  Bot,
  Check,
  ChevronRight,
  CreditCard,
  Globe2,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  Mail,
  Moon,
  Palette,
  Save,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  User,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SettingsSection =
  | "general"
  | "profile"
  | "notifications"
  | "ai"
  | "appearance"
  | "security"
  | "billing";

type ThemeMode = "system" | "light" | "dark";

interface NovaSettings {
  workspaceName: string;
  language: string;
  timezone: string;

  displayName: string;
  email: string;

  emailNotifications: boolean;
  pushNotifications: boolean;
  projectNotifications: boolean;
  marketingNotifications: boolean;
  soundEnabled: boolean;

  aiSuggestions: boolean;
  aiMemory: boolean;
  autoSummaries: boolean;
  proactiveInsights: boolean;

  theme: ThemeMode;
  compactMode: boolean;
  reduceMotion: boolean;

  twoFactorEnabled: boolean;
}

const DEFAULT_SETTINGS: NovaSettings = {
  workspaceName: "NOVA Workspace",
  language: "English",
  timezone: "Europe/Istanbul",

  displayName: "NOVA User",
  email: "",

  emailNotifications: true,
  pushNotifications: true,
  projectNotifications: true,
  marketingNotifications: false,
  soundEnabled: true,

  aiSuggestions: true,
  aiMemory: true,
  autoSummaries: true,
  proactiveInsights: false,

  theme: "system",
  compactMode: false,
  reduceMotion: false,

  twoFactorEnabled: false,
};

const SETTINGS_STORAGE_KEY = "nova-settings";

const NAVIGATION_ITEMS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: "general",
    label: "General",
    description: "Workspace preferences",
    icon: <Globe2 className="h-4 w-4" />,
  },
  {
    id: "profile",
    label: "Profile",
    description: "Personal information",
    icon: <User className="h-4 w-4" />,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts and updates",
    icon: <Bell className="h-4 w-4" />,
  },
  {
    id: "ai",
    label: "AI Preferences",
    description: "NOVA intelligence",
    icon: <Bot className="h-4 w-4" />,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme and interface",
    icon: <Palette className="h-4 w-4" />,
  },
  {
    id: "security",
    label: "Security",
    description: "Account protection",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    id: "billing",
    label: "Billing",
    description: "Plan and subscription",
    icon: <CreditCard className="h-4 w-4" />,
  },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("general");

  const [settings, setSettings] =
    useState<NovaSettings>(DEFAULT_SETTINGS);

  const [savedSettings, setSavedSettings] =
    useState<NovaSettings>(DEFAULT_SETTINGS);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(
        SETTINGS_STORAGE_KEY
      );

      if (storedSettings) {
        const parsedSettings = JSON.parse(
          storedSettings
        ) as Partial<NovaSettings>;

        const nextSettings = {
          ...DEFAULT_SETTINGS,
          ...parsedSettings,
        };

        setSettings(nextSettings);
        setSavedSettings(nextSettings);
      }
    } catch {
      setSettings(DEFAULT_SETTINGS);
      setSavedSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(settings) !==
      JSON.stringify(savedSettings)
    );
  }, [settings, savedSettings]);

  function updateSetting<K extends keyof NovaSettings>(
    key: K,
    value: NovaSettings[K]
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setSaveMessage("");
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveMessage("");

    try {
      await new Promise((resolve) =>
        window.setTimeout(resolve, 500)
      );

      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(settings)
      );

      setSavedSettings(settings);
      setSaveMessage("Settings saved successfully.");
    } catch {
      setSaveMessage(
        "Unable to save your settings. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setSettings(savedSettings);
    setSaveMessage("");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />

            <p className="text-sm text-muted-foreground">
              Loading your settings...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* Header */}
        <header className="flex flex-col gap-5 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              NOVA Workspace
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Settings
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage your workspace, intelligence preferences,
              notifications, appearance and account security.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Discard changes
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save changes
                </>
              )}
            </button>
          </div>
        </header>

        {saveMessage && (
          <div
            className={`mt-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
              saveMessage.includes("successfully")
                ? "border-primary/20 bg-primary/[0.06] text-primary"
                : "border-destructive/20 bg-destructive/[0.06] text-destructive"
            }`}
          >
            <Check className="h-4 w-4" />
            {saveMessage}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Navigation */}
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <nav className="rounded-2xl border border-border bg-card p-2">
              {NAVIGATION_ITEMS.map((item) => {
                const isActive =
                  activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setActiveSection(item.id)
                    }
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isActive
                          ? "bg-primary-foreground/10"
                          : "bg-muted"
                      }`}
                    >
                      {item.icon}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {item.label}
                      </span>

                      <span
                        className={`mt-0.5 block truncate text-xs ${
                          isActive
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>

                    <ChevronRight className="h-4 w-4 opacity-60" />
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <section className="min-w-0">
            {activeSection === "general" && (
              <GeneralSettings
                settings={settings}
                updateSetting={updateSetting}
              />
            )}

            {activeSection === "profile" && (
              <ProfileSettings
                settings={settings}
                updateSetting={updateSetting}
              />
            )}

            {activeSection === "notifications" && (
              <NotificationSettings
                settings={settings}
                updateSetting={updateSetting}
              />
            )}

            {activeSection === "ai" && (
              <AiSettings
                settings={settings}
                updateSetting={updateSetting}
              />
            )}

            {activeSection === "appearance" && (
              <AppearanceSettings
                settings={settings}
                updateSetting={updateSetting}
              />
            )}

            {activeSection === "security" && (
              <SecuritySettings
                settings={settings}
                updateSetting={updateSetting}
              />
            )}

            {activeSection === "billing" && (
              <BillingSettings />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function GeneralSettings({
  settings,
  updateSetting,
}: {
  settings: NovaSettings;
  updateSetting: <K extends keyof NovaSettings>(
    key: K,
    value: NovaSettings[K]
  ) => void;
}) {
  return (
    <SettingsPanel
      icon={<Globe2 className="h-5 w-5" />}
      title="General settings"
      description="Configure the core preferences for your NOVA workspace."
    >
      <div className="grid gap-6">
        <FieldGroup
          label="Workspace name"
          description="This name appears across your projects and workspace."
        >
          <input
            value={settings.workspaceName}
            onChange={(event) =>
              updateSetting(
                "workspaceName",
                event.target.value
              )
            }
            className={inputClassName}
            placeholder="NOVA Workspace"
          />
        </FieldGroup>

        <div className="grid gap-6 md:grid-cols-2">
          <FieldGroup
            label="Language"
            description="Choose your preferred interface language."
          >
            <select
              value={settings.language}
              onChange={(event) =>
                updateSetting(
                  "language",
                  event.target.value
                )
              }
              className={inputClassName}
            >
              <option>English</option>
              <option>Türkçe</option>
              <option>Deutsch</option>
              <option>Français</option>
              <option>Español</option>
            </select>
          </FieldGroup>

          <FieldGroup
            label="Timezone"
            description="Used for projects, activity and schedules."
          >
            <select
              value={settings.timezone}
              onChange={(event) =>
                updateSetting(
                  "timezone",
                  event.target.value
                )
              }
              className={inputClassName}
            >
              <option value="Europe/Istanbul">
                Istanbul (GMT+3)
              </option>

              <option value="Europe/London">
                London (GMT+0)
              </option>

              <option value="Europe/Paris">
                Paris (GMT+1)
              </option>

              <option value="America/New_York">
                New York (GMT-5)
              </option>

              <option value="America/Los_Angeles">
                Los Angeles (GMT-8)
              </option>

              <option value="Asia/Tokyo">
                Tokyo (GMT+9)
              </option>
            </select>
          </FieldGroup>
        </div>
      </div>
    </SettingsPanel>
  );
}

function ProfileSettings({
  settings,
  updateSetting,
}: {
  settings: NovaSettings;
  updateSetting: <K extends keyof NovaSettings>(
    key: K,
    value: NovaSettings[K]
  ) => void;
}) {
  const initials =
    settings.displayName
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "N";

  return (
    <SettingsPanel
      icon={<User className="h-5 w-5" />}
      title="Profile"
      description="Manage your personal identity and account information."
    >
      <div className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
          {initials}
        </div>

        <div>
          <h3 className="font-medium text-foreground">
            Profile identity
          </h3>

          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Your profile identity is used across projects,
            collaboration and workspace activity.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6">
        <FieldGroup
          label="Display name"
          description="This is how other workspace members see you."
        >
          <input
            value={settings.displayName}
            onChange={(event) =>
              updateSetting(
                "displayName",
                event.target.value
              )
            }
            className={inputClassName}
            placeholder="Your name"
          />
        </FieldGroup>

        <FieldGroup
          label="Email address"
          description="Your primary email for account access and security."
        >
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="email"
              value={settings.email}
              onChange={(event) =>
                updateSetting(
                  "email",
                  event.target.value
                )
              }
              className={`${inputClassName} pl-11`}
              placeholder="you@company.com"
            />
          </div>
        </FieldGroup>
      </div>
    </SettingsPanel>
  );
}

function NotificationSettings({
  settings,
  updateSetting,
}: {
  settings: NovaSettings;
  updateSetting: <K extends keyof NovaSettings>(
    key: K,
    value: NovaSettings[K]
  ) => void;
}) {
  return (
    <SettingsPanel
      icon={<Bell className="h-5 w-5" />}
      title="Notifications"
      description="Control how and when NOVA keeps you informed."
    >
      <div className="divide-y divide-border">
        <ToggleRow
          icon={<Mail className="h-5 w-5" />}
          title="Email notifications"
          description="Receive important workspace updates by email."
          checked={settings.emailNotifications}
          onChange={(value) =>
            updateSetting("emailNotifications", value)
          }
        />

        <ToggleRow
          icon={<Smartphone className="h-5 w-5" />}
          title="Push notifications"
          description="Receive real-time updates while using NOVA."
          checked={settings.pushNotifications}
          onChange={(value) =>
            updateSetting("pushNotifications", value)
          }
        />

        <ToggleRow
          icon={<Bell className="h-5 w-5" />}
          title="Project activity"
          description="Get notified when projects you follow are updated."
          checked={settings.projectNotifications}
          onChange={(value) =>
            updateSetting(
              "projectNotifications",
              value
            )
          }
        />

        <ToggleRow
          icon={<Volume2 className="h-5 w-5" />}
          title="Notification sounds"
          description="Play subtle sounds for important notifications."
          checked={settings.soundEnabled}
          onChange={(value) =>
            updateSetting("soundEnabled", value)
          }
        />

        <ToggleRow
          icon={<Sparkles className="h-5 w-5" />}
          title="Product updates"
          description="Receive occasional updates about new NOVA capabilities."
          checked={settings.marketingNotifications}
          onChange={(value) =>
            updateSetting(
              "marketingNotifications",
              value
            )
          }
        />
      </div>
    </SettingsPanel>
  );
}

function AiSettings({
  settings,
  updateSetting,
}: {
  settings: NovaSettings;
  updateSetting: <K extends keyof NovaSettings>(
    key: K,
    value: NovaSettings[K]
  ) => void;
}) {
  return (
    <SettingsPanel
      icon={<Bot className="h-5 w-5" />}
      title="AI preferences"
      description="Control how NOVA intelligence assists your work."
    >
      <div className="mb-8 rounded-2xl border border-primary/15 bg-primary/[0.04] p-5">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>

          <div>
            <h3 className="font-medium text-foreground">
              NOVA Intelligence
            </h3>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              These preferences determine how proactively NOVA can
              analyze your workspace and provide assistance.
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        <ToggleRow
          icon={<Sparkles className="h-5 w-5" />}
          title="AI suggestions"
          description="Allow NOVA to suggest actions and improvements."
          checked={settings.aiSuggestions}
          onChange={(value) =>
            updateSetting("aiSuggestions", value)
          }
        />

        <ToggleRow
          icon={<Bot className="h-5 w-5" />}
          title="Workspace memory"
          description="Allow NOVA to retain useful workspace context."
          checked={settings.aiMemory}
          onChange={(value) =>
            updateSetting("aiMemory", value)
          }
        />

        <ToggleRow
          icon={<Globe2 className="h-5 w-5" />}
          title="Automatic summaries"
          description="Generate intelligent summaries for projects and activity."
          checked={settings.autoSummaries}
          onChange={(value) =>
            updateSetting("autoSummaries", value)
          }
        />

        <ToggleRow
          icon={<Sparkles className="h-5 w-5" />}
          title="Proactive insights"
          description="Allow NOVA to surface important insights before you ask."
          checked={settings.proactiveInsights}
          onChange={(value) =>
            updateSetting("proactiveInsights", value)
          }
        />
      </div>
    </SettingsPanel>
  );
}

function AppearanceSettings({
  settings,
  updateSetting,
}: {
  settings: NovaSettings;
  updateSetting: <K extends keyof NovaSettings>(
    key: K,
    value: NovaSettings[K]
  ) => void;
}) {
  return (
    <SettingsPanel
      icon={<Palette className="h-5 w-5" />}
      title="Appearance"
      description="Customize the NOVA interface for your preferred workflow."
    >
      <div>
        <h3 className="text-sm font-medium text-foreground">
          Theme
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Choose how NOVA should appear on your device.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ThemeOption
            label="System"
            icon={<Laptop className="h-5 w-5" />}
            selected={settings.theme === "system"}
            onClick={() =>
              updateSetting("theme", "system")
            }
          />

          <ThemeOption
            label="Light"
            icon={<Sun className="h-5 w-5" />}
            selected={settings.theme === "light"}
            onClick={() =>
              updateSetting("theme", "light")
            }
          />

          <ThemeOption
            label="Dark"
            icon={<Moon className="h-5 w-5" />}
            selected={settings.theme === "dark"}
            onClick={() =>
              updateSetting("theme", "dark")
            }
          />
        </div>
      </div>

      <div className="mt-8 divide-y divide-border border-t border-border">
        <ToggleRow
          icon={<Laptop className="h-5 w-5" />}
          title="Compact interface"
          description="Reduce spacing to fit more information on screen."
          checked={settings.compactMode}
          onChange={(value) =>
            updateSetting("compactMode", value)
          }
        />

        <ToggleRow
          icon={<Sparkles className="h-5 w-5" />}
          title="Reduce motion"
          description="Minimize non-essential interface animations."
          checked={settings.reduceMotion}
          onChange={(value) =>
            updateSetting("reduceMotion", value)
          }
        />
      </div>
    </SettingsPanel>
  );
}

function SecuritySettings({
  settings,
  updateSetting,
}: {
  settings: NovaSettings;
  updateSetting: <K extends keyof NovaSettings>(
    key: K,
    value: NovaSettings[K]
  ) => void;
}) {
  return (
    <SettingsPanel
      icon={<Shield className="h-5 w-5" />}
      title="Security"
      description="Protect your NOVA account and workspace access."
    >
      <div className="divide-y divide-border">
        <ToggleRow
          icon={<Shield className="h-5 w-5" />}
          title="Two-factor authentication"
          description="Require an additional verification step when signing in."
          checked={settings.twoFactorEnabled}
          onChange={(value) =>
            updateSetting(
              "twoFactorEnabled",
              value
            )
          }
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ActionCard
          icon={<KeyRound className="h-5 w-5" />}
          title="Change password"
          description="Update your account password."
          action="Manage password"
        />

        <ActionCard
          icon={<Smartphone className="h-5 w-5" />}
          title="Active sessions"
          description="Review devices signed into NOVA."
          action="View sessions"
        />
      </div>

      <div className="mt-8 rounded-2xl border border-destructive/20 bg-destructive/[0.04] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium text-destructive">
              Danger zone
            </h3>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Permanently deleting your account cannot be undone.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            Delete account
          </button>
        </div>
      </div>
    </SettingsPanel>
  );
}

function BillingSettings() {
  return (
    <SettingsPanel
      icon={<CreditCard className="h-5 w-5" />}
      title="Billing & subscription"
      description="Manage your NOVA plan, billing information and invoices."
    >
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                CURRENT PLAN
              </span>

              <span className="text-sm text-muted-foreground">
                NOVA Starter
              </span>
            </div>

            <h3 className="mt-4 text-2xl font-semibold text-foreground">
              Build without limits
            </h3>

            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              Upgrade your workspace when you're ready for more
              intelligence, collaboration and automation capacity.
            </p>
          </div>

          <a
            href="/pricing"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            View plans
          </a>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ActionCard
          icon={<CreditCard className="h-5 w-5" />}
          title="Payment methods"
          description="Manage cards and billing information."
          action="Manage billing"
        />

        <ActionCard
          icon={<Globe2 className="h-5 w-5" />}
          title="Invoices"
          description="Access your billing history and invoices."
          action="View invoices"
        />
      </div>
    </SettingsPanel>
  );
}

function SettingsPanel({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>

          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>

            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7">{children}</div>
    </div>
  );
}

function FieldGroup({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>

      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>

      <div className="mt-3">{children}</div>
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex gap-4 py-5 first:pt-0 last:pb-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-foreground">
          {title}
        </h3>

        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked
            ? "bg-primary"
            : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked
              ? "translate-x-6"
              : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function ThemeOption({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-28 flex-col items-start justify-between rounded-xl border p-4 text-left transition-all ${
        selected
          ? "border-primary bg-primary/[0.05] text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      <div className="flex w-full items-center justify-between">
        {icon}

        {selected && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>

      <span className="text-sm font-medium">
        {label}
      </span>
    </button>
  );
}

function ActionCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <button
      type="button"
      className="group rounded-xl border border-border bg-background p-5 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.02]"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {icon}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <h3 className="mt-5 text-sm font-semibold text-foreground">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>

      <span className="mt-4 inline-block text-xs font-medium text-primary">
        {action}
      </span>
    </button>
  );
}

const inputClassName =
  "h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10";