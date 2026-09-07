"use client";

/**
 * SYRAVEN — Contact / Talk to Sales
 * app/contact/page.tsx
 *
 * Phase 12 (see IMPLEMENTATION_PLAN.md).
 *
 * WHY THIS PAGE EXISTS
 *
 * Three production CTAs pointed at `/contact`, a route that did not
 * exist:
 *
 *   app/pricing/page.tsx  — "Talk to Sales"
 *   app/pricing/page.tsx  — the Enterprise plan CTA (`ctaHref`)
 *   app/billing/page.tsx  — enterprise checkout (`router.push`)
 *
 * All three returned a 404, so the entire enterprise sales path was
 * dead. Enterprise is the one plan with no self-serve checkout, which
 * makes this the only route to a sale for it.
 *
 * WHY IT IS MAILTO AND NOT A FORM
 *
 * A form would need a submission endpoint, a store, spam protection and
 * a notification path — none of which exist, and building them is a
 * feature, not a Phase 12 launch fix. A `mailto:` link works today with
 * no backend, and cannot silently drop an enquiry the way an unwired
 * form would. AGENTS.md forbids placeholder architecture; a form that
 * POSTs nowhere is exactly that.
 *
 * The address matches the one already used in app/terms/page.tsx, so
 * this introduces no new contact channel to operate.
 */

import Link from "next/link";

const SALES_EMAIL = "legal@syraven.ai";

const ENTERPRISE_POINTS: readonly string[] = [
  "Custom AI infrastructure and capacity",
  "SSO / SAML and advanced access control",
  "Dedicated support with a custom SLA",
  "Security review and compliance documentation",
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <nav aria-label="Breadcrumb" className="mb-10">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg text-sm text-white/60 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <span aria-hidden="true">←</span>
            Back to pricing
          </Link>
        </nav>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Talk to sales
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-7 text-white/60">
          Enterprise plans are configured with your team rather than
          bought self-serve. Tell us what you need and we will get back
          to you.
        </p>

        <section
          aria-labelledby="enterprise-heading"
          className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8"
        >
          <h2
            id="enterprise-heading"
            className="text-sm font-bold uppercase tracking-[0.16em] text-white/50"
          >
            Enterprise includes
          </h2>

          <ul className="mt-5 space-y-3">
            {ENTERPRISE_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-400"
                >
                  ✓
                </span>

                <span className="text-sm leading-6 text-white/75">
                  {point}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/*
              Explicit light-on-dark pairing. The billing audit in this
              phase specifically checked for buttons whose colours are
              inherited and can break to dark-on-dark; both colours here
              are stated on the element itself.
            */}
            <a
              href={`mailto:${SALES_EMAIL}?subject=SYRAVEN%20Enterprise%20enquiry`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-black transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b] active:scale-[0.98]"
            >
              Email sales
              <span aria-hidden="true">→</span>
            </a>

            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 px-6 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Compare plans
            </Link>
          </div>

          <p className="mt-6 text-sm text-white/50">
            Prefer to write directly?{" "}
            <a
              href={`mailto:${SALES_EMAIL}`}
              className="font-medium text-white underline underline-offset-4 transition hover:text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {SALES_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
