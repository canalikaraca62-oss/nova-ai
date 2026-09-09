"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/**
 * SYRAVEN — Honest unavailable state
 * app/components/ui/CapabilityUnavailable.tsx
 *
 * PRODUCT INTEGRITY BOUNDARY.
 *
 * A capability that is not connected must SAY so. It must never fake a
 * delay and present an invented result.
 *
 * This component exists because four Studio surfaces used to do exactly
 * that: `/studio/image` ran an 1,800ms spinner labelled "Creating your
 * image" and then rendered a stock photograph from a hardcoded Unsplash
 * URL as the user's own generation, complete with a Download button.
 * `/studio/video` and `/studio/audio` did the same with their own
 * timers, and `/marketplace/[id]` reported "Installed" after 700ms
 * without installing anything.
 *
 * A user cannot tell a fabricated result from a real one. That is the
 * whole problem: the interface was making a claim the system could not
 * back. This component is the replacement for that claim.
 *
 * It states plainly:
 *
 *   - what is not available
 *   - why (no provider is configured — not "something went wrong")
 *   - what genuinely does work today, as a real link
 *
 * It deliberately offers no retry button. Retrying cannot succeed, and
 * a control that cannot succeed is the same lie in a smaller form.
 */

/* ==================================================
   TYPES
================================================== */

export type CapabilityUnavailableProps = {
  /** What the user tried to do, e.g. "Image generation". */
  capability: string;

  /**
   * The honest reason. Defaults to the configuration truth rather than
   * a vague failure, so nobody reads this as a transient error.
   */
  reason?: ReactNode;

  /** Real, working destinations. Never a link to another dead end. */
  alternatives?: ReadonlyArray<{
    href: string;
    label: string;
    description: string;
  }>;

  className?: string;
};

/* ==================================================
   COMPONENT
================================================== */

export default function CapabilityUnavailable({
  capability,
  reason,
  alternatives = [],
  className = "",
}: CapabilityUnavailableProps) {
  return (
    <section
      /*
       * `status`, not `alert`: this is a standing condition of the page,
       * not an event that just interrupted the user. An alert would be
       * announced assertively every time the region rendered.
       */
      role="status"
      aria-live="polite"
      className={[
        "flex w-full flex-col items-center",
        "rounded-2xl border border-dashed border-border",
        "bg-muted/20 p-8 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        aria-hidden="true"
        className={[
          "flex h-12 w-12 items-center justify-center",
          "rounded-2xl border border-border",
          "bg-background text-muted-foreground",
        ].join(" ")}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
        {capability} is not available yet
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {reason ?? (
          <>
            No provider is connected for this capability, so SYRAVEN
            cannot produce a real result. Rather than show you something
            invented, it does nothing.
          </>
        )}
      </p>

      {alternatives.length > 0 ? (
        <div className="mt-7 w-full max-w-md">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What works today
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {alternatives.map((alternative) => (
              <li key={alternative.href}>
                <Link
                  href={alternative.href}
                  className={[
                    "flex flex-col gap-0.5 rounded-xl",
                    "border border-border bg-background",
                    "px-4 py-3 text-left",
                    "transition-colors hover:bg-muted",
                    "focus-visible:outline-none",
                    "focus-visible:ring-2 focus-visible:ring-primary/30",
                  ].join(" ")}
                >
                  <span className="text-sm font-medium text-foreground">
                    {alternative.label}
                  </span>

                  <span className="text-xs leading-5 text-muted-foreground">
                    {alternative.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
