"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type TeamRole = "Owner" | "Admin" | "Member" | "Viewer";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  initials: string;
  status: "active" | "invited";
};

type Activity = {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "member" | "project" | "system" | "invite";
};

type Team = {
  id: string;
  name: string;
  description: string;
  initials: string;
  gradient: string;
  projects: number;
  createdAt: string;
  members: TeamMember[];
  activities: Activity[];
};

const teams: Team[] = [
  {
    id: "nova-core",
    name: "NOVA Core",
    description:
      "Core platform architecture, artificial intelligence infrastructure and global product strategy.",
    initials: "NC",
    gradient: "from-violet-500 to-indigo-600",
    projects: 18,
    createdAt: "January 12, 2025",
    members: [
      {
        id: "alex-morgan",
        name: "Alex Morgan",
        email: "alex@nova.ai",
        role: "Owner",
        initials: "AM",
        status: "active",
      },
      {
        id: "sarah-chen",
        name: "Sarah Chen",
        email: "sarah@nova.ai",
        role: "Admin",
        initials: "SC",
        status: "active",
      },
      {
        id: "marcus-reed",
        name: "Marcus Reed",
        email: "marcus@nova.ai",
        role: "Member",
        initials: "MR",
        status: "active",
      },
      {
        id: "emma-wilson",
        name: "Emma Wilson",
        email: "emma@nova.ai",
        role: "Member",
        initials: "EW",
        status: "active",
      },
    ],
    activities: [
      {
        id: "activity-1",
        title: "Project updated",
        description: "Global Intelligence Infrastructure was updated.",
        time: "12 minutes ago",
        type: "project",
      },
      {
        id: "activity-2",
        title: "New member joined",
        description: "Emma Wilson joined the NOVA Core team.",
        time: "2 hours ago",
        type: "member",
      },
      {
        id: "activity-3",
        title: "Infrastructure deployment",
        description: "Production deployment completed successfully.",
        time: "Yesterday",
        type: "system",
      },
    ],
  },
  {
    id: "ai-research",
    name: "AI Research",
    description:
      "Advanced agents, reasoning systems, multimodal intelligence and autonomous workflows.",
    initials: "AR",
    gradient: "from-cyan-500 to-blue-600",
    projects: 12,
    createdAt: "February 8, 2025",
    members: [
      {
        id: "elena-rossi",
        name: "Elena Rossi",
        email: "elena@nova.ai",
        role: "Admin",
        initials: "ER",
        status: "active",
      },
      {
        id: "david-kim",
        name: "David Kim",
        email: "david@nova.ai",
        role: "Member",
        initials: "DK",
        status: "active",
      },
    ],
    activities: [
      {
        id: "activity-1",
        title: "Research milestone completed",
        description: "Autonomous reasoning benchmark reached a new milestone.",
        time: "1 hour ago",
        type: "project",
      },
      {
        id: "activity-2",
        title: "Knowledge base synchronized",
        description: "Research documents were synchronized successfully.",
        time: "Yesterday",
        type: "system",
      },
    ],
  },
  {
    id: "global-growth",
    name: "Global Growth",
    description:
      "Marketplace expansion, partnerships, enterprise adoption and international growth.",
    initials: "GG",
    gradient: "from-emerald-500 to-teal-600",
    projects: 9,
    createdAt: "March 21, 2025",
    members: [
      {
        id: "olivia-bennett",
        name: "Olivia Bennett",
        email: "olivia@nova.ai",
        role: "Admin",
        initials: "OB",
        status: "active",
      },
      {
        id: "james-wilson",
        name: "James Wilson",
        email: "james@nova.ai",
        role: "Viewer",
        initials: "JW",
        status: "invited",
      },
    ],
    activities: [
      {
        id: "activity-1",
        title: "Partnership pipeline updated",
        description: "Three new enterprise opportunities were added.",
        time: "3 hours ago",
        type: "project",
      },
      {
        id: "activity-2",
        title: "Invitation sent",
        description: "James Wilson was invited to the team.",
        time: "1 day ago",
        type: "invite",
      },
    ],
  },
];

