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
Claude-Session: <the URL of the session that made the change>
```

## Commit record

Nothing from the 2026-09-13 working tree is pending. Its three efforts
were committed on 2026-09-14, in the recommended split:

| Commit | Effort |
|---|---|
| `9837f30` | Brain semantic bridge, an honest profile, credential-failure logging |
| `a4e052d` | Phase 1 — North Star architecture, database write boundaries, approval gate |
| `3314baa` | Engineering control plane |

Phase 2 is committed batch by batch after `3314baa`, locally only and
never pushed. The per-batch record is `PURIFICATION_EVIDENCE.md`; the
current state is `PHASE_STATE.md` and `PROJECT_STATE.md`. Stage by path
(`git add <paths>`), never the whole tree.

## Hooks

`package.json` runs `husky` on install. Hooks are never skipped
(`--no-verify`); a failing hook is investigated and fixed.
