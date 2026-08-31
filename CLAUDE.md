# SYRAVEN - CLAUDE CODE PROJECT INSTRUCTIONS

## Project Identity

Syraven is a long-lived, enterprise-grade AI workspace platform.

The system is designed for scalable collaboration, AI-assisted knowledge,
projects, tasks, files, messaging, search, notifications, usage tracking,
authentication, workspace isolation, and secure backend operations.

This repository must be treated as production infrastructure.

Prioritize:

1. Correctness
2. Security
3. Type safety
4. Maintainability
5. Scalability
6. Clear architecture
7. Explicit authorization boundaries

Do not optimize for the smallest possible code change if that change creates
technical debt or weakens the architecture.

---

# PRIMARY RULES

Before making changes, read:

@AGENTS.md

`AGENTS.md` is the primary engineering and security rule set for this repository.

All instructions in `AGENTS.md` must be followed.

Do not create code that conflicts with:

- TypeScript strictness rules
- Security rules
- Authentication rules
- Authorization rules
- Workspace isolation
- Supabase boundaries
- API route architecture
- Error handling requirements

---

# PROJECT ARCHITECTURE

The project uses a layered architecture.

Primary areas include:

```text
app/
lib/
services/
types/
components/