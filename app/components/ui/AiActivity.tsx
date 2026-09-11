"use client";

import type { ReactNode } from "react";

/*
  SYRAVEN — AI activity indicator

  WHAT THIS IS

  One visual vocabulary for what the system is actually doing, so a user
  can tell at a glance whether SYRAVEN is working, waiting on them, or
  finished — and can trust that what they see corresponds to something
  real.

  THE RULE THAT SHAPES IT

  Every state here is DRIVEN BY A PROP. This component owns no timer, no
  interval, no internal progress, and no self-advancing sequence. It
  cannot animate its way from "working" to "done" on its own, because
  the only thing that can move it is the caller passing a different
  state — and the caller gets that from a real response.

  That constraint is the whole point. A progress indicator that advances
  by itself is indistinguishable from one that reports real work, and
  this product has already shipped eleven surfaces that claimed work the
  system never did. An animated pulse is honest only while it is bound
  to something genuinely in flight.

  WHAT DRIVES IT TODAY

    thinking   /agents/[id] isRunning, /chat isSending
    approval   /agents/[id] payload.status === "awaiting_approval"
    done       a run that returned steps
    failed     a non-ok response or a thrown request

  There is deliberately NO "streaming" state. The chat page has no
  client-side token streaming — no reader, no decoder, no event source —
  so a token-by-token visual there would be theatre. If streaming is
  wired later, it earns a state then.

  MOTION

  Uses the existing `animate-syraven-pulse` utility rather than a new
  keyframe, so the product keeps one motion vocabulary. globals.css
  carries a global prefers-reduced-motion block covering
  `*, *::before, *::after`, so this indicator respects that setting
  without needing its own handling.
*/

/* -------------------------------------------------------------------------- */
/*                                   STATES                                   */
/* -------------------------------------------------------------------------- */

export type AiActivityState =
  /** Work is genuinely in flight — a request is open. */
  | "thinking"
  /** The plan is sound and a person must agree before it proceeds. */
  | "approval"
  /** Finished, with a result the caller can show. */
  | "done"
  /** The attempt failed. Not the same as "found nothing". */
  | "failed"
  /** Nothing is happening. Renders nothing at all. */
  | "idle";

interface StateStyle {
  readonly label: string;
  readonly dot: string;
  readonly text: string;
  readonly ring: string;
  /** Only in-flight work animates. A settled state is still. */
  readonly animated: boolean;
}

const STATES: Readonly<Record<Exclude<AiActivityState, "idle">, StateStyle>> = {
  thinking: {
    label: "Working",
    dot: "bg-primary",
    text: "text-foreground",
    ring: "border-primary/30 bg-primary/5",
    animated: true,
  },

  approval: {
    /*
      Deliberately not styled as an error. A plan stopping for a human is
      the safeguard working, and a user should be able to tell that from
      a failure at a glance.
    */
    label: "Needs your approval",
    dot: "bg-amber-400",
    text: "text-amber-200",
    ring: "border-amber-400/30 bg-amber-400/5",
    animated: false,
  },

  done: {
    label: "Completed",
    dot: "bg-emerald-400",
    text: "text-emerald-200",
    ring: "border-emerald-400/30 bg-emerald-400/5",
    animated: false,
  },

  failed: {
    label: "Failed",
    dot: "bg-destructive",
    text: "text-destructive",
    ring: "border-destructive/30 bg-destructive/5",
    animated: false,
  },
};

/* -------------------------------------------------------------------------- */
/*                                 COMPONENT                                  */
/* -------------------------------------------------------------------------- */

export interface AiActivityProps {
  state: AiActivityState;
  /**
   * What is actually happening, in the caller's words. Shown instead of
   * the generic label when given, so a real step name ("gmail.send:
   * awaiting approval") beats "Working".
   */
  detail?: ReactNode;
  className?: string;
}

export default function AiActivity({
  state,
  detail,
  className = "",
}: AiActivityProps) {
  if (state === "idle") {
    /*
      Renders nothing rather than an empty shell. A persistent chrome
      that merely goes quiet still suggests something is there.
    */
    return null;
  }

  const style = STATES[state];

  return (
    <div
      /*
        `status` and polite: this reports a condition as it changes, and
        should not interrupt whatever the user is reading. `alert` would
        be announced assertively on every transition.
      */
      role="status"
      aria-live="polite"
      className={[
        "inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5",
        "text-xs font-medium",
        style.ring,
        style.text,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "h-1.5 w-1.5 shrink-0 rounded-full",
          style.dot,
          /*
            Only in-flight work pulses. Animating a settled state would
            imply activity that has already stopped.
          */
          style.animated ? "animate-syraven-pulse" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />

      <span>{detail ?? style.label}</span>
    </div>
  );
}
