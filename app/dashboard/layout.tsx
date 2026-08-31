"use client";

import type { ReactNode } from "react";

import { WorkspaceProvider } from "../context/WorkspaceContext";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return (
    <WorkspaceProvider>
      {children}
    </WorkspaceProvider>
  );
}