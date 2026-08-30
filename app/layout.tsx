import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SYRAVEN",
    template: "%s | SYRAVEN",
  },

  description:
    "SYRAVEN is an intelligent workspace for AI agents, projects, knowledge, collaboration, automation, and creative work.",

  keywords: [
    "SYRAVEN",
    "AI",
    "Artificial Intelligence",
    "AI Agents",
    "Workspace",
    "Automation",
    "Projects",
    "Knowledge",
    "Collaboration",
  ],

  authors: [
    {
      name: "SYRAVEN",
    },
  ],

  creator: "SYRAVEN",
  publisher: "SYRAVEN",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  icons: {
    icon: "/favicon.ico",
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "SYRAVEN",
    title: "SYRAVEN — Intelligent Workspace",
    description:
      "The intelligent workspace for AI agents, projects, knowledge, automation, and collaboration.",
  },

  twitter: {
    card: "summary_large_image",
    title: "SYRAVEN — Intelligent Workspace",
    description:
      "The intelligent workspace for AI agents, projects, knowledge, automation, and collaboration.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}