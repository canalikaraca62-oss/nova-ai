"use client";

import type { FormEvent} from "react";
import { useMemo, useState } from "react";

type TeamRole = "Owner" | "Admin" | "Member" | "Viewer";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatar: string;
  status: "active" | "invited";
};

type Team = {
  id: string;
  name: string;
  description: string;
  initials: string;
  color: string;
  members: TeamMember[];
  projects: number;
  createdAt: string;
};

const initialTeams: Team[] = [
  {
    id: "syraven-core",
    name: "SYRAVEN Core",
    description:
      "Core platform architecture, artificial intelligence infrastructure and global product strategy.",
    initials: "NC",
    color: "from-violet-500 to-indigo-600",
    projects: 18,
    createdAt: "2025-01-12",
    members: [
      {
        id: "member-1",
        name: "Alex Morgan",
        email: "alex@syraven.ai",
        role: "Owner",
        avatar: "AM",
        status: "active",
      },
      {
        id: "member-2",
        name: "Sarah Chen",
        email: "sarah@syraven.ai",
        role: "Admin",
        avatar: "SC",
        status: "active",
      },
      {
        id: "member-3",
        name: "Marcus Reed",
        email: "marcus@syraven.ai",
        role: "Member",
        avatar: "MR",
        status: "active",
      },
    ],
  },
  {
    id: "ai-research",
    name: "AI Research",
    description:
      "Advanced agents, reasoning systems, multimodal intelligence and autonomous workflows.",
    initials: "AR",
    color: "from-cyan-500 to-blue-600",
    projects: 12,
    createdAt: "2025-02-08",
    members: [
      {
        id: "member-4",
        name: "Elena Rossi",
        email: "elena@syraven.ai",
        role: "Admin",
        avatar: "ER",
        status: "active",
      },
      {
        id: "member-5",
        name: "David Kim",
        email: "david@syraven.ai",
        role: "Member",
        avatar: "DK",
        status: "active",
      },
    ],
  },
  {
    id: "global-growth",
    name: "Global Growth",
    description:
      "Marketplace expansion, partnerships, enterprise adoption and international growth.",
    initials: "GG",
    color: "from-emerald-500 to-teal-600",
    projects: 9,
    createdAt: "2025-03-21",
    members: [
      {
        id: "member-6",
        name: "Olivia Bennett",
        email: "olivia@syraven.ai",
        role: "Admin",
        avatar: "OB",
        status: "active",
      },
      {
        id: "member-7",
        name: "James Wilson",
        email: "james@syraven.ai",
        role: "Viewer",
        avatar: "JW",
        status: "invited",
      },
    ],
  },
];

