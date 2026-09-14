"use client";

import Link from "next/link";
import {
  Bell,
  Camera,
  ChevronRight,
  CreditCard,
  KeyRound,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  User,
  UserCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/lib/supabase";

/*
  SYRAVEN — Profile

  WHAT THIS PAGE SHOWS

  The signed-in account's email, read with auth.getUser() -- verified by
  the auth server, not taken from local storage. That is the only
  personal field the product actually stores.

  WHAT IT USED TO SHOW

  A form pre-filled with "SYRAVEN User", "user@syraven.ai", the handle
  "syraven-user" and the bio "Building the future with artificial
  intelligence." -- presented, editable, as the caller's own profile.
  None of it was anybody's data. And three notification switches that
  flipped in memory and were forgotten on reload, while looking like
  saved preferences.

  WHAT IS DELIBERATELY ABSENT

  Profile storage. public.profiles holds billing columns only, and
  public.user_settings a single memory_enabled flag -- there is no name,
  username, bio, avatar or notification-preference column anywhere in
  the schema. The fields stay visible, empty and disabled, with the
  reason beside them, until a migration gives them a home.
*/

type TabId = "profile" | "security" | "notifications";

const tabs: {
  id: TabId;
  label: string;
  icon: typeof User;
}[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "notifications", label: "Notifications", icon: Bell },
];

/**
 * Email as the auth server reports it.
 *
 * "loading" and "unavailable" are kept distinct from an address so the
 * page never fills the gap with a placeholder that reads like data.
 */
type AccountEmail =
  | { state: "loading" }
  | { state: "known"; email: string }
  | { state: "unavailable" };

const NOTIFICATION_TOPICS: { title: string; description: string }[] = [
  {
    title: "Email notifications",
    description: "Important account and workspace updates by email.",
  },
  {
    title: "Product updates",
    description: "News about SYRAVEN capabilities.",
  },
  {
    title: "Security alerts",
    description: "Notifications related to account security.",
  },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [account, setAccount] = useState<AccountEmail>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((user) => {
        if (cancelled) return;

        setAccount(
          user?.email
            ? { state: "known", email: user.email }
            : { state: "unavailable" },
        );
      })
      .catch(() => {
        if (!cancelled) setAccount({ state: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const initial =
    account.state === "known" ? account.email.charAt(0).toUpperCase() : "";

  return (
    /*
      A plain container, not a second <main>: AppChrome already emits
      the page main landmark, and two of them is invalid HTML.
    */
    <div className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
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
                Your account, its security, and what can and cannot be
                changed here yet.
              </p>
            </div>

            <Link
              href="/billing"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <CreditCard className="h-4 w-4" />
              Manage plan
            </Link>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
          <aside>
            <nav
              aria-label="Profile sections"
              className="flex gap-2 overflow-x-auto lg:flex-col"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={isActive}
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
          </aside>

          <section className="min-w-0">
            {activeTab === "profile" && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-foreground">
                  Personal information
                </h2>

                <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="relative">
                    <div
                      aria-hidden="true"
                      className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-3xl font-semibold text-primary"
                    >
                      {initial || <User className="h-8 w-8" />}
                    </div>

                    <button
                      type="button"
                      disabled
                      aria-label="Change profile picture"
                      aria-describedby="profile-photo-availability"
                      className="absolute -bottom-2 -right-2 flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl border border-border bg-card text-foreground opacity-60 shadow-sm"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground">
                      Profile photo
                    </h3>

                    <p
                      id="profile-photo-availability"
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      Photo upload is not available yet.
                    </p>
                  </div>
                </div>

                <div className="mt-10 space-y-2">
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
                      readOnly
                      value={account.state === "known" ? account.email : ""}
                      placeholder={
                        account.state === "loading"
                          ? "Loading..."
                          : account.state === "unavailable"
                            ? "Your email could not be loaded."
                            : undefined
                      }
                      aria-describedby="profile-email-note"
                      className="h-11 w-full rounded-xl border border-border bg-muted/40 pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>

                  <p
                    id="profile-email-note"
                    className="text-xs text-muted-foreground"
                  >
                    The address you sign in with. Changing it here is not
                    available yet.
                  </p>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {(
                    [
                      ["fullName", "Full name"],
                      ["username", "Username"],
                    ] as const
                  ).map(([id, label]) => (
                    <div key={id} className="space-y-2">
                      <label
                        htmlFor={id}
                        className="text-sm font-medium text-foreground"
                      >
                        {label}
                      </label>

                      <input
                        id={id}
                        type="text"
                        disabled
                        value=""
                        aria-describedby="profile-storage-availability"
                        className="h-11 w-full cursor-not-allowed rounded-xl border border-border bg-muted/40 px-4 text-sm opacity-60"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    id="profile-storage-availability"
                    className="text-sm text-muted-foreground"
                  >
                    Profile editing is not available yet: there is nowhere
                    to store a name or username, so these fields stay empty
                    rather than pretend.
                  </p>

                  <button
                    type="button"
                    disabled
                    aria-describedby="profile-storage-availability"
                    className="inline-flex h-11 shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Save changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <KeyRound className="h-5 w-5" />
                    </div>

                    <h2 className="text-xl font-semibold text-foreground">
                      Password & security
                    </h2>
                  </div>

                  <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">
                          Password
                        </h3>

                        <p
                          id="profile-password-availability"
                          className="mt-1 text-sm text-muted-foreground"
                        >
                          Changing your password from here is not
                          available yet. Use the password reset link on
                          the sign-in page.
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled
                        aria-describedby="profile-password-availability"
                        className="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-foreground opacity-60"
                      >
                        Change password
                      </button>
                    </div>

                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">
                          Two-factor authentication
                        </h3>

                        <p
                          id="profile-2fa-availability"
                          className="mt-1 text-sm text-muted-foreground"
                        >
                          Two-factor authentication is not available
                          yet. This account is protected by its
                          password alone.
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled
                        aria-describedby="profile-2fa-availability"
                        className="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground opacity-60"
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
                          What happened across your projects, tasks,
                          knowledge and approvals.
                        </p>
                      </div>

                      <Link
                        href="/activity"
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

            {activeTab === "notifications" && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-foreground">
                  Notification preferences
                </h2>

                <p
                  id="profile-notifications-availability"
                  className="mt-2 text-sm leading-6 text-muted-foreground"
                >
                  Choosing notifications is not available yet: no
                  preference is stored, so none is shown as on or off.
                </p>

                <ul className="mt-8 divide-y divide-border rounded-2xl border border-border">
                  {NOTIFICATION_TOPICS.map((topic) => (
                    <li
                      key={topic.title}
                      className="flex items-center justify-between gap-6 p-5"
                    >
                      <div>
                        <h3 className="font-medium text-foreground">
                          {topic.title}
                        </h3>

                        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                          {topic.description}
                        </p>
                      </div>

                      <span className="shrink-0 text-xs text-muted-foreground">
                        Not configurable yet
                      </span>
                    </li>
                  ))}
                </ul>

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
    </div>
  );
}
