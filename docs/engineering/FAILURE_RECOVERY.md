# SYRAVEN — Failure Recovery

The repository and the evidence files are the truth. Chat memory is a
hint. Every recovery starts with `RECOVERY_PROTOCOL.md` steps 1–5.

| Failure | Detect | Recover | Never |
|---|---|---|---|
| **Claude session interrupted** | New session / summary | Run the recovery order; trust `git status` and state files over the summary | Resume "where it left off" from memory |
| **Windows restart** | Processes gone, ports free | Recovery order; re-measure memory; `.next` survives but check its target | Assume a server or watch is still running |
| **Network loss** | Provider/npm/Supabase errors (`fetch failed`, status 0) | Wait and retry the single step; distinguish from memory pressure (check free MB) | Record a network failure as a test result |
| **Terminal disconnect** | Command output lost | Re-run read-only checks; for writes, inspect `git diff` before re-running | Re-run a write blindly |
| **Browser crash** | Playwright `Target closed`, MCP errors | Check orphan browser processes; re-run the single spec | Mark the journey passed |
| **Build OOM** | Process killed, no `.next/BUILD_ID` | `RESOURCE_POLICY.md` → OOM; judge by `BUILD_ID`, not exit code | Retry in a loop; build in the background with other jobs |
| **Playwright failure** | Failing test + trace | Read the error context and trace; classify: app defect / test defect / environment | Let the healer "fix" an app defect in the test |
| **Test timeout** | `Timeout … exceeded` | Check memory and Supabase latency (cold auth ≈ 9 s) before touching timeouts | Raise timeouts to hide slowness |
| **MCP disconnect** | Tool calls fail | `claude mcp list`; restart the session if needed; MCP state is disposable (`--isolated`) | Switch to an unreviewed tool |
| **Git conflict** | Merge/rebase stops | Stop; show both sides; resolve with the founder if intent is unclear | `checkout --theirs/--ours` blindly, force-push |
| **Partially completed phase** | `PHASE_STATE.md` not updated, dirty tree | Account for every changed file; verify what exists; update state files; report PARTIAL with evidence | Declare PASS; start the next phase |
| **Interrupted mutation run** | Unexpected diff in a guarded file | Compare against intent; restore the file; re-run the baseline | Commit the mutant |
| **Stale `.next` target** | Build-target check throws | Rebuild under the E2E environment | Remove the guard |
