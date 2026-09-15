// SYRAVEN — Batch 1 hostile two-user probe (TEST project ONLY)
//
// Proves the membership fortress (supabase/migrations/
// 20260915120000_syraven_membership_fortress.sql) against a real database,
// acting as two ordinary signed-in users (A = attacker, B = victim) through
// PostgREST. It never uses a service-role key.
//
// DO NOT RUN until the founder has applied the migration to the TEST
// project. It writes and then removes rows in TEST. It refuses to run
// against the production project, against an unknown target, and without
// the explicit flag below.
//
// Usage (TEST only):
//   node scripts/security/probe-batch1.mjs --i-understand-this-writes-to-the-test-project
//
// Reads ONLY .env.e2e.local (or the process environment):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
//   (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
//   E2E_TEST_EMAIL, E2E_TEST_PASSWORD, E2E_TEST_EMAIL_2, E2E_TEST_PASSWORD_2

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const PRODUCTION_PROJECT_REF = "wpmbumtpcuahyqmdeqgf";
const FLAG = "--i-understand-this-writes-to-the-test-project";

function loadTestEnvironment() {
  const values = { ...process.env };
  const file = join(process.cwd(), ".env.e2e.local");

  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && values[match[1]] === undefined) {
        values[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }

  return values;
}

function refuse(message, code) {
  console.error(`PROBE REFUSED: ${message}`);
  process.exit(code);
}

// ---- Target guard: runs before any request -------------------------------

if (!process.argv.includes(FLAG)) {
  refuse(`pass ${FLAG} to confirm this writes to the TEST project.`, 1);
}

const env = loadTestEnvironment();
const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const anonKey = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
const ref = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(url)?.[1] ?? null;

if (!ref) {
  refuse("the Supabase URL is missing or not a *.supabase.co project URL.", 2);
}

if (ref === PRODUCTION_PROJECT_REF) {
  refuse("this is the PRODUCTION project. The probe runs against TEST only.", 3);
}

if (!anonKey) refuse("no anon/publishable key.", 2);

const users = {
  A: { email: env.E2E_TEST_EMAIL, password: env.E2E_TEST_PASSWORD },
  B: { email: env.E2E_TEST_EMAIL_2, password: env.E2E_TEST_PASSWORD_2 },
};

for (const [name, user] of Object.entries(users)) {
  if (!user.email || !user.password) refuse(`test user ${name} is not configured.`, 2);
}

// ---- Helpers --------------------------------------------------------------

async function signIn(user) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token || !body.user?.id) {
    refuse(`sign-in failed (${response.status}).`, 4);
  }
  return { token: body.access_token, id: body.user.id };
}

async function rest(session, method, path, payload) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

const denied = (result) =>
  result.status >= 400 || (Array.isArray(result.data) && result.data.length === 0);
const allowed = (result) => result.status >= 200 && result.status < 300;

const results = [];
function expect(name, ok, detail) {
  results.push({ name, result: ok ? "PASS" : "FAIL", status: detail.status });
}

// ---- Probe ----------------------------------------------------------------

const tag = `probe-b1-${randomUUID().slice(0, 8)}`;
const A = await signIn(users.A);
const B = await signIn(users.B);
const created = { orgs: [], workspaces: [], tasks: [], bOrgs: [], bWorkspaces: [] };

