"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  KeyRound,
  Laptop,
  Lock,
  MapPin,
  Monitor,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

type ActivityType =
  | "security"
  | "account"
  | "privacy"
  | "workspace";

type ActivityFilter = "all" | ActivityType;

interface PrivacyActivity {
  id: string;
  title: string;
  description: string;
  type: ActivityType;
  timestamp: string;
  location?: string;
  device?: string;
  status: "success" | "info";
}

const ACTIVITIES: PrivacyActivity[] = [
  {
    id: "activity-1",
    title: "Successful account sign in",
    description:
      "Your NOVA account was successfully accessed.",
    type: "security",
    timestamp: "Today, 10:42",
    location: "Current session",
    device: "Desktop browser",
    status: "success",
  },
  {
    id: "activity-2",
    title: "Privacy preferences updated",
    description:
      "Your workspace privacy and communication preferences were changed.",
    type: "privacy",
    timestamp: "Today, 09:18",
    status: "success",
  },
  {
    id: "activity-3",
    title: "Workspace knowledge accessed",
    description:
      "A knowledge resource was opened from your workspace.",
    type: "workspace",
    timestamp: "Yesterday, 16:24",
    status: "info",
  },
  {
    id: "activity-4",
    title: "Password security check",
    description:
      "Your account security configuration was reviewed.",
    type: "security",
    timestamp: "Yesterday, 11:08",
    device: "Desktop browser",
    status: "success",
  },
  {
    id: "activity-5",
    title: "Profile information updated",
    description:
      "Account profile information was modified.",
    type: "account",
    timestamp: "2 days ago",
    status: "success",
  },
  {
    id: "activity-6",
    title: "Workspace member permissions changed",
    description:
      "Workspace collaboration permissions were updated.",
    type: "workspace",
    timestamp: "3 days ago",
    status: "info",
  },
  {
    id: "activity-7",
    title: "Data export requested",
    description:
      "A request to prepare workspace information for export was created.",
    type: "privacy",
    timestamp: "5 days ago",
    status: "info",
  },
];

function ActivityIcon({
  type,
  className,
}: {
  type: ActivityType;
  className?: string;
}) {
  switch (type) {
    case "security":
      return <Lock className={className} />;

    case "account":
      return <UserCheck className={className} />;

    case "privacy":
      return <Eye className={className} />;

    case "workspace":
      return <Monitor className={className} />;

    default:
      return <ShieldCheck className={className} />;
  }
}

function ActivityTypeLabel({
  type,
}: {
  type: ActivityType;
}) {
  switch (type) {
    case "security":
      return "Security";

    case "account":
      return "Account";

    case "privacy":
      return "Privacy";

    case "workspace":
      return "Workspace";

    default:
      return "Activity";
  }
}

