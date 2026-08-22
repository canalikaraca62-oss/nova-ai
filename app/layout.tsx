import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ChatProvider } from "@/app/context/ChatContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://syraven.vercel.app"),

  title: {
    default: "SYRAVEN | AI Workspace",
    template: "%s | SYRAVEN",
  },

  description:
    "SYRAVEN is an intelligent AI workspace for conversations, document analysis, persistent memory, coding, and powerful AI tools.",

  keywords: [
    "SYRAVEN",
    "AI workspace",
    "AI assistant",
    "artificial intelligence",
    "AI chat",
    "document analysis",
    "persistent memory",
    "AI coding",
  ],

  authors: [
    {
      name: "SYRAVEN",
    },
  ],

  creator: "SYRAVEN",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://syraven.vercel.app",
    siteName: "SYRAVEN",

    title: "SYRAVEN | AI Workspace",

    description:
      "One workspace. Limitless intelligence. AI chat, document intelligence, persistent memory, coding and powerful AI tools.",
  },

  twitter: {
    card: "summary_large_image",

    title: "SYRAVEN | AI Workspace",

    description:
      "One workspace. Limitless intelligence.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white">
        <ChatProvider>
          {children}
        </ChatProvider>
      </body>
    </html>
  );
}