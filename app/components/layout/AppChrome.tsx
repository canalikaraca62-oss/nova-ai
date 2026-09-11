"use client";

import { useCallback, useState, type ReactNode } from "react";

import AppShell from "./AppShell";
import DesktopSidebar from "./DesktopSidebar";
import MobileNav from "./MobileNav";
import CommandPalette from "../command/CommandPalette";

/*
  SYRAVEN — The application chrome, in one place

  WHY THIS EXISTS

  AppShell, DesktopSidebar, MobileNav and CommandPalette were written,
  working, and mounted by nothing. 76 of the repository's 82 components
  were unreachable, this chrome layer among them, while 37 of 44 pages
  hand-rolled their own <main className="min-h-screen">.

  That is the root cause of the visual incoherence: with no shared
  shell, every page invented one. Nine slightly different near-blacks
  existed, and 458 ad-hoc bg-white/[0.0x] surfaces sit beside 1,223
  semantic token usages. There was a design system; nothing used it.

  Sections opt in through a thin layout.tsx that renders this. One
  definition, so the wiring is fixed in one file rather than repeated
  per section and drifting apart again — which is exactly how the
  product arrived at nine background colours.

  ONE <main>, NOT TWO

  AppShell emits the page's <main>. A page mounted under this chrome
  must therefore render a plain container, never a second <main>: two
  main landmarks is invalid HTML and leaves a screen reader with an
  ambiguous document. Converting a page means demoting its outer
  <main className="min-h-screen ..."> to a <div>.

  WHAT IS DELIBERATELY NOT WRAPPED

  Public and authentication pages. The landing page, pricing, terms,
  privacy, contact, login, register and password reset are not
  application surfaces — three of them mount their own Navbar and
  Footer, and putting app chrome around a marketing page would be a
  regression, not an improvement.

  Also excluded for now: pages carrying their own fixed-position
  background décor and hardcoded `text-white` (activity, apps, canvas,
  chat, teams, workspace). They convert mechanically, but `text-white`
  against a token background is a latent contrast bug, and inheriting
  it silently while claiming a coherent visual language would be the
  wrong kind of tidy.
*/

export default function AppChrome({
  children,
}: {
  children: ReactNode;
}) {
  /*
    The palette's open state lives here because two things open it: the
    global Cmd/Ctrl+K listener inside CommandPalette, and the sidebar's
    visible trigger. That trigger was a button with no handler, so the
    shortcut worked and the thing advertising the shortcut did not.

    Controlled rather than synthetic: dispatching a fake keydown would
    have worked and would have been a lie about how the two are
    connected.
  */
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openPalette = useCallback(() => {
    setPaletteOpen(true);
  }, []);

  return (
    <>
      <AppShell
        sidebar={
          <DesktopSidebar onOpenCommandPalette={openPalette} />
        }
        mobileNav={<MobileNav />}
      >
        {children}
      </AppShell>

      {/* Cmd/Ctrl+K, global. Every destination it offers resolves. */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </>
  );
}