export default function PrivacyActivityPage() {
  const [filter, setFilter] =
    useState<ActivityFilter>("all");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [activities, setActivities] =
    useState<PrivacyActivity[]>(ACTIVITIES);

  const filteredActivities = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    return activities.filter((activity) => {
      const matchesFilter =
        filter === "all" ||
        activity.type === filter;

      const searchableContent = [
        activity.title,
        activity.description,
        activity.type,
        activity.timestamp,
        activity.location ?? "",
        activity.device ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        query.length === 0 ||
        searchableContent.includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [
    activities,
    filter,
    searchQuery,
  ]);

  const securityCount = useMemo(() => {
    return activities.filter(
      (activity) => activity.type === "security"
    ).length;
  }, [activities]);

  const privacyCount = useMemo(() => {
    return activities.filter(
      (activity) => activity.type === "privacy"
    ).length;
  }, [activities]);

  function clearActivityHistory() {
    setActivities([]);
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
        {/* Back navigation */}
        <Link
          href="/privacy"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Privacy Center
        </Link>

        {/* Header */}
        <section className="mt-8 border-b border-border pb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <ShieldCheck className="h-4 w-4" />
                Privacy Center
              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Privacy activity
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Review important privacy, security, account and
                workspace activity associated with your NOVA
                environment.
              </p>
            </div>

            <button
              type="button"
              onClick={clearActivityHistory}
              disabled={activities.length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear activity
            </button>
          </div>

          {/* Summary */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Clock3 className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Total activity
                  </p>

                  <p className="text-xl font-semibold text-foreground">
                    {activities.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Security events
                  </p>

                  <p className="text-xl font-semibold text-foreground">
                    {securityCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Eye className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Privacy events
                  </p>

                  <p className="text-xl font-semibold text-foreground">
                    {privacyCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                "all",
                "security",
                "account",
                "privacy",
                "workspace",
              ] as ActivityFilter[]
            ).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  filter === item
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item === "all"
                  ? "All activity"
                  : item.charAt(0).toUpperCase() +
                    item.slice(1)}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search activity..."
              className="h-11 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        </section>

        {/* Activity list */}
        <section className="mt-8">
          {filteredActivities.length > 0 ? (
            <div className="overflow-hidden rounded-3xl border border-border bg-card">
              {filteredActivities.map(
                (activity, index) => (
                  <article
                    key={activity.id}
                    className={`group p-6 transition-colors hover:bg-muted/30 ${
                      index !==
                      filteredActivities.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ActivityIcon
                          type={activity.type}
                          className="h-5 w-5"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-semibold text-foreground">
                                {activity.title}
                              </h2>

                              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                                <ActivityTypeLabel
                                  type={activity.type}
                                />
                              </span>
                            </div>

                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {activity.description}
                            </p>
                          </div>

                          <span className="shrink-0 text-xs text-muted-foreground">
                            {activity.timestamp}
                          </span>
                        </div>

                        {(activity.location ||
                          activity.device) && (
                          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {activity.location && (
                              <div className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                {activity.location}
                              </div>
                            )}

                            {activity.device && (
                              <div className="inline-flex items-center gap-1.5">
                                <Laptop className="h-3.5 w-3.5" />
                                {activity.device}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-4 flex items-center gap-2 text-xs">
                          <CheckCircle2
                            className={`h-4 w-4 ${
                              activity.status === "success"
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          />

                          <span className="text-muted-foreground">
                            {activity.status === "success"
                              ? "Completed successfully"
                              : "Recorded activity"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          ) : (
            <div className="flex min-h-[380px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <ShieldCheck className="h-7 w-7" />
              </div>

              <h2 className="mt-5 text-lg font-semibold text-foreground">
                No activity found
              </h2>

              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {activities.length === 0
                  ? "Your privacy activity history is currently empty."
                  : "No activity matches your current search or filter."}
              </p>

              {(filter !== "all" ||
                searchQuery.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setSearchQuery("");
                  }}
                  className="mt-5 text-sm font-semibold text-primary hover:underline"
                >
                  Reset filters
                </button>
              )}
            </div>
          )}
        </section>

        {/* Privacy actions */}
        <section className="mt-10 grid gap-5 lg:grid-cols-2">
          <Link
            href="/privacy"
            className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <h3 className="mt-5 font-semibold text-foreground">
                  Privacy Center
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Review privacy principles, controls and information
                  categories for your NOVA workspace.
                </p>
              </div>

              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
          </Link>

          <Link
            href="/profile"
            className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>

                <h3 className="mt-5 font-semibold text-foreground">
                  Manage your account
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Review your profile, account information and workspace
                  preferences.
                </p>
              </div>

              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
          </Link>
        </section>

        {/* Data request */}
        <section className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-7 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Filter className="h-4 w-4" />
                Data controls
              </div>

              <h2 className="mt-3 text-xl font-semibold text-foreground">
                Need a copy of your activity?
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                You can review privacy-related activity and manage your
                workspace information from the NOVA Privacy Center.
              </p>
            </div>

            <button
              type="button"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Request export
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}