/*
  SYRAVEN — Activity events, derived from rows that exist

  WHAT THIS IS

  A pure function from a caller's own rows to a timeline. It reads
  timestamps the database already records -- created_at, updated_at,
  completed_at, decided_at, expires_at -- and states only what those
  columns prove.

  WHAT IT REFUSES TO SAY

  There is no event log in this schema. So this cannot know that a task
  moved from "todo" to "in_progress" at 14:02, or who edited a project.
  It can know that a row was created at one moment and last changed at
  another. Every event below is one of those two facts, or a terminal
  timestamp a column records explicitly. Nothing is interpolated, and a
  row updated in the same statement that created it is not reported as
  "updated" -- Postgres stamps both columns at insert, and calling that
  an edit would invent one.

  No server imports, no clock of its own: `now` is an input, so the
  tests execute this exact function rather than a mirror of it.
*/

export type ActivityKind = "project" | "task" | "knowledge" | "approval";

/** What an event means for the person reading it. */
export type ActivityTone = "success" | "progress" | "pending" | "failed" | "info";

export interface ActivityEvent {
  /** Stable across loads: kind, row id and which fact this is. */
  readonly id: string;
  readonly kind: ActivityKind;
  readonly title: string;
  readonly detail: string;
  readonly tone: ActivityTone;
  /** ISO timestamp taken from the row, never from the request. */
  readonly occurredAt: string;
  /** Where the thing lives, when it still has a page. */
  readonly href: string | null;
}

export interface ActivitySources {
  readonly projects: readonly {
    id: string;
    name: string;
    created_at: string | null;
    updated_at: string | null;
  }[];
  readonly tasks: readonly {
    id: string;
    title: string;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
    completed_at: string | null;
  }[];
  readonly knowledge: readonly {
    id: string;
    title: string;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
  }[];
  readonly approvals: readonly {
    id: string;
    tool_id: string;
    agent_id: string;
    status: string;
    created_at: string | null;
    decided_at: string | null;
    expires_at: string | null;
  }[];
}

/**
 * An update closer to creation than this is the insert itself.
 *
 * Postgres sets created_at and updated_at in the same statement, and a
 * trigger or a follow-up write in the same request can move updated_at
 * by milliseconds. Reporting either as an edit would describe work
 * nobody did.
 */
export const UPDATE_THRESHOLD_MS = 60_000;

/** Upper bound on what one timeline returns. */
export const DEFAULT_LIMIT = 60;

function time(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** True only when the row was changed after it was created. */
function wasUpdated(created: number | null, updated: number | null): boolean {
  return created !== null && updated !== null && updated - created > UPDATE_THRESHOLD_MS;
}

function taskTone(status: string | null): ActivityTone {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
      return "progress";
    case "blocked":
      return "failed";
    default:
      return "info";
  }
}

/**
 * Builds the caller's timeline, newest first.
 *
 * @param sources Rows already scoped to the caller by the route.
 * @param now     The moment of the request, for approval expiry only.
 */
