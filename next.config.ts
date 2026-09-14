import type { NextConfig } from "next";

/*
  Security headers, on every response.

  Only directives that cannot break a page are set. There is no
  script-src / style-src policy yet: the app has not been audited for
  inline scripts and styles, and a CSP that blocked them would take pages
  down with no browser run to catch it. The CSP therefore carries only
  frame-ancestors, base-uri and object-src.

  - frame-ancestors 'none' + X-Frame-Options: DENY -- the app never
    embeds itself (no iframe anywhere in app/), so any framing is
    clickjacking.
  - Permissions-Policy -- no page captures audio or video or reads
    location (voice works from uploaded files), so all are denied.
  - Strict-Transport-Security -- two years, without includeSubDomains or
    preload: both bind other hosts under the production domain, which is
    a deployment decision, not a code one.

  Checked by tests/security/security-headers.test.ts against this file.
*/
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
    ],
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
