"use client";

import Link from "next/link";
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  CreditCard,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  User,
  UserCircle2,
} from "lucide-react";
import { useState } from "react";

type TabId = "profile" | "security" | "notifications";

interface ProfileForm {
  fullName: string;
  email: string;
  username: string;
  bio: string;
}

const tabs: {
  id: TabId;
  label: string;
  icon: typeof User;
}[] = [
  {
    id: "profile",
    label: "Profile",
    icon: User,
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
  },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] =
    useState<TabId>("profile");

  const [isSaving, setIsSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [form, setForm] =
    useState<ProfileForm>({
      fullName: "NOVA User",
      email: "user@nova.ai",
      username: "nova-user",
      bio: "Building the future with artificial intelligence.",
    });

  const [emailNotifications, setEmailNotifications] =
    useState(true);

  const [productUpdates, setProductUpdates] =
    useState(true);

  const [securityAlerts, setSecurityAlerts] =
    useState(true);

  function updateForm(
    field: keyof ProfileForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setSaved(false);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaved(false);

    await new Promise((resolve) =>
      setTimeout(resolve, 700)
    );

    setIsSaving(false);
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
        {/* Header */}
        <section className="border-b border-border pb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <UserCircle2 className="h-4 w-4" />
                Account settings
              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Profile
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Manage your personal information, account security and
                notification preferences.
              </p>
            </div>

            <Link
              href="/pricing"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <CreditCard className="h-4 w-4" />
              Manage plan
            </Link>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <aside>
            <nav className="flex gap-2 overflow-x-auto lg:flex-col">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive =
                  activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setActiveTab(tab.id)
                    }
                    className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-8 hidden rounded-2xl border border-border bg-card p-5 lg:block">
              <ShieldCheck className="h-5 w-5 text-primary" />

              <h3 className="mt-4 text-sm font-semibold text-foreground">
                Account security
              </h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Review your security settings and keep your account
                protected.
              </p>

              <Link
                href="/privacy/activity"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                View activity
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>

          {/* Content */}
          <section className="min-w-0">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      Personal information
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Update the information associated with your NOVA
                      account.
                    </p>
                  </div>

                  {/* Avatar */}
                  <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="relative">
                      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-3xl font-semibold text-primary">
                        {form.fullName
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((name) =>
                            name.charAt(0).toUpperCase()
                          )
                          .join("") || "N"}
                      </div>

                      <button
                        type="button"
                        className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
                        aria-label="Change profile picture"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground">
                        Profile photo
                      </h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Upload a profile image for your NOVA account.
                      </p>

                      <button
                        type="button"
                        className="mt-3 text-sm font-medium text-primary hover:underline"
                      >
                        Upload new photo
                      </button>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="mt-10 grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        htmlFor="fullName"
                        className="text-sm font-medium text-foreground"
                      >
                        Full name
                      </label>

                      <input
                        id="fullName"
                        type="text"
                        value={form.fullName}
                        onChange={(event) =>
                          updateForm(
                            "fullName",
                            event.target.value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="username"
                        className="text-sm font-medium text-foreground"
                      >
                        Username
                      </label>

                      <input
                        id="username"
                        type="text"
                        value={form.username}
                        onChange={(event) =>
                          updateForm(
                            "username",
                            event.target.value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <label
                        htmlFor="email"
                        className="text-sm font-medium text-foreground"
                      >
                        Email address
                      </label>

                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                        <input
                          id="email"
                          type="email"
                          value={form.email}
                          onChange={(event) =>
                            updateForm(
                              "email",
                              event.target.value
                            )
                          }
                          className="h-11 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <label
                        htmlFor="bio"
                        className="text-sm font-medium text-foreground"
                      >
                        Bio
                      </label>

                      <textarea
                        id="bio"
                        rows={4}
                        value={form.bio}
                        onChange={(event) =>
                          updateForm(
                            "bio",
                            event.target.value
                          )
                        }
                        className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                    <p className="text-sm text-muted-foreground">
                      {saved
                        ? "Changes saved successfully."
                        : "Your changes will be saved to your account."}
                    </p>

                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : saved ? (
                        <>
                          <Check className="h-4 w-4" />
                          Saved
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <KeyRound className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-xl font-semibold text-foreground">
                        Password & security
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Keep your account secure by reviewing your login
                        and authentication settings.
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">
                          Password
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                          Last updated recently.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        Change password
                      </button>
                    </div>

                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">
                          Two-factor authentication
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                          Add an additional layer of account security.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        Set up
                      </button>
                    </div>

                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">
                          Recent activity
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                          Review recent account and security activity.
                        </p>
                      </div>

                      <Link
                        href="/privacy/activity"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        View activity
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Lock className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-xl font-semibold text-foreground">
                        Privacy controls
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Review privacy information and workspace activity.
                      </p>

                      <Link
                        href="/privacy"
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        Open Privacy Center
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Notification preferences
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Choose how NOVA communicates important workspace
                    updates to you.
                  </p>
                </div>

                <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
                  <NotificationPreference
                    title="Email notifications"
                    description="Receive important account and workspace updates by email."
                    enabled={emailNotifications}
                    onChange={setEmailNotifications}
                  />

                  <NotificationPreference
                    title="Product updates"
                    description="Stay informed about new NOVA capabilities and platform improvements."
                    enabled={productUpdates}
                    onChange={setProductUpdates}
                  />

                  <NotificationPreference
                    title="Security alerts"
                    description="Receive important notifications related to account security."
                    enabled={securityAlerts}
                    onChange={setSecurityAlerts}
                  />
                </div>

                <Link
                  href="/notifications"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Bell className="h-4 w-4" />
                  View all notifications
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function NotificationPreference({
  title,
  description,
  enabled,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 p-5">
      <div>
        <h3 className="font-medium text-foreground">
          {title}
        </h3>

        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          enabled
            ? "bg-primary"
            : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            enabled
              ? "translate-x-6"
              : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}