const roleClasses: Record<TeamRole, string> = {
  Owner:
    "border-violet-500/20 bg-violet-500/10 text-violet-300",
  Admin:
    "border-blue-500/20 bg-blue-500/10 text-blue-300",
  Member:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  Viewer:
    "border-slate-500/20 bg-slate-500/10 text-slate-300",
};

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const teamId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [activeTab, setActiveTab] = useState<
    "overview" | "members" | "activity"
  >("overview");

  const [members, setMembers] = useState<TeamMember[]>(() => {
    const team = teams.find((item) => item.id === teamId);
    return team?.members ?? [];
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("Member");

  const team = useMemo(() => {
    return teams.find((item) => item.id === teamId) ?? null;
  }, [teamId]);

  if (!team) {
    return (
      <main className="min-h-screen bg-[#09090b] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
            ?
          </div>

          <h1 className="mt-6 text-3xl font-semibold">
            Team not found
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-white/45">
            The team you are looking for does not exist or may have been removed.
          </p>

          <Link
            href="/teams"
            className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Back to teams
          </Link>
        </div>
      </main>
    );
  }

  function addMember() {
    const name = inviteName.trim();
    const email = inviteEmail.trim();

    if (!name || !email) {
      return;
    }

    const initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    const newMember: TeamMember = {
      id: `${Date.now()}`,
      name,
      email,
      role: inviteRole,
      initials: initials || "NM",
      status: "invited",
    };

    setMembers((current) => [...current, newMember]);

    setInviteName("");
    setInviteEmail("");
    setInviteRole("Member");
    setInviteOpen(false);
  }

  function removeMember(memberId: string) {
    const member = members.find((item) => item.id === memberId);

    if (member?.role === "Owner") {
      return;
    }

    setMembers((current) =>
      current.filter((member) => member.id !== memberId)
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-white/40">
          <Link
            href="/workspace"
            className="transition hover:text-white"
          >
            Workspace
          </Link>

          <span>/</span>

          <Link
            href="/teams"
            className="transition hover:text-white"
          >
            Teams
          </Link>

          <span>/</span>

          <span className="text-white/80">{team.name}</span>
        </div>

        {/* Hero */}
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-5">
                <div
                  className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br ${team.gradient} text-2xl font-bold shadow-xl`}
                >
                  {team.initials}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      {team.name}
                    </h1>

                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                      Active
                    </span>
                  </div>

                  <p className="mt-4 max-w-3xl text-sm leading-7 text-white/50 sm:text-base">
                    {team.description}
                  </p>

                  <p className="mt-4 text-sm text-white/30">
                    Created {team.createdAt}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Invite member
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/teams")}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  All teams
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-10 grid gap-4 border-t border-white/10 pt-7 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                  Team members
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {members.length}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                  Active projects
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {team.projects}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                  Collaboration
                </p>

                <p className="mt-3 text-3xl font-semibold">94%</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                  Status
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="font-medium text-emerald-300">
                    Healthy
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="mt-8">
          <div className="flex gap-2 overflow-x-auto border-b border-white/10">
            {[
              ["overview", "Overview"],
              ["members", `Members (${members.length})`],
              ["activity", "Activity"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setActiveTab(
                    id as "overview" | "members" | "activity"
                  )
                }
                className={[
                  "relative whitespace-nowrap px-4 py-4 text-sm transition",
                  activeTab === id
                    ? "text-white"
                    : "text-white/40 hover:text-white/70",
                ].join(" ")}
              >
                {label}

                {activeTab === id && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Overview */}
        {activeTab === "overview" && (
          <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Team performance
                    </h2>

                    <p className="mt-1 text-sm text-white/40">
                      Current collaboration and execution metrics.
                    </p>
                  </div>

                  <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50">
                    Last 30 days
                  </span>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-black/20 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/45">
                        Project velocity
                      </span>

                      <span className="text-xs text-emerald-300">
                        +18.4%
                      </span>
                    </div>

                    <p className="mt-4 text-3xl font-semibold">
                      {team.projects}
                    </p>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[82%] rounded-full bg-white" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/8 bg-black/20 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/45">
                        Participation
                      </span>

                      <span className="text-xs text-emerald-300">
                        Excellent
                      </span>
                    </div>

                    <p className="mt-4 text-3xl font-semibold">
                      94%
                    </p>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[94%] rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <h2 className="text-lg font-semibold">
                  Active initiatives
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  Key projects currently owned by this team.
                </p>

                <div className="mt-6 space-y-3">
                  {[
                    "Global Intelligence Infrastructure",
                    "Autonomous Agent Platform",
                    "Enterprise Operating System",
                  ].map((project, index) => (
                    <div
                      key={project}
                      className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 p-4"
                    >
                      <div>
                        <p className="font-medium">{project}</p>

                        <p className="mt-1 text-xs text-white/35">
                          Priority {index === 0 ? "Critical" : "High"}
                        </p>
                      </div>

                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <h2 className="font-semibold">Team composition</h2>

                <div className="mt-6 space-y-4">
                  {(["Owner", "Admin", "Member", "Viewer"] as TeamRole[]).map(
                    (role) => {
                      const count = members.filter(
                        (member) => member.role === role
                      ).length;

                      const percentage =
                        members.length > 0
                          ? Math.round((count / members.length) * 100)
                          : 0;

                      return (
                        <div key={role}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white/60">{role}</span>

                            <span className="text-white/40">
                              {count}
                            </span>
                          </div>

                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-white/70"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <h2 className="font-semibold">Quick actions</h2>

                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => setInviteOpen(true)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm transition hover:bg-white/[0.08]"
                  >
                    Invite new member
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("members")}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm transition hover:bg-white/[0.08]"
                  >
                    Manage members
                  </button>

                  <Link
                    href="/projects"
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm transition hover:bg-white/[0.08]"
                  >
                    View projects
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Members */}
        {activeTab === "members" && (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="flex flex-col gap-4 border-b border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Team members
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  Control access and responsibilities.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Invite member
              </button>
            </div>

            <div className="divide-y divide-white/8">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-semibold">
                      {member.initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{member.name}</p>

                        {member.status === "invited" && (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                            Invited
                          </span>
                        )}
                      </div>

                      <p className="mt-1 truncate text-sm text-white/40">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${roleClasses[member.role]}`}
                    >
                      {member.role}
                    </span>

                    {member.role !== "Owner" && (
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        className="rounded-lg px-3 py-2 text-xs text-white/40 transition hover:bg-red-500/10 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Activity */}
        {activeTab === "activity" && (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="border-b border-white/10 p-6">
              <h2 className="text-lg font-semibold">
                Team activity
              </h2>

              <p className="mt-1 text-sm text-white/40">
                Recent events and collaboration history.
              </p>
            </div>

            <div className="divide-y divide-white/8">
              {team.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex gap-4 p-6"
                >
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                    {activity.type === "member"
                      ? "👤"
                      : activity.type === "project"
                        ? "◈"
                        : activity.type === "invite"
                          ? "✉"
                          : "✓"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium">
                        {activity.title}
                      </p>

                      <span className="text-xs text-white/30">
                        {activity.time}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-white/45">
                      {activity.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111113] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold">
                  Invite team member
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  Add a new collaborator to {team.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg px-3 py-2 text-white/40 transition hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Full name
                </label>

                <input
                  value={inviteName}
                  onChange={(event) =>
                    setInviteName(event.target.value)
                  }
                  placeholder="Enter full name"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-white/25"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Email address
                </label>

                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) =>
                    setInviteEmail(event.target.value)
                  }
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-white/25"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Role
                </label>

                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value as TeamRole)
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/25"
                >
                  <option value="Admin">Admin</option>
                  <option value="Member">Member</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={addMember}
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Send invitation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}