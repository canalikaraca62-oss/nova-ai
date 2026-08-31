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

Current project structure follows this general architecture:

```text
/
├── app/                    # Next.js application routes
│   ├── api/                # Server API routes
│   └── ...
│
├── components/             # React UI components
│
├── contexts/               # React contexts
│
├── hooks/                  # React hooks
│
├── lib/                    # Core infrastructure
│   ├── knowledge/          # Knowledge infrastructure
│   ├── security/           # Security utilities
│   ├── tasks/              # Background task infrastructure
│   ├── auth.ts
│   ├── constants.ts
│   ├── permissions.ts
│   ├── plans.ts
│   ├── supabase.ts
│   ├── supabaseAdmin.ts
│   └── utils.ts
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