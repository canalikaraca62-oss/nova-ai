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
  metadataBase: new URL("https://qelvora.vercel.app"),

  title: {
    default: "QELVORA | AI Workspace",
    template: "%s | QELVORA",
  },

  description:
    "QELVORA is an intelligent AI workspace for conversations, document analysis, persistent memory, coding, and powerful AI tools.",

  keywords: [
    "QELVORA",
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
      name: "QELVORA",
    },
  ],

  creator: "QELVORA",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://qelvora.vercel.app",
    siteName: "QELVORA",

    title: "QELVORA | AI Workspace",

    description:
      "One workspace. Limitless intelligence. AI chat, document intelligence, persistent memory, coding and powerful AI tools.",
  },

  twitter: {
    card: "summary_large_image",

    title: "QELVORA | AI Workspace",

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