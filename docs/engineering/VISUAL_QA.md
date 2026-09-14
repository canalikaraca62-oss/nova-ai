# SYRAVEN — Visual QA Foundation

**Status: foundation only.** Comparison settings exist; **no baseline
exists**. No page's appearance has been approved yet, and a baseline of an
unapproved design would freeze whatever happens to render today.

## What is configured (`playwright.config.ts`)

- `expect.toHaveScreenshot`: animations disabled, caret hidden, CSS scale,
  `maxDiffPixelRatio: 0.01`.
- `snapshotPathTemplate`: `tests/e2e/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}`.
- Viewport projects already in use: `chromium-desktop` (1440×900) and
  `chromium-mobile` (Pixel 7).

## Canonical viewports

| Name | Viewport | Project |
|---|---|---|
| Desktop | 1440 × 900 | `chromium-desktop` (exists) |
| Mobile | Pixel 7 (412 × 915) | `chromium-mobile` (exists) |
| Reduced motion | desktop + `reducedMotion: "reduce"` | per test via `page.emulateMedia({ reducedMotion: "reduce" })` |

## Critical pages (eventual baselines)

| Page | Route | Session | Notes |
|---|---|---|---|
| Landing | `/` | public | |
| Login | `/login` | public | |
| Home | `/dashboard` | test account | data-dependent → mask dynamic regions |
| Chat | `/chat` | test account | never send a message (paid) |
| Knowledge / Brain | `/knowledge` | test account | |
| Agents | `/agents` | test account | never run an agent (paid) |
| Approvals | `/approvals` | test account | |
| Projects | `/projects` | test account | seeded rows only |
| Work Graph | `/graph` | test account | WebGL → compare the readable structure view; mask the canvas |
| Autopilot | — | — | **no page exists yet**; add when it does |
| Settings | `/settings` | test account | |

## Baseline policy

1. A baseline is added only after the founder approves that page's look.
2. Baselines are generated on one platform (Windows, Playwright's bundled
   Chromium 1243) — snapshot names carry the platform, so a different OS
   needs its own set.
3. Dynamic content (times, counts, user data) is masked with `mask:`, never
   by loosening the ratio.
4. Updating a baseline (`--update-snapshots`) is a reviewed change with the
   before/after in the report — never a way to turn red green.

## Accessibility QA

- **Available now, no install:** Playwright's `toMatchAriaSnapshot` and
  role-based locators; existing guards `one-main-landmark`,
  `fields-are-labelled`, `dialogs-are-dialogs`, `motion-is-honest`.
- **Not installed:** an automated WCAG rule engine (`@axe-core/playwright`).
  It is the natural next addition when accessibility QA starts in
  earnest; it is left for founder approval rather than added before a
  concrete test needs it.
