# SYRAVEN — AGENTS.md

## Project Identity

Syraven is a production-grade AI workspace platform.

The project is designed as a modular, secure, scalable application with support for:

- AI chat
- AI agents
- Knowledge systems
- File processing
- Search
- Projects
- Tasks
- Notifications
- Usage tracking
- Billing
- Voice
- Vision
- Workspace management
- Supabase-backed persistence

This repository must be treated as a production codebase.

Do not introduce placeholder architecture when a clean production-ready implementation is possible.

---

# Core Engineering Principles

All changes must prioritize:

1. Type safety
2. Security
3. Maintainability
4. Scalability
5. Clear architecture
6. Backward compatibility
7. Explicit error handling
8. Predictable behavior
9. Minimal duplication
10. Production readiness

Prefer simple, explicit, strongly typed implementations.

Do not add unnecessary abstractions.

Do not introduce hidden global state.

Do not silently swallow errors.

---

# Technology Stack

Primary stack:

- Next.js
- React
- TypeScript
- Supabase
- PostgreSQL
- Node.js

Supporting systems may include:

- OpenAI APIs
- Vector search
- Object storage
- Background tasks
- Rate limiting
- Observability
- Billing providers

---

# Repository Structure

Current project structure follows this general architecture.

**This section was wrong and has been corrected.** It described
`components/`, `contexts/` and `hooks/` at the repository root; they
live under `app/`. It also named four modules as core infrastructure
that were reachable from nothing:

- `lib/auth.ts` (1,295 lines) and `lib/permissions.ts` (749) formed a
  dead chain — a complete RBAC model with no Supabase integration,
  imported only by each other. The real boundary is `lib/auth/session.ts`
  and `lib/auth/authorization.ts`.
- `lib/utils.ts` never existed; the file was `lib/untils.ts`, and
  nothing imported it.
- `app/hooks/` held twelve hooks, none of them imported by any page.

All four are gone. Documenting a module as load-bearing when it is
orphaned is how the next person spends an afternoon reading the wrong
file.

```text
/
├── app/                    # Next.js application routes
│   ├── api/                # Server API routes
│   └── ...
│
├── app/components/         # React UI components
│                           #   (under app/, not the repository root)
│
├── app/context/            # React contexts — WorkspaceContext only
│
├── lib/                    # Core infrastructure
│   ├── agents/             # Agent definitions
│   ├── ai/                 # Provider abstraction, model registry
│   ├── api/                # Route boundary: withAuth, tenantGuard,
│   │                       #   usageGuard, aiPolicy
│   ├── auth/               # SECURITY BOUNDARY
│   │   ├── session.ts      #   verified caller identity
│   │   └── authorization.ts#   what that caller may reach
│   ├── billing/            # Plan resolution, idempotency
│   ├── integrations/       # Connector capability boundary
│   ├── knowledge/          # Knowledge infrastructure
│   ├── memory/             # Hierarchy, retrieval, context budget
│   ├── orchestration/      # Plan -> validate -> approve -> execute
│   ├── search/             # Semantic search and ingestion
│   ├── security/           # Security utilities
│   ├── tasks/              # Background task infrastructure
│   ├── usage/              # Entitlements and metering
│   ├── constants.ts
│   ├── plans.ts
│   ├── supabase.ts
│   └── supabaseAdmin.ts
│
├── services/               # Business/service layer
│   ├── types/              # Domain types
│   └── ...
│
├── public/                 # Static assets
│
├── .env.local              # Local secrets, never commit
├── AGENTS.md               # Agent instructions
├── CLAUDE.md               # Claude-specific project entry
├── package.json
├── tsconfig.json
└── README.md