# SYRAVEN — Git Protocol

## Rules

1. **Inspect before changing.** `git status` and `git log --oneline -5`
   before any edit; account for every modified and untracked file.
2. **Small, coherent commits.** One concern per commit; the message says
   what changed and why, in plain language.
3. **Never mix phases.** Work from different phases, or from a phase and
   the control plane, goes in separate commits.
4. **Commit only after verification** relevant to the change (typecheck,
   lint on changed files, the affected suites) — and cite it in the report.
5. **Commit only on instruction** in this project: the founder decides
   when work is committed.
6. **Never rewrite history** (`rebase -i`, `commit --amend` on shared
   commits, `reset --hard`, `filter-*`) without explicit instruction.
7. **Never force-push.**
8. **Never commit** secrets, `.env*` files, production credentials,
   browser state (`.auth/`, storage-state JSON), traces, screenshots other
   than approved visual baselines, or build output. `.gitignore` covers
   these; `git status` is checked anyway.
9. **Tag meaningful milestones** (e.g. `phase-1-partial`) only when asked.
10. **On `main`, branch first** if the founder asks for a branch-based flow.

## Commit trailer

```text
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012BWaE3rGTPbozg3Nuqnai5
```

## Pending commits (as of 2026-09-13)

The working tree holds three efforts. Recommended split, **awaiting
founder instruction**:

| # | Commit | Files |
|---|---|---|
| 1 | Brain semantic bridge, profile honesty, nav, session logging, E2E fixture fix | `lib/search/knowledge*.ts`, `app/api/knowledge/**`, `app/knowledge/page.tsx`, `app/profile/page.tsx`, nav files, `lib/auth/session.ts`, `lib/search/{semantic,openaiEmbedding}.ts`, `lib/usage/meter.ts`, `tests/e2e/fixtures.ts`, `tests/security/{brain-semantic-bridge,profile-is-real}.test.ts` |
| 2 | Phase 1 — North Star (PARTIAL) | `lib/orchestration/{approvalStore,orchestrator}.ts`, `app/api/{action,agents/execute,agents/run,tasks/execute}/route.ts`, `tests/security/{architecture-invariants,approval-lifecycle,data-access}.test.ts`, `ARCHITECTURE_NORTH_STAR.md`, `docs/architecture/`, `AGENT_ARCHITECTURE.md`, `MIGRATION_APPROVAL_REQUIRED.md` |
| 3 | Engineering control plane | `CLAUDE.md`, `docs/engineering/`, `.mcp.json`, `.claude/agents/`, `specs/`, `.gitignore`, `package.json`, `playwright.config.ts`, `tests/e2e/README.md`, `tests/security/engineering-control-plane.test.ts` |

Caveats: `app/api/knowledge/route.ts` is touched only by commit 1;
`tests/security/data-access.test.ts` only by commit 2. Stage by path
(`git add <paths>`), never `git add -A`.

## Hooks

`package.json` runs `husky` on install. Hooks are never skipped
(`--no-verify`); a failing hook is investigated and fixed.
