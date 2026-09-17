# SYRAVEN — MCP Audit

**Principle: minimum required tool authority.** An MCP server is added
only for a concrete engineering need, and the tools a session may call are
narrowed to what that need requires.

**Correction (2026-09-13, MCP hardening).** The first version of this
file described `playwright` as exposing "core tools only" and did not list
`browser_run_code_unsafe`; it also did not enumerate what `playwright-test`
exposes. Both were wrong. The lists below come from a direct MCP handshake
(`initialize` → `tools/list`) against the configured servers, not from
documentation.

## Before the bootstrap

No MCP servers at any scope (user, local, project) and no plugins. Nothing
was removed.

## Servers

The two Playwright servers come from the repository's own
`@playwright/test` 1.63.0 (`npx playwright …`), pinned by
`package-lock.json`. `supabase-test` (added 2026-09-17, founder-approved)
is `@supabase/mcp-server-supabase` pinned to an exact version. Every
project-scoped server needs the founder's approval in Claude Code
(`enabledMcpjsonServers`) before any session can use it.

| Name | Purpose | Data access | Write access | Necessity |
|---|---|---|---|---|
| `playwright` | Exploration and debugging of the running local build | Pages it opens; `--isolated` keeps the profile in memory | `.playwright-mcp/` (gitignored) and the workspace root | Browser verification and visual QA |
| `playwright-test` | Backing server for the planner / generator / healer agents | The app under `playwright.config.ts`, with its production guard | Plans in `specs/`, tests in `tests/e2e/` (through the agents' scope rules) | Required by the Playwright agents |
| `supabase-test` | Catalog verification and founder-authorized migration/behaviour checks for Phase 3 security batches | The **TEST** project `akhkukajdgayqwhedeoo` only, as `postgres`: every schema, including `auth` | Read **and write** on TEST (DDL and DML); founder decision 2026-09-17 | Replaces copy-paste SQL Editor round trips for TEST verification |

### `supabase-test` — pinned configuration

Enforced exactly by `tests/security/engineering-control-plane.test.ts`:

| Setting | Value | Why |
|---|---|---|
| Package | `@supabase/mcp-server-supabase@0.12.0` | Exact version; an unpinned `npx` pulls whatever `latest` is at launch |
| `--project-ref` | `akhkukajdgayqwhedeoo` | The test project in `E2E_SAFETY.md`. Production (`wpmbumtpcuahyqmdeqgf`) must not appear anywhere in the server definition |
| `--features` | `database,docs` | `account` (project listing/creation — the group that could reach other projects), `branching`, `storage`, `functions`, `development` and `debugging` stay off |
| `--read-only` | absent | TEST is read/write by founder decision |
| Credential | `env.SUPABASE_ACCESS_TOKEN = "${SUPABASE_ACCESS_TOKEN}"` | A reference expanded from the launching shell. No token in the file, no `--access-token` argument |

Tools exposed with these features (as announced to the session on
2026-09-17; no separate handshake was run): `execute_sql`,
`apply_migration`, `list_tables`, `list_extensions`, `list_migrations`,
`search_docs`.

**The project-ref pin is a configuration boundary, not an identity
boundary.** A Supabase personal access token is account-scoped: the same
token can reach production. What confines this server to TEST is
`--project-ref` plus the absence of the `account` group — the same class
of control as `--blocked-origins` above. The connected ref also cannot be
read back from inside the connection with these features.

`playwright` runs with `--headless --browser msedge --isolated
--output-dir .playwright-mcp --blocked-origins https://wpmbumtpcuahyqmdeqgf.supabase.co`
(reasons in the flag table below). `playwright-test` runs with
`--headless -c playwright.config.ts`, so every run passes the E2E
production guard.

## Actual tool surface (handshake, 2026-09-13)

### `playwright` — 24 tools

`browser_close`, `browser_resize`, `browser_console_messages`,
`browser_handle_dialog`, `browser_evaluate`, `browser_file_upload`,
`browser_drop`, `browser_find`, `browser_fill_form`, `browser_press_key`,
`browser_type`, `browser_navigate`, `browser_navigate_back`,
`browser_network_requests`, `browser_network_request`,
`browser_run_code_unsafe`, `browser_take_screenshot`, `browser_snapshot`,
`browser_click`, `browser_drag`, `browser_hover`, `browser_select_option`,
`browser_tabs`, `browser_wait_for`

### `playwright-test` — 89 tools

- **Test runner / agents (9):** `planner_save_plan`, `planner_setup_page`,
  `planner_submit_plan`, `generator_setup_page`, `generator_read_log`,
  `generator_write_test`, `test_list`, `test_run`, `test_debug`
- **Navigation & interaction:** `browser_navigate`, `browser_navigate_back`,
  `browser_navigate_forward`, `browser_reload`, `browser_click`,
  `browser_type`, `browser_press_sequentially`, `browser_press_key`,
  `browser_keydown`, `browser_keyup`, `browser_fill_form`,
  `browser_select_option`, `browser_check`, `browser_uncheck`,
  `browser_hover`, `browser_drag`, `browser_handle_dialog`,
  `browser_file_upload`, `browser_drop`, `browser_tabs`, `browser_close`,
  `browser_resize`, `browser_wait_for`, `browser_resume`
- **Coordinate mouse:** `browser_mouse_move_xy`, `browser_mouse_click_xy`,
  `browser_mouse_drag_xy`, `browser_mouse_down`, `browser_mouse_up`,
  `browser_mouse_wheel`
- **Inspection:** `browser_snapshot`, `browser_find`,
  `browser_take_screenshot`, `browser_console_messages`,
  `browser_console_clear`, `browser_network_requests`,
  `browser_network_request`, `browser_network_clear`,
  `browser_generate_locator`, `browser_highlight`, `browser_hide_highlight`,
  `browser_annotate`, `browser_get_config`, `browser_evaluate`
- **Assertions:** `browser_verify_element_visible`,
  `browser_verify_text_visible`, `browser_verify_list_visible`,
  `browser_verify_value`
- **Cookies:** `browser_cookie_list`, `browser_cookie_get`,
  `browser_cookie_set`, `browser_cookie_delete`, `browser_cookie_clear`
- **Web storage:** `browser_localstorage_{list,get,set,delete,clear}`,
  `browser_sessionstorage_{list,get,set,delete,clear}`
- **Saved login state:** `browser_storage_state`, `browser_set_storage_state`
- **Network control:** `browser_route`, `browser_route_list`,
  `browser_unroute`, `browser_network_state_set`
- **Artifacts:** `browser_pdf_save`, `browser_start_tracing`,
  `browser_stop_tracing`, `browser_start_recording`,
  `browser_stop_recording`, `browser_start_video`, `browser_stop_video`,
  `browser_video_chapter`, `browser_video_show_actions`,
  `browser_video_hide_actions`
- **Unsafe:** `browser_run_code_unsafe`

## Risk classification and decision

Deny rules live in the project settings, `.claude/settings.json`. A deny
rule applies to the whole session **including subagents**, so no tool an
agent lists in its own definition can be denied without breaking that
agent — those are recorded as residual risks instead.

| Capability | Tools | Risk | Needed by | Decision |
|---|---|---|---|---|
| Arbitrary code in the page | `browser_run_code_unsafe` (both) | High — any script, any page API | Nothing | **DENIED** on both servers |
| Cookie read/write | `browser_cookie_*` (5) | High — the Supabase auth cookies of the signed-in test account | Nothing | **DENIED** |
| localStorage / sessionStorage read/write | `browser_localstorage_*`, `browser_sessionstorage_*` (10) | High — session tokens and app state | Nothing | **DENIED** |
| Saved login state | `browser_storage_state`, `browser_set_storage_state` | High — exports or injects a whole signed-in session | Nothing | **DENIED** |
| Request routing | `browser_route`, `browser_route_list`, `browser_unroute` | High — mocked API responses make a page (or a generated test) "pass" on fabricated data | Nothing | **DENIED** |
| Tracing | `browser_start_tracing`, `browser_stop_tracing` | Medium — trace files capture request headers and cookies | Nothing (Playwright Test's own `trace: retain-on-failure` is unaffected) | **DENIED** |
| Local files into the page | `browser_drop` (both) | High — pushes local files (e.g. `.env.local`) into a page | Nothing | **DENIED** |
| File upload | `browser_file_upload` on `playwright` | High — same exfiltration path | Not needed for exploration | **DENIED** |
| File upload | `browser_file_upload` on `playwright-test` | High | **Listed by the planner and generator** | **ALLOWED — residual risk** |
| JavaScript evaluation | `browser_evaluate` (both) | High — can read non-httpOnly cookies (`document.cookie`) and web storage | **Listed by all three agents**; DOM and accessibility inspection | **ALLOWED — residual risk** |
| Request details | `browser_network_request` (both) | Medium — request/response headers may include the `Cookie` header | **Listed by the planner and healer** | **ALLOWED — residual risk** |
| Offline / network state | `browser_network_state_set` | Low | Testing offline behaviour | Allowed |
| Coordinate mouse, highlight, annotate, recording, video, PDF | various | Low — screen content only, written under output dirs | Occasional debugging | Allowed |
| Navigation, snapshot, screenshot, click/type, console, verify, test runner, planner/generator tools | various | Low — the purpose of the servers | Everything | Allowed |

### Result

| Server | Exposed | Denied | Available to a session |
|---|---|---|---|
| `playwright` | 24 | 3 | 21 |
| `playwright-test` | 89 | 24 | 65 |

The Playwright agents stay **narrower than the main session**: each agent
may call only the tools in its own `tools:` list — planner 24 (20 MCP),
generator 23 (19 MCP), healer 16 (9 MCP, plus file-editing tools bound by
its scope rules) — against 65 `playwright-test` tools available to the
main session. `browser_run_code_unsafe` was additionally removed from the
planner's list.

### Flags on `playwright`

| Flag | Reason |
|---|---|
| `--headless` | RAM; no window needed for evidence |
| `--browser msedge` | The server accepts branded channels only; Edge is present on every Windows machine |
| `--isolated` | No persistent profile → no signed-in session left on disk |
| `--output-dir .playwright-mcp` | One gitignored place for screenshots and snapshots |
| `--blocked-origins https://wpmbumtpcuahyqmdeqgf.supabase.co` | Defense in depth against direct calls to production Supabase. Playwright documents this as **not a security boundary** (redirects are not covered); `E2E_SAFETY.md` holds the actual procedure |

Not enabled: `--caps` (vision, pdf, devtools), `--storage-state`,
`--save-session`, `--user-data-dir`, `--allow-unrestricted-file-access`,
`--allowed-hosts *`.

## Residual risks (explicit, unchanged)

1. **`browser_evaluate` can read `document.cookie` and web storage.**
   `@supabase/ssr` auth cookies are readable by page script, so any session
   using either server can read the test account's auth cookie this way.
   Denying it would break all three agents and DOM inspection. Mitigation:
   the test account belongs to the **test** project only; `--isolated`
   means nothing persists after the session.
2. **`browser_network_request` can show request headers** including
   `Cookie`. Needed by the planner and healer. Same mitigation.
3. **`browser_file_upload` on `playwright-test`** can upload workspace
   files into a page. Needed by the planner and generator. Mitigation: the
   agents' scope rules; exploration of production is forbidden.
4. **Deny rules are enforced by Claude Code, not by the servers.** A
   client other than Claude Code (or a direct handshake) still sees all
   tools.
5. **Re-running `npx playwright init-agents`** regenerates the agent files
   and `.mcp.json`; `tests/security/engineering-control-plane.test.ts`
   fails if that removes the scope rules or the protections.
6. **`supabase-test`'s token is account-scoped.** A mistyped or removed
   `--project-ref` would point the same credential at production. The
   guard pins the exact arguments; the token itself cannot be narrowed.
7. **`supabase-test` writes to TEST as `postgres`** (superuser). A wrong
   statement changes TEST schema or data immediately. Mitigation: TEST
   holds no production data; destructive or schema changes follow the
   phase protocol, and behaviour checks run inside transactions that roll
   back.
8. **`execute_sql` returns database content** that may carry text written
   by any TEST user. The server fences it as untrusted data; it is never
   treated as instructions.

## Not added, and why

| Tool | Reason |
|---|---|
| `@playwright/mcp` (npm, 0.0.80) | Same server as `npx playwright mcp`, but a second, unpinned version |
| `@playwright/cli` (npm, 0.1.19) | `npx playwright cli` is bundled in 1.63 already |
| Playwright agent skills (`init-skills`) | A second browser-control channel beside MCP for the same job |
| A production database MCP | Never: it would put production data one tool call away. Production reads and writes stay founder-run in the SQL Editor |
| Any other MCP (GitHub, filesystem, …) | No concrete need |

## Verification

See `VERIFICATION_STATE.md`: handshake tool counts, every deny rule
matched against a real exposed tool, every agent tool confirmed exposed
and not denied, and `engineering-control-plane.test.ts`.