const roleStyles: Record<TeamRole, string> = {
  Owner:
    "border-violet-500/20 bg-violet-500/10 text-violet-300",
  Admin:
    "border-blue-500/20 bg-blue-500/10 text-blue-300",
  Member:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  Viewer:
    "border-slate-500/20 bg-slate-500/10 text-slate-300",
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [selectedTeamId, setSelectedTeamId] = useState(
    initialTeams[0]?.id ?? ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("Member");

  const filteredTeams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return teams;
    }

    return teams.filter((team) => {
      return (
        team.name.toLowerCase().includes(query) ||
        team.description.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, teams]);

  const selectedTeam = useMemo(() => {
    return teams.find((team) => team.id === selectedTeamId) ?? null;
  }, [selectedTeamId, teams]);

  const totalMembers = useMemo(() => {
    return teams.reduce((total, team) => total + team.members.length, 0);
  }, [teams]);

  const totalProjects = useMemo(() => {
    return teams.reduce((total, team) => total + team.projects, 0);
  }, [teams]);

  function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newTeamName.trim();

    if (!name) {
      return;
    }

    const initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("");

    const newTeam: Team = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name,
      description:
        newTeamDescription.trim() ||
        "A new collaborative workspace for your team.",
      initials: initials || "NT",
      color: "from-fuchsia-500 to-purple-600",
      projects: 0,
      createdAt: new Date().toISOString(),
      members: [
        {
          id: `owner-${Date.now()}`,
          name: "You",
          email: "you@syraven.ai",
          role: "Owner",
          avatar: "YO",
          status: "active",
        },
      ],
    };

    setTeams((currentTeams) => [newTeam, ...currentTeams]);
    setSelectedTeamId(newTeam.id);
    setNewTeamName("");
    setNewTeamDescription("");
    setShowCreateModal(false);
  }

  function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTeam) {
      return;
    }

    const name = inviteName.trim();
    const email = inviteEmail.trim();

    if (!name || !email) {
      return;
    }

    const avatar = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("");

    const member: TeamMember = {
      id: `member-${Date.now()}`,
      name,
      email,
      role: inviteRole,
      avatar: avatar || "NM",
      status: "invited",
    };

    setTeams((currentTeams) =>
      currentTeams.map((team) =>
        team.id === selectedTeam.id
          ? {
              ...team,
              members: [...team.members, member],
            }
          : team
      )
    );

    setInviteName("");
    setInviteEmail("");
    setInviteRole("Member");
    setShowInviteModal(false);
  }

  function removeMember(memberId: string) {
    if (!selectedTeam) {
      return;
    }

    setTeams((currentTeams) =>
      currentTeams.map((team) => {
        if (team.id !== selectedTeam.id) {
          return team;
        }

        return {
          ...team,
          members: team.members.filter((member) => member.id !== memberId),
        };
      })
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <section className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Workspace</span>
              <span className="text-white/30">/</span>
              <span>Teams</span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Teams
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">
              Organize your people, projects and collaboration into focused
              high-performance teams.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            <span className="text-lg leading-none">+</span>
            Create team
          </button>
        </section>

        {/* Statistics */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-white/45">Total teams</p>
            <p className="mt-3 text-3xl font-semibold">{teams.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-white/45">Team members</p>
            <p className="mt-3 text-3xl font-semibold">{totalMembers}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-white/45">Active projects</p>
            <p className="mt-3 text-3xl font-semibold">{totalProjects}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-white/45">Collaboration status</p>

            <div className="mt-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-lg font-medium">Operational</span>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          {/* Team list */}
          <aside className="rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-semibold">Your teams</h2>

                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/50">
                  {filteredTeams.length}
                </span>
              </div>

              <div className="relative mt-4">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search teams..."
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-white/25"
                />
              </div>
            </div>

            <div className="max-h-[650px] overflow-y-auto p-3">
              {filteredTeams.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-white/45">
                    No teams found.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTeams.map((team) => {
                    const isSelected = team.id === selectedTeamId;

                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setSelectedTeamId(team.id)}
                        className={[
                          "w-full rounded-xl border p-4 text-left transition",
                          isSelected
                            ? "border-white/20 bg-white/[0.08]"
                            : "border-transparent hover:border-white/10 hover:bg-white/[0.04]",
                        ].join(" ")}
                      >
                        <div className="flex gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${team.color} text-sm font-bold`}
                          >
                            {team.initials}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="truncate font-medium">
                                {team.name}
                              </h3>

                              {isSelected && (
                                <span className="h-2 w-2 rounded-full bg-white" />
                              )}
                            </div>

                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">
                              {team.description}
                            </p>

                            <div className="mt-3 flex items-center gap-3 text-xs text-white/40">
                              <span>{team.members.length} members</span>
                              <span>•</span>
                              <span>{team.projects} projects</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* Team details */}
          <section className="min-w-0">
            {!selectedTeam ? (
              <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <div>
                  <h2 className="text-xl font-semibold">Select a team</h2>
                  <p className="mt-2 text-sm text-white/45">
                    Choose a team from the left to view its members and details.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Team hero */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
                  <div className="p-6 sm:p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-4">
                        <div
                          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${selectedTeam.color} text-xl font-bold shadow-lg`}
                        >
                          {selectedTeam.initials}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-2xl font-semibold">
                              {selectedTeam.name}
                            </h2>

                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                              Active
                            </span>
                          </div>

                          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
                            {selectedTeam.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowInviteModal(true)}
                        className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm font-medium transition hover:bg-white/[0.1]"
                      >
                        Invite member
                      </button>
                    </div>

                    <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-white/35">
                          Members
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {selectedTeam.members.length}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wider text-white/35">
                          Projects
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {selectedTeam.projects}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wider text-white/35">
                          Created
                        </p>
                        <p className="mt-2 text-lg font-medium">
                          {formatDate(selectedTeam.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Members */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.025]">
                  <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-semibold">Team members</h2>
                      <p className="mt-1 text-sm text-white/40">
                        Manage access and responsibilities for this team.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-white/90"
                    >
                      Add member
                    </button>
                  </div>

                  <div className="divide-y divide-white/8">
                    {selectedTeam.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-sm font-semibold">
                            {member.avatar}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{member.name}</p>

                              {member.status === "invited" && (
                                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
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
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${roleStyles[member.role]}`}
                          >
                            {member.role}
                          </span>

                          {member.role !== "Owner" && (
                            <button
                              type="button"
                              onClick={() => removeMember(member.id)}
                              className="rounded-lg px-2.5 py-1.5 text-xs text-white/40 transition hover:bg-red-500/10 hover:text-red-300"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team activity */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">Team overview</h2>
                      <p className="mt-1 text-sm text-white/40">
                        Current collaboration snapshot.
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                      Healthy
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                      <p className="text-sm text-white/40">Participation</p>
                      <p className="mt-3 text-2xl font-semibold">94%</p>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-[94%] rounded-full bg-white" />
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                      <p className="text-sm text-white/40">Project velocity</p>
                      <p className="mt-3 text-2xl font-semibold">
                        {selectedTeam.projects}
                      </p>
                      <p className="mt-2 text-xs text-emerald-300">
                        Active initiatives
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                      <p className="text-sm text-white/40">Team health</p>
                      <p className="mt-3 text-2xl font-semibold">Excellent</p>
                      <p className="mt-2 text-xs text-white/35">
                        Collaboration metrics stable
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111113] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold">Create a new team</h2>
                <p className="mt-1 text-sm text-white/40">
                  Build a dedicated workspace for your collaborators.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-2 text-white/40 transition hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={createTeam} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Team name
                </label>

                <input
                  autoFocus
                  value={newTeamName}
                  onChange={(event) => setNewTeamName(event.target.value)}
                  placeholder="e.g. Global Intelligence"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-white/25"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Description
                </label>

                <textarea
                  value={newTeamDescription}
                  onChange={(event) =>
                    setNewTeamDescription(event.target.value)
                  }
                  placeholder="What will this team work on?"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-white/25"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Create team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111113] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold">
                  Invite team member
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  Add someone to {selectedTeam.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-lg p-2 text-white/40 transition hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={inviteMember} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Full name
                </label>

                <input
                  autoFocus
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  placeholder="Member name"
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
                  onChange={(event) => setInviteEmail(event.target.value)}
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
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Send invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}