/**
 * SYRAVEN — security headers, checked against the real Next config
 * tests/security/security-headers.test.ts
 *
 * next.config.ts imports only a type from "next", so this suite loads the
 * shipped config and calls its headers() -- not a copy of it.
 *
 * Phase 1 (North Star §2, Security): next.config.ts set no security
 * header at all -- no framing control, no nosniff, no HSTS.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import nextConfig from "../../next.config.ts";

async function headersForEveryPath(): Promise<Map<string, string>> {
  assert.equal(typeof nextConfig.headers, "function", "next.config.ts must define headers().");

  const rules = await nextConfig.headers!();
  const all = rules.find((rule) => rule.source === "/:path*");

  assert.ok(all, "Security headers must apply to every path.");

  return new Map(all.headers.map((header) => [header.key.toLowerCase(), header.value]));
}

void describe("Security headers", () => {
  void test("framing is refused, twice over", async () => {
    const headers = await headersForEveryPath();

    assert.match(headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(headers.get("x-frame-options"), "DENY");
  });

  void test("the CSP carries only directives that cannot break a page", async () => {
    /*
     * script-src / style-src / default-src would block inline code the app
     * has not been audited for. Adding one needs a browser run first.
     */
    const csp = await headersForEveryPath().then((h) => h.get("content-security-policy") ?? "");

    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.ok(!/(?:default|script|style|connect)-src/.test(csp), "Unaudited CSP fetch directives would break pages.");
  });

  void test("content sniffing, referrer leakage and device access are closed", async () => {
    const headers = await headersForEveryPath();

    assert.equal(headers.get("x-content-type-options"), "nosniff");
    assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");

    const permissions = headers.get("permissions-policy") ?? "";
    for (const feature of ["camera=()", "microphone=()", "geolocation=()"]) {
      assert.ok(permissions.includes(feature), `Permissions-Policy must deny ${feature}`);
    }
  });

  void test("HTTPS is enforced for at least a year, without binding other hosts", async () => {
    const hsts = await headersForEveryPath().then((h) => h.get("strict-transport-security") ?? "");
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);

    assert.ok(maxAge >= 31_536_000, "HSTS max-age must be at least one year.");
    assert.ok(!/includeSubDomains|preload/i.test(hsts), "includeSubDomains/preload bind other hosts: a deployment decision.");
  });

  void test("the framework does not announce itself", () => {
    assert.equal(nextConfig.poweredByHeader, false);
  });
});
