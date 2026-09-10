import type { ReactNode } from "react";

import AppShell from "@/app/components/layout/AppShell";
import DesktopSidebar from "@/app/components/layout/DesktopSidebar";
import MobileNav from "@/app/components/layout/MobileNav";
import CommandPalette from "@/app/components/command/CommandPalette";

/*
  SYRAVEN — Application chrome

  WHY THIS EXISTS

  AppShell, DesktopSidebar, MobileNav and CommandPalette were all
  written, all working, and mounted by nothing. 76 of the repository's
  82 components were unreachable, this chrome layer among them, while 37
  of 44 pages hand-rolled their own `<main className="min-h-screen">`.

  That is the root cause of the visual incoherence: with no shared
  shell, every page invented its own. It is why nine slightly different
  near-blacks existed, and why 458 ad-hoc `bg-white/[0.0x]` surfaces sit
  beside 1,223 semantic token usages. There was a design system; nothing
  used it.

  This is the first page mounted on it, deliberately: a pilot to prove
  the shell in a browser before the pattern is applied more widely.

  ONE <main>, NOT TWO

  AppShell emits its own `<main>`. A page underneath it must therefore
  render a plain container, not a second `<main>` — two main landmarks
  is invalid HTML and leaves a screen reader with an ambiguous document.
  `app/search/page.tsx` was adjusted accordingly.

  THE PALETTE IS SAFE TO MOUNT

  Every CommandPalette destination now resolves. /search was its one
  dead entry, and building this page is what fixed it.
*/

export default function SearchLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <AppShell
        sidebar={<DesktopSidebar />}
        mobileNav={<MobileNav />}
      >
        {children}
      </AppShell>

      {/* Cmd/Ctrl+K, global. */}
      <CommandPalette />
    </>
  );
}
