# SYRAVEN — Security Test Matrix

Target for every important boundary: a **positive** test (the allowed
path works), a **negative** test (the forbidden path is refused), a
**bypass** test (an attempt to get around the control fails) and a
**regression** test (a specific past defect stays fixed).

**How this matrix was built:** suites are mapped by their own titles and
by the work done on them in recorded sessions. Cells mean:
`✓` present · `M` present and mutation-verified · `?` not audited per-test
yet · `✗` known missing. A per-test audit is future work; nothing here was
upgraded without evidence.

| Boundary | Suites | Positive | Negative | Bypass | Regression |
|---|---|---|---|---|---|
| Authentication (session, bearer, middleware) | `api-auth-boundary`, `bearer-token`, `middleware-gate` | ✓ | ✓ | ✓ | ✓ |
| Authorization / tenant guard | `authorization-boundary`, `workspace-tenant-guard`, `workspaces-route`, arch. I-1/I-2 | ✓ | ✓ | M (I-1, I-2 echo) | ✓ |
| Data access / RLS client use | `data-access`, `defect-remediation` | ✓ | ✓ | ? | ✓ |
| RLS (live database) | — | ✗ | ✗ | ✗ | ✗ |
| IDOR (ownership on write paths) | `seeded-journey.spec.ts` (403/404), route suites | ✓ (browser) | ✓ | ? | ✓ |
| Approvals | `approval-fails-closed`, `approval-lifecycle`, `agent-approvals-migration`, arch. I-5/I-6 | ✓ | ✓ | M | M |
| Agent / action execution | `agent-orchestration`, `agent-execution`, arch. I-4/I-7 | ✓ | ✓ | M | M |
| AI policy / provider | `ai-provider`, `model-routing`, `provider-failover`, arch. I-3 | ✓ | ✓ | M | M |
| Usage / rate limits / entitlement | `usage-enforcement`, `usage-write-path` | ✓ | ✓ | ? | ✓ |
| Billing | `billing-security`, `billing-canonical-plans`, arch. I-12 | ✓ | ✓ | M (I-12) | ✓ |
| Search / semantic isolation | `search-isolation`, `search-route`, `semantic-isolation`, `semantic-rpc-integration`, `semantic-mutation` | ✓ | ✓ | M | M |
| Brain ingestion / embedding | `embedding-ingest`, `embedding-mutation`, `ingest-cost-control`, `openai-embedding-client`, `brain-semantic-bridge` | ✓ | ✓ | M (earlier) / ? (bridge) | ✓ |
| Memory / context | `memory-isolation`, arch. I-16 | ✓ | ✓ | M (I-16) | ✓ |
| Graph | `graph-edges-are-real`, arch. I-11 | ✓ | ✓ | ? | ✓ |
| Connectors | `connector-capabilities`, `connector-surface-is-honest`, `integration-connections-migration`, arch. I-13 | ✓ | ✓ | ? | ✓ |
| Autopilot queue | `autopilot-queue`, arch. I-8/I-14 | ✓ | ✓ | M (I-8) | ✓ |
| Observability / redaction | `observability-redaction` | ✓ | ✓ | ? | ✓ |
| E2E production safety | `e2e-production-guard`, `e2e-build-target`, `engineering-control-plane` | ✓ | ✓ | M (earlier) | ✓ |
| Fabricated results / honest UI | `fabricated-results`, `no-false-claims`, `no-dead-controls`, `activity-is-real`, `profile-is-real`, `home-command-center` | ✓ | ✓ | ? | ✓ |
| Migrations | `migration-integrity`, `semantic-ranking-migration`, `agent-approvals-migration`, `integration-connections-migration` | ✓ | ✓ | ? | ✓ |

## Known gaps (priority order)

1. **No live RLS tests.** Every RLS claim is proven by policy text and
   fake clients, not by querying the test database as two different
   users. Highest-value addition: a two-account isolation check against
   the test project.
2. **`public.projects` has no RLS.** Explicit filters are counted by tests
   (`activity-is-real`), but a missed filter in a new route is only caught
   if that route is added to a filter-count test.
3. **Per-test audit** of the `?` cells.
4. **Security headers** (CSP, HSTS, frame options) are neither set nor tested.

## Rules

- Add invariants and tests; never delete a difficult one. A test that
  cannot pass yet becomes a `todo` with the exact reason.
- New security guards are mutation-verified before they are reported.
