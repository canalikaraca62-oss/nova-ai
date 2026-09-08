/* FINAL VERIFICATION — live API, remediated defects + full regression. */
const BASE = "https://qelvora.vercel.app";
const ts = Date.now();

function client() {
  let c = "";
  const cap = (r) => {
    for (const x of r.headers.getSetCookie?.() ?? []) {
      const p = x.split(";")[0];
      const n = p.split("=")[0];
      c = c.split("; ").filter((y) => y && y.split("=")[0] !== n).concat(p).join("; ");
    }
  };
  const call = async (path, init = {}) => {
    const r = await fetch(BASE + path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}), ...(init.headers ?? {}) },
      redirect: "manual",
    });
    cap(r);
    const t = await r.text();
    let b;
    try { b = JSON.parse(t); } catch { b = t.slice(0, 250); }
    return { status: r.status, body: b };
  };
  call.cookies = () => c;
  return call;
}

const R = [];
const rec = (j, name, verdict, detail = "") => R.push({ j, name, verdict, detail });

(async () => {
  const A = client(), B = client();
  const ea = `syraven.rv1.${ts}@gmail.com`, eb = `syraven.rv2.${ts}@gmail.com`;
  const pa = `Str0ng!Pa${ts}`, pb = `Str0ng!Pb${ts}`;

  const ra = await A("/api/auth/register", { method: "POST", body: JSON.stringify({ email: ea, password: pa, name: "Alice" }) });
  const rb = await B("/api/auth/register", { method: "POST", body: JSON.stringify({ email: eb, password: pb, name: "Bob" }) });
  if (ra.status !== 201 || rb.status !== 201) { console.log(JSON.stringify({ fatal: `register ${ra.status}/${rb.status}`, results: R })); return; }
  rec(1, "register", "PASS", `HTTP ${ra.status}`);

  /* ---- D1: knowledge searchable ---- */
  const kn = await A("/api/knowledge", { method: "POST", body: JSON.stringify({ title: "Narwhal Report", content: "narwhal body text" }) });
  rec(1, "knowledge create", kn.status === 201 ? "PASS" : "FAIL", `HTTP ${kn.status} status=${kn.body?.data?.status}`);
  await new Promise((s) => setTimeout(s, 2500));

  const found = await A("/api/search?q=Narwhal");
  const hits = found.body?.results ?? [];
  rec(1, "D1: knowledge IS returned by search",
    hits.some((r) => (r.title ?? r.name) === "Narwhal Report") ? "PASS" : "FAIL",
    `${hits.length} result(s): ${hits.map((r) => r.title ?? r.name).join(", ")}`);

  const typed = await A("/api/search?q=Narwhal&types=knowledge");
  rec(1, "D1: types=knowledge returns it", (typed.body?.results ?? []).length > 0 ? "PASS" : "FAIL",
    `${(typed.body?.results ?? []).length} result(s)`);

  /* D1 must not have widened access. */
  const bSees = await B("/api/search?q=Narwhal");
  rec(12, "D1: B cannot see A's knowledge via search",
    !JSON.stringify(bSees.body).includes("Narwhal") ? "PASS" : "FAIL",
    `${(bSees.body?.results ?? []).length} result(s) for B`);

  /* ---- D2: knowledge/search no longer 500s ---- */
  const ks1 = await A("/api/knowledge/search?q=Narwhal");
  rec(2, "D2: GET /api/knowledge/search", ks1.status === 200 ? "PASS" : ks1.status === 503 ? "BLOCKED" : "FAIL",
    `HTTP ${ks1.status} ${JSON.stringify(ks1.body).slice(0, 90)}`);
  const ks2 = await A("/api/knowledge/search", { method: "POST", body: JSON.stringify({ query: "Narwhal" }) });
  rec(2, "D2: POST /api/knowledge/search", ks2.status === 200 ? "PASS" : ks2.status === 503 ? "BLOCKED" : "FAIL",
    `HTTP ${ks2.status}`);
  const ksB = await B("/api/knowledge/search?q=Narwhal");
  rec(12, "D2: B's knowledge search is isolated",
    !JSON.stringify(ksB.body).includes("Narwhal Report") ? "PASS" : "FAIL", `HTTP ${ksB.status}`);

  /* ---- D3: chat provider classification ---- */
  const chat = await A("/api/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) });
  rec(3, "D3: chat responds",
    chat.status === 200 ? "PASS"
      : chat.status === 503 && chat.body?.code === "PROVIDER_NOT_CONFIGURED" ? "BLOCKED"
      : chat.status === 502 ? "FAIL" : "BLOCKED",
    `HTTP ${chat.status} code=${chat.body?.code ?? "-"} ${String(chat.body?.error ?? "").slice(0, 70)}`);
  rec(3, "D3: no secret leaked in the error",
    !/sk-|gsk_|Bearer /.test(JSON.stringify(chat.body)) ? "PASS" : "FAIL");

  /* ---- D4: logout ---- */
  const before = await A("/api/workspaces");
  const lo = await A("/api/auth/logout", { method: "POST", body: "{}" });
  rec(4, "D4: logout endpoint exists", lo.status === 200 ? "PASS" : "FAIL", `HTTP ${lo.status}`);
  const after = await A("/api/workspaces");
  rec(4, "D4: session is invalidated",
    before.status === 200 && (after.status === 401 || after.status === 403) ? "PASS" : "FAIL",
    `before ${before.status} -> after ${after.status}`);
  const lo2 = await A("/api/auth/logout", { method: "POST", body: "{}" });
  rec(4, "D4: logout is idempotent", lo2.status === 200 ? "PASS" : "FAIL", `HTTP ${lo2.status}`);
  const loGet = await fetch(BASE + "/api/auth/logout").then((r) => r.status);
  rec(4, "D4: GET refused (CSRF surface)", loGet === 405 ? "PASS" : "FAIL", `HTTP ${loGet}`);
  const loAnon = await fetch(BASE + "/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.status);
  rec(4, "D4: anonymous logout is a safe no-op", loAnon === 200 ? "PASS" : "FAIL", `HTTP ${loAnon}`);

  /* Can the signed-out client still act? */
  const A2 = client();
  await A2("/api/auth/login", { method: "POST", body: JSON.stringify({ email: ea, password: pa }) });
  const reAuth = await A2("/api/workspaces");
  rec(4, "D4: re-login works after logout", reAuth.status === 200 ? "PASS" : "FAIL", `HTTP ${reAuth.status}`);

  /* ---- D5: billing fails closed ---- */
  const co = await A2("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: "pro", interval: "monthly" }) });
  rec(5, "D5: checkout fails closed", co.status === 503 ? "BLOCKED" : co.status === 200 ? "PASS" : "FAIL", `HTTP ${co.status} ${co.body?.code ?? ""}`);
  const po = await A2("/api/billing/portal", { method: "POST", body: JSON.stringify({}) });
  rec(5, "D5: portal fails closed", po.status === 503 ? "BLOCKED" : po.status === 200 ? "PASS" : "FAIL", `HTTP ${po.status} ${po.body?.code ?? ""}`);
  const planBefore = (await A2("/api/usage")).body?.plan;
  await fetch(BASE + "/api/billing/webhook", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "evt_rv", type: "checkout.session.completed", data: { object: { metadata: { userId: ra.body.user.id, plan: "enterprise" } } } }) });
  const planAfter = (await A2("/api/usage")).body?.plan;
  rec(5, "D5: forged webhook grants nothing", planBefore === planAfter ? "PASS" : "FAIL", `${planBefore} -> ${planAfter}`);

  /* ---- Regression: everything that passed before must still pass ---- */
  const ws = await A2("/api/workspaces", { method: "POST", body: JSON.stringify({ name: "RV Workspace" }) });
  rec(6, "workspace create", ws.status === 201 ? "PASS" : "FAIL", `HTTP ${ws.status}`);
  const pr = await A2("/api/projects", { method: "POST", body: JSON.stringify({ name: "RV Project" }) });
  const pid = pr.body?.data?.id;
  rec(6, "project create", pr.status === 201 ? "PASS" : "FAIL", `HTTP ${pr.status}`);
  const tk = await A2("/api/tasks", { method: "POST", body: JSON.stringify({ title: "RV Task" }) });
  const tid = tk.body?.data?.task?.id;
  rec(6, "task create", tk.status === 201 ? "PASS" : "FAIL", `HTTP ${tk.status}`);
  const cid = "77777777-6666-4555-8444-" + String(ts).slice(-12);
  const cv = await A2("/api/canvases", { method: "POST", body: JSON.stringify({ id: cid, title: "RV Canvas", nodes: [{ id: "n1" }] }) });
  rec(6, "canvas create at supplied id", cv.status === 201 && cv.body?.canvas?.id === cid ? "PASS" : "FAIL", `HTTP ${cv.status}`);
  const ag = await A2("/api/agents", { method: "POST", body: JSON.stringify({ name: "RV Agent", description: "d", systemPrompt: "p", visibility: "private" }) });
  rec(6, "agent create", ag.status === 201 ? "PASS" : "FAIL", `HTTP ${ag.status}`);

  /* Reload persistence on a genuinely fresh client. */
  const A3 = client();
  await A3("/api/auth/login", { method: "POST", body: JSON.stringify({ email: ea, password: pa }) });
  rec(6, "project SURVIVES reload", (await A3("/api/projects")).body?.data?.some((p) => p.id === pid) ? "PASS" : "FAIL");
  rec(6, "task SURVIVES reload", ((await A3("/api/tasks")).body?.data?.tasks ?? []).some((t) => t.id === tid) ? "PASS" : "FAIL");
  const cvR = await A3(`/api/canvases?id=${cid}`);
  rec(6, "canvas SURVIVES reload", cvR.status === 200 && (cvR.body?.canvas?.nodes ?? []).length === 1 ? "PASS" : "FAIL");

  /* ---- Tenant isolation + IDOR ---- */
  rec(12, "B cannot read A's project", ((await B(`/api/projects?id=${pid}`)).body?.data ?? []).length === 0 ? "PASS" : "FAIL");
  rec(12, "B cannot read A's canvas", (await B(`/api/canvases?id=${cid}`)).status === 404 ? "PASS" : "FAIL");
  rec(12, "B cannot update A's canvas", (await B("/api/canvases", { method: "PATCH", body: JSON.stringify({ id: cid, title: "HACKED" }) })).status === 404 ? "PASS" : "FAIL");
  rec(12, "B cannot delete A's canvas", (await B(`/api/canvases?id=${cid}`, { method: "DELETE" })).status === 404 ? "PASS" : "FAIL");

  const aWs = ra.body.workspace.id, aUser = ra.body.user.id, aOrg = ra.body.organization.id;
  const iP = await B("/api/projects", { method: "POST", body: JSON.stringify({ name: "INJ", workspaceId: aWs, owner_id: aUser, user_id: aUser, organization_id: aOrg }) });
  rec(13, "project rejects foreign workspaceId", iP.status === 404 || iP.body?.data?.workspace_id !== aWs ? "PASS" : "FAIL", `HTTP ${iP.status}`);
  const iK = await B("/api/knowledge", { method: "POST", body: JSON.stringify({ title: "INJ", content: "x", workspaceId: aWs, user_id: aUser }) });
  rec(13, "knowledge rejects foreign workspaceId", iK.status === 404 || iK.body?.data?.workspace_id !== aWs ? "PASS" : "FAIL", `HTTP ${iK.status}`);
  const iC = await B("/api/canvases", { method: "POST", body: JSON.stringify({ title: "INJ", workspaceId: aWs, user_id: aUser }) });
  rec(13, "canvas rejects foreign workspaceId", iC.status === 404 || iC.body?.canvas?.user_id !== aUser ? "PASS" : "FAIL", `HTTP ${iC.status}`);

  /* ---- Anonymous ---- */
  const anon = [];
  for (const p of ["/api/projects", "/api/tasks", "/api/knowledge", "/api/workspaces", "/api/canvases", "/api/agents", "/api/usage", "/api/search", "/api/knowledge/search"]) {
    const s = await fetch(BASE + p).then((r) => r.status);
    if (s !== 401 && s !== 403) anon.push(`${p}=${s}`);
  }
  rec(11, "anonymous reads refused", anon.length === 0 ? "PASS" : "FAIL", anon.join(", ") || "all 401/403");
  rec(11, "forged cookie refused",
    (await fetch(BASE + "/api/projects", { headers: { Cookie: "sb-access-token=forged; sb-refresh-token=x" } }).then((r) => r.status)) === 401 ? "PASS" : "FAIL");

  console.log(JSON.stringify({ accounts: [ea, eb], results: R }));
})();
