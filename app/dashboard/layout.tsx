"use client";

import type { ReactNode } from "react";

import { WorkspaceProvider } from "../context/WorkspaceContext";
import AppChrome from "@/app/components/layout/AppChrome";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return (
    <WorkspaceProvider>
      <AppChrome>{children}</AppChrome>
    </WorkspaceProvider>
  );
}