try {
  // A's own organization, owner membership and two workspaces.
  const org = await rest(A, "POST", "organizations", { name: tag, slug: tag, owner_id: A.id });
  expect("A creates an organization it owns", allowed(org), org);
  const orgId = org.data?.[0]?.id;
  created.orgs.push(orgId);

  const own = await rest(A, "POST", "organization_members", {
    organization_id: orgId, user_id: A.id, role: "owner", status: "active",
  });
  expect("A creates its own owner membership", allowed(own), own);

  // I1: A cannot insert B, with any role.
  const injectMember = await rest(A, "POST", "organization_members", {
    organization_id: orgId, user_id: B.id, role: "member", status: "active",
  });
  expect("A cannot insert B as a member", denied(injectMember), injectMember);

  const injectOwner = await rest(A, "POST", "organization_members", {
    organization_id: orgId, user_id: B.id, role: "owner", status: "active",
  });
  expect("A cannot insert B as an owner", denied(injectOwner), injectOwner);

  // I2 / I4: the owner row cannot be rewritten or removed by a client.
  const demote = await rest(A, "PATCH", `organization_members?organization_id=eq.${orgId}&user_id=eq.${A.id}`, { role: "admin" });
  expect("the owner membership cannot be updated", denied(demote), demote);

  const moveOrg = await rest(A, "PATCH", `organization_members?organization_id=eq.${orgId}&user_id=eq.${A.id}`, { user_id: B.id });
  expect("a membership's user_id cannot be changed", denied(moveOrg), moveOrg);

  const removeOwner = await rest(A, "DELETE", `organization_members?organization_id=eq.${orgId}&user_id=eq.${A.id}`);
  expect("the owner membership cannot be deleted", denied(removeOwner), removeOwner);

  // I6: owner_id is not client-updatable.
  const transfer = await rest(A, "PATCH", `organizations?id=eq.${orgId}`, { owner_id: B.id });
  expect("organizations.owner_id cannot be changed", denied(transfer), transfer);

  // I7: destructive delete guard.
  const ws1 = await rest(A, "POST", "workspaces", { organization_id: orgId, name: `${tag}-1`, slug: `${tag}-1`, created_by: A.id });
  const ws2 = await rest(A, "POST", "workspaces", { organization_id: orgId, name: `${tag}-2`, slug: `${tag}-2`, created_by: A.id });
  const ws1Id = ws1.data?.[0]?.id;
  const ws2Id = ws2.data?.[0]?.id;
  created.workspaces.push(ws1Id, ws2Id);

  // B plants a row it owns that references A's workspace (the workspace
  // reference is not yet bound by RLS; Batch 4).
  const planted = await rest(B, "POST", "tasks", { user_id: B.id, title: tag, workspace_id: ws1Id });
  const plantedId = planted.data?.[0]?.id;
  if (plantedId) created.tasks.push({ owner: "B", id: plantedId });

  const blocked = await rest(A, "DELETE", `workspaces?id=eq.${ws1Id}`);
  expect("a workspace holding another user's task cannot be deleted", blocked.status >= 400, blocked);

  const blockedOrg = await rest(A, "DELETE", `organizations?id=eq.${orgId}`);
  expect("an organization cascade into that workspace is refused", blockedOrg.status >= 400, blockedOrg);

  const ownTask = await rest(A, "POST", "tasks", { user_id: A.id, title: tag, workspace_id: ws2Id });
  if (ownTask.data?.[0]?.id) created.tasks.push({ owner: "A", id: ownTask.data[0].id });
  const ownDelete = await rest(A, "DELETE", `workspaces?id=eq.${ws2Id}`);
  expect("a workspace holding only the caller's own data can be deleted", allowed(ownDelete), ownDelete);

  const ws3 = await rest(A, "POST", "workspaces", { organization_id: orgId, name: `${tag}-3`, slug: `${tag}-3`, created_by: A.id });
  const ws3Id = ws3.data?.[0]?.id;
  created.workspaces.push(ws3Id);
  const emptyDelete = await rest(A, "DELETE", `workspaces?id=eq.${ws3Id}`);
  expect("an empty workspace can be deleted", Boolean(ws3Id) && allowed(emptyDelete), emptyDelete);

  // I5: the victim still resolves only to an organization it owns. The
  // query below is the one resolveOrganizationId runs, issued as B.
  const bOrg = await rest(B, "POST", "organizations", { name: `${tag}-b`, slug: `${tag}-b`, owner_id: B.id });
  const bOrgId = bOrg.data?.[0]?.id;
  created.bOrgs.push(bOrgId);
  await rest(B, "POST", "organization_members", {
    organization_id: bOrgId, user_id: B.id, role: "owner", status: "active",
  });

  const resolved = await rest(
    B,
    "GET",
    `organization_members?select=organization_id,organizations!inner(owner_id)` +
      `&user_id=eq.${B.id}&status=eq.active&role=eq.owner` +
      `&organizations.owner_id=eq.${B.id}&order=created_at.asc&limit=1`,
  );
  const resolvedOrg = Array.isArray(resolved.data) ? resolved.data[0]?.organization_id : undefined;
  expect(
    "the victim resolves to its own organization, never the attacker's",
    Boolean(bOrgId) && resolvedOrg === bOrgId && resolvedOrg !== orgId,
    resolved,
  );

  const intoAttacker = await rest(B, "POST", "workspaces", { organization_id: orgId, name: `${tag}-x`, slug: `${tag}-x`, created_by: B.id });
  expect("the victim cannot create a workspace in the attacker's organization", denied(intoAttacker), intoAttacker);

  const intoOwn = await rest(B, "POST", "workspaces", { organization_id: bOrgId, name: `${tag}-b1`, slug: `${tag}-b1`, created_by: B.id });
  if (intoOwn.data?.[0]?.id) created.bWorkspaces.push(intoOwn.data[0].id);
  expect("the victim's workspace lands in its own organization", allowed(intoOwn) && intoOwn.data?.[0]?.organization_id === bOrgId, intoOwn);
} finally {
  // Cleanup: each user removes only rows it created.
  for (const task of created.tasks) {
    await rest(task.owner === "A" ? A : B, "DELETE", `tasks?id=eq.${task.id}`);
  }
  for (const id of created.workspaces.filter(Boolean)) {
    await rest(A, "DELETE", `workspaces?id=eq.${id}`);
  }
  for (const id of created.orgs.filter(Boolean)) {
    await rest(A, "DELETE", `organizations?id=eq.${id}`);
  }
  for (const id of created.bWorkspaces.filter(Boolean)) {
    await rest(B, "DELETE", `workspaces?id=eq.${id}`);
  }
  for (const id of created.bOrgs.filter(Boolean)) {
    await rest(B, "DELETE", `organizations?id=eq.${id}`);
  }
}

console.log(JSON.stringify({ target: "TEST", ref, tag, results }, null, 2));
process.exit(results.every((entry) => entry.result === "PASS") ? 0 : 5);
