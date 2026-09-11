import type { ReactNode } from "react";

import AppChrome from "@/app/components/layout/AppChrome";

/*
  /activity runs inside the shared application chrome.

  The wiring lives in AppChrome so it is defined once rather than
  repeated per section — see that file for why the shell exists and
  what is deliberately left outside it.
*/

export default function ActivityLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppChrome>{children}</AppChrome>;
}