export function deriveActivity(
  sources: ActivitySources,
  options: { now: Date; limit?: number },
): ActivityEvent[] {
  const now = options.now.getTime();
  const events: ActivityEvent[] = [];

  for (const project of sources.projects) {
    const created = time(project.created_at);
    const updated = time(project.updated_at);
    const href = `/projects/${project.id}`;

    if (created !== null) {
      events.push({
        id: `project:${project.id}:created`,
        kind: "project",
        title: "Project created",
        detail: project.name,
        tone: "info",
        occurredAt: iso(created),
        href,
      });
    }

    if (updated !== null && wasUpdated(created, updated)) {
      events.push({
        id: `project:${project.id}:updated`,
        kind: "project",
        title: "Project updated",
        detail: project.name,
        tone: "info",
        occurredAt: iso(updated),
        href,
      });
    }
  }

  for (const task of sources.tasks) {
    const created = time(task.created_at);
    const updated = time(task.updated_at);
    const completed = time(task.completed_at);
    const href = `/tasks/${task.id}`;

    if (created !== null) {
      events.push({
        id: `task:${task.id}:created`,
        kind: "task",
        title: "Task created",
        detail: task.title,
        tone: "info",
        occurredAt: iso(created),
        href,
      });
    }

    /*
      Completion is reported from completed_at and only while the task
      is still completed. A task reopened after completion keeps a stale
      completed_at in some rows, and calling it done would be false.
    */
    if (completed !== null && task.status === "completed") {
      events.push({
        id: `task:${task.id}:completed`,
        kind: "task",
        title: "Task completed",
        detail: task.title,
        tone: "success",
        occurredAt: iso(completed),
        href,
      });
    } else if (updated !== null && wasUpdated(created, updated)) {
      events.push({
        id: `task:${task.id}:updated`,
        kind: "task",
        title:
          task.status === "blocked"
            ? "Task blocked"
            : task.status === "in_progress"
              ? "Task in progress"
              : task.status === "cancelled"
                ? "Task cancelled"
                : "Task updated",
        detail: task.title,
        tone: taskTone(task.status),
        occurredAt: iso(updated),
        href,
      });
    }
  }

  for (const record of sources.knowledge) {
    const created = time(record.created_at);
    const updated = time(record.updated_at);
    const href = `/knowledge/${record.id}`;

    if (created !== null) {
      events.push({
        id: `knowledge:${record.id}:created`,
        kind: "knowledge",
        title:
          record.status === "failed"
            ? "Brain record failed to process"
            : "Added to the Brain",
        detail: record.title,
        tone: record.status === "failed" ? "failed" : "info",
        occurredAt: iso(created),
        href,
      });
    }

    if (updated !== null && wasUpdated(created, updated)) {
      events.push({
        id: `knowledge:${record.id}:updated`,
        kind: "knowledge",
        title: "Brain record updated",
        detail: record.title,
        tone: "info",
        occurredAt: iso(updated),
        href,
      });
    }
  }

  for (const approval of sources.approvals) {
    const created = time(approval.created_at);
    const decided = time(approval.decided_at);
    const expires = time(approval.expires_at);
    const subject = `${approval.agent_id} · ${approval.tool_id}`;

    /*
      A stored 'pending' row past its expiry is not waiting on anyone:
      the approval store refuses it, and so does /approvals. Reporting it
      as "waiting on you" would be a control that cannot act.
    */
    const expired =
      approval.status === "expired" ||
      ((approval.status === "pending" || approval.status === "approved") &&
        decided === null &&
        expires !== null &&
        expires <= now);

    if (created !== null) {
      const waiting = approval.status === "pending" && !expired;

      events.push({
        id: `approval:${approval.id}:requested`,
        kind: "approval",
        title: "Approval requested",
        detail: subject,
        tone: waiting ? "pending" : "info",
        occurredAt: iso(created),
        href: waiting ? "/approvals" : null,
      });
    }

    if (decided !== null && (approval.status === "approved" || approval.status === "used")) {
      events.push({
        id: `approval:${approval.id}:approved`,
        kind: "approval",
        title: "You approved an agent step",
        detail: subject,
        tone: "success",
        occurredAt: iso(decided),
        href: null,
      });
    } else if (decided !== null && approval.status === "rejected") {
      events.push({
        id: `approval:${approval.id}:rejected`,
        kind: "approval",
        title: "You rejected an agent step",
        detail: subject,
        tone: "info",
        occurredAt: iso(decided),
        href: null,
      });
    } else if (expired && expires !== null) {
      events.push({
        id: `approval:${approval.id}:expired`,
        kind: "approval",
        title: "Approval expired unanswered",
        detail: subject,
        tone: "info",
        occurredAt: iso(expires),
        href: null,
      });
    }
  }

  return events
    .sort((a, b) => {
      const byTime = Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    })
    .slice(0, options.limit ?? DEFAULT_LIMIT);
}
