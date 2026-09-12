import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/*
  SYRAVEN — the build under test is not production

  WHY playwright.config.ts IS NOT ENOUGH ON ITS OWN

  The config refuses a production Supabase URL at load time. But the URL
  a Next.js server talks to is not decided at run time: NEXT_PUBLIC_*
  values are inlined into the compiled server and client code when
  `next build` runs. And `reuseExistingServer` lets Playwright drive
  whatever is already listening on the port.

  So a server built from .env.local talks to production no matter what
  the config resolved. That is not hypothetical. In one session every
  sign-in of a seeded run went to the live project's auth endpoint --
  401, no session, nothing written -- because the build under test had
  been made for production, and 19 compiled server files carried the
  production ref while none carried the test project's.

  WHAT THIS CHECKS

  The build artefacts themselves. It reads .next/server and fails if the
  production project ref is compiled into any of them. It makes no
  network request and needs no credential: the evidence is on disk,
  before any browser starts.

  WHEN IT DOES NOT APPLY

  When E2E_BASE_URL points at a non-local host, the server under test is
  not built from this checkout, so local artefacts say nothing about it
  and the check steps aside. With no .next directory there is nothing
  local to have been built wrongly.
*/

/**
 * The live project. Must equal PRODUCTION_PROJECT_REF in
 * playwright.config.ts; tests/security/e2e-build-target.test.ts asserts
 * the two stay the same.
 */
export const PRODUCTION_PROJECT_REF = "wpmbumtpcuahyqmdeqgf";

/** Compiled artefacts that can carry an inlined value. */
const SCANNED = /\.(?:c?js|mjs|json|html|rsc)$/;

function isLocal(baseUrl: string | undefined): boolean {
  if (!baseUrl) return true;

  try {
    const host = new URL(baseUrl).hostname;

    return (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "::1" ||
      host === "[::1]"
    );
  } catch {
    /*
      An unparseable override is treated as local, so it is checked
      rather than waved through -- the same fail-closed stance the
      config takes toward an indeterminate Supabase URL.
    */
    return true;
  }
}

export interface BuildTargetOptions {
  /** Repository root. Defaults to the working directory. */
  readonly root?: string;
  /** Defaults to process.env.E2E_BASE_URL. */
  readonly baseUrl?: string | undefined;
}

/**
 * Throws if the local build under test has the production Supabase
 * project compiled into it.
 */
export function assertBuildIsNotProduction(
  options: BuildTargetOptions = {},
): void {
  const root = options.root ?? process.cwd();
  const baseUrl =
    "baseUrl" in options ? options.baseUrl : process.env.E2E_BASE_URL;

  if (!isLocal(baseUrl)) return;

  const serverDir = join(root, ".next", "server");

  if (!existsSync(serverDir)) return;

  const pending: string[] = [serverDir];

  for (let dir = pending.pop(); dir !== undefined; dir = pending.pop()) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        pending.push(full);
        continue;
      }

      if (!SCANNED.test(entry.name)) continue;

      if (readFileSync(full, "utf8").includes(PRODUCTION_PROJECT_REF)) {
        throw new Error(
          `E2E refuses to run: the build under test has the production ` +
            `Supabase project (${PRODUCTION_PROJECT_REF}) compiled into ` +
            `${relative(root, full)}. NEXT_PUBLIC_* values are inlined at ` +
            `build time, so this server talks to production regardless of ` +
            `the E2E environment. Stop any server on the E2E port and let ` +
            `Playwright's webServer rebuild under .env.e2e.local -- see ` +
            `tests/e2e/README.md.`,
        );
      }
    }
  }
}
