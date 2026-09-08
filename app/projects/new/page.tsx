"use client";

import type { FormEvent} from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  FolderKanban,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

/*
  These must be values public.projects accepts. The column is
  constrained to draft | active | archived | completed, so the
  previous "planning" would have been rejected by the database the
  moment this form actually persisted anything.
*/
type ProjectStatus = "draft" | "active";

const workspaceOptions = [
  "SYRAVEN Core",
  "Research Lab",
  "Intelligence",
  "Product",
  "Personal Workspace",
];

export default function NewProjectPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workspace, setWorkspace] = useState("SYRAVEN Core");
  const [status, setStatus] = useState<ProjectStatus>("draft");
  const [deadline, setDeadline] = useState("");
  const [members, setMembers] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showWorkspaces, setShowWorkspaces] = useState(false);

  const isValid = useMemo(() => {
    return name.trim().length >= 3 && description.trim().length >= 10;
  }, [name, description]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      /*
        Persist through the API rather than faking it.

        This handler previously awaited a 700ms timeout and then
        redirected to /projects/<slug>, which fell through to a
        hardcoded fallback project. The user saw a success animation
        and a detail page containing none of what they had typed, and
        nothing was ever written.

        Ownership is NOT sent: the route derives owner_id and user_id
        from the verified session and ignores any client-supplied
        identity.
      */
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          status,
          dueDate: deadline || undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: { id?: string };
        error?: string;
      } | null;

      if (!response.ok || !payload?.success || !payload.data?.id) {
        throw new Error(
          payload?.error ?? "The project could not be created.",
        );
      }

      /* Navigate by the real id, so the detail page can load it. */
      router.push(`/projects/${payload.data.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The project could not be created.",
      );

      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8 lg:py-10">
        {/* Navigation */}
        <div className="border-b border-border pb-6">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>
        </div>

        <div className="py-8 lg:py-12">
          {/* Header */}
          <div className="max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Plus className="h-6 w-6" />
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Create a new project
            </h1>

            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              Create a dedicated workspace for your team, tasks,
              knowledge, AI workflows and long-term project intelligence.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]"
          >
            {/* Main form */}
            <div className="space-y-8">
              {/* Basic information */}
              <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary">
                    <FolderKanban className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Project information
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Define the foundation of your new project.
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-6">
                  <div>
                    <label
                      htmlFor="project-name"
                      className="text-sm font-medium text-foreground"
                    >
                      Project name
                    </label>

                    <input
                      id="project-name"
                      type="text"
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      placeholder="e.g. Global Intelligence Platform"
                      className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />

                    <p className="mt-2 text-xs text-muted-foreground">
                      Choose a clear and recognizable project name.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="project-description"
                      className="text-sm font-medium text-foreground"
                    >
                      Project description
                    </label>

                    <textarea
                      id="project-description"
                      value={description}
                      onChange={(event) =>
                        setDescription(event.target.value)
                      }
                      placeholder="Describe the mission, goals and expected outcome of this project..."
                      rows={6}
                      className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />

                    <div className="mt-2 flex items-center justify-between gap-4">
                      <p className="text-xs text-muted-foreground">
                        A detailed description helps SYRAVEN understand your
                        project context.
                      </p>

                      <span className="shrink-0 text-xs text-muted-foreground">
                        {description.length}/2000
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Configuration */}
              <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary">
                    <Target className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Project configuration
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Configure the initial structure and lifecycle.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  {/* Workspace */}
                  <div className="relative">
                    <label className="text-sm font-medium text-foreground">
                      Workspace
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setShowWorkspaces((value) => !value)
                      }
                      className="mt-2 flex h-12 w-full items-center justify-between rounded-xl border border-border bg-background px-4 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <span>{workspace}</span>

                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>

                    {showWorkspaces && (
                      <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
                        {workspaceOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setWorkspace(option);
                              setShowWorkspaces(false);
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {option}

                            {workspace === option && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Initial status
                    </label>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setStatus("draft")}
                        className={`h-12 rounded-xl border px-4 text-sm font-medium transition-colors ${
                          status === "draft"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        Draft
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatus("active")}
                        className={`h-12 rounded-xl border px-4 text-sm font-medium transition-colors ${
                          status === "active"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        Active
                      </button>
                    </div>
                  </div>

                  {/* Deadline */}
                  <div>
                    <label
                      htmlFor="deadline"
                      className="text-sm font-medium text-foreground"
                    >
                      Target deadline
                    </label>

                    <div className="relative mt-2">
                      <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                      <input
                        id="deadline"
                        type="date"
                        value={deadline}
                        onChange={(event) =>
                          setDeadline(event.target.value)
                        }
                        className="h-12 w-full rounded-xl border border-border bg-background py-2 pl-11 pr-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                  </div>

                  {/* Members */}
                  <div>
                    <label
                      htmlFor="members"
                      className="text-sm font-medium text-foreground"
                    >
                      Initial team size
                    </label>

                    <div className="relative mt-2">
                      <Users className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                      <input
                        id="members"
                        type="number"
                        min="1"
                        max="10000"
                        value={members}
                        onChange={(event) =>
                          setMembers(event.target.value)
                        }
                        className="h-12 w-full rounded-xl border border-border bg-background py-2 pl-11 pr-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* AI section */}
              <section className="rounded-3xl border border-primary/15 bg-primary/[0.04] p-6 sm:p-8">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      SYRAVEN project intelligence
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      After creating your project, SYRAVEN can help you
                      structure goals, generate tasks, connect knowledge
                      and continuously analyze project progress.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* Sidebar */}
            <aside className="space-y-6">
              <section className="rounded-3xl border border-border bg-card p-6">
                <h2 className="text-base font-semibold text-foreground">
                  Project summary
                </h2>

                <div className="mt-6 space-y-5">
                  <SummaryRow
                    label="Name"
                    value={
                      name.trim() || "Not specified"
                    }
                  />

                  <SummaryRow
                    label="Workspace"
                    value={workspace}
                  />

                  <SummaryRow
                    label="Status"
                    value={
                      status === "active"
                        ? "Active"
                        : "Planning"
                    }
                  />

                  <SummaryRow
                    label="Deadline"
                    value={
                      deadline
                        ? new Date(
                            `${deadline}T00:00:00`
                          ).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )
                        : "Not set"
                    }
                  />
                </div>

                <div className="mt-7 border-t border-border pt-6">
                  {submitError ? (
                    <p
                      role="alert"
                      className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    >
                      {submitError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating project...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create project
                      </>
                    )}
                  </button>

                  <Link
                    href="/projects"
                    className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Cancel
                  </Link>
                </div>
              </section>

              <section className="rounded-3xl border border-border bg-card p-6">
                <h3 className="text-sm font-semibold text-foreground">
                  What happens next?
                </h3>

                <ol className="mt-5 space-y-4">
                  <Step
                    number="1"
                    text="Your project workspace is created."
                  />
                  <Step
                    number="2"
                    text="Add tasks, knowledge and collaborators."
                  />
                  <Step
                    number="3"
                    text="Use SYRAVEN AI to accelerate execution."
                  />
                </ol>
              </section>
            </aside>
          </form>
        </div>
      </div>
    </main>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-1.5 truncate text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function Step({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {number}
      </span>

      <span className="pt-0.5 text-sm leading-6 text-muted-foreground">
        {text}
      </span>
    </li>
  );
}