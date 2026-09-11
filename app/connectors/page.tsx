import Link from "next/link";

import {
  capabilitiesForProvider,
  providerLabel,
  requiresApproval,
  resolveAvailability,
  type CapabilityDefinition,
  type CapabilityRisk,
} from "@/lib/integrations/capabilities";
import { INTEGRATION_PROVIDERS } from "@/services/integrations/types";

/*
  SYRAVEN — Connectors

  WHAT THIS PAGE IS

  The catalogue of what SYRAVEN could do on your behalf in another
  service, and an honest statement of why none of it is available yet.

  Every line here is server-side truth, not illustration. The providers,
  the capabilities under each one, their plain-language descriptions and
  their risk levels all come from lib/integrations/capabilities.ts --
  the same definitions the orchestrator would consult before letting an
  agent reach outside the product.

  WHY THERE IS NO CONNECT BUTTON

  Connecting an account needs three things this deployment does not have:

    1. A table to record the connection. The migration exists and is
       written -- supabase/migrations/20260909120000_syraven_integration
       _connections.sql -- but has NOT been applied. Applying it is a
       decision for a person, not something this page can do.

    2. OAuth client credentials for each provider, which are secrets.

    3. A user actually authorizing SYRAVEN with that provider.

  A Connect button would be a control that cannot act. The product has
  been carrying a dozen of those and they are being removed, not added.

  WHAT resolveAvailability ACTUALLY RETURNS HERE

  Called with a null connection -- which is the real state, since no
  connection can exist without the table -- every capability resolves to
  NOT_CONNECTED, and the message shown beside it is the one the
  availability resolver itself produces. Nothing on this page is
  hardcoded to say "unavailable": it says what the resolver says, so if
  a connection ever does exist the page tells the truth about that too.
*/

export const dynamic = "force-dynamic";

const RISK_LABEL: Readonly<Record<CapabilityRisk, string>> = {
  low: "Reads only",
  medium: "Writes in your account",
  high: "Leaves the building",
};

const RISK_CLASS: Readonly<Record<CapabilityRisk, string>> = {
  low: "border-border bg-muted text-muted-foreground",
  medium:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  high: "border-destructive/30 bg-destructive/10 text-destructive",
};

function CapabilityRow({
  capability,
}: {
  capability: CapabilityDefinition;
}) {
  /*
    The real resolver, with the real connection state: none. This is not
    a placeholder branch -- it is the same call the server makes before
    permitting a connector action, asked here with what actually exists.
  */
  const availability = resolveAvailability(capability.id, null);

  return (
    <li className="flex flex-col gap-3 border-t border-border py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">
            {capability.description}
          </p>

          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${RISK_CLASS[capability.risk]}`}
          >
            {RISK_LABEL[capability.risk]}
          </span>

          {requiresApproval(capability.risk) ? (
            <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
              Always asks you first
            </span>
          ) : null}
        </div>

        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {capability.id}
        </p>
      </div>

      <p className="shrink-0 text-sm text-muted-foreground sm:max-w-xs sm:text-right">
        {availability.available
          ? "Available"
          : availability.message}
      </p>
    </li>
  );
}

export default function ConnectorsPage() {
  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-border pb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Connectors
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">
            What SYRAVEN would be able to do in each service, and what it
            would ask you before doing.
          </p>
        </header>

        {/*
          Stated once, at the top, rather than repeated as a disabled
          button beside every provider. The reason is the same for all
          of them and it is not a failure the user can fix by clicking.
        */}
        <section
          role="note"
          className="mt-6 rounded-2xl border border-border bg-card p-5"
        >
          <h2 className="font-semibold">Nothing is connected yet</h2>

          <p className="mt-2 text-sm leading-6 text-foreground/60">
            Connecting an account needs a place to record the connection
            and an authorization step with the provider. Neither is set
            up in this deployment, so there is nothing to switch on here
            — and a Connect button that could not connect would be worse
            than saying so.
          </p>

          <p className="mt-3 text-sm leading-6 text-foreground/60">
            The API clients for these services are written and the
            capability rules below are live. What is missing is the
            connection store and the provider credentials.
          </p>
        </section>

        <section className="mt-10 space-y-8">
          {INTEGRATION_PROVIDERS.map((provider) => {
            const capabilities = capabilitiesForProvider(provider);

            if (capabilities.length === 0) return null;

            return (
              <div
                key={provider}
                className="rounded-2xl border border-border bg-card p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">
                    {providerLabel(provider)}
                  </h2>

                  <span className="text-xs text-muted-foreground">
                    {capabilities.length}{" "}
                    {capabilities.length === 1
                      ? "capability"
                      : "capabilities"}
                  </span>
                </div>

                <ul className="mt-2">
                  {capabilities.map((capability) => (
                    <CapabilityRow
                      key={capability.id}
                      capability={capability}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">How approval works</h2>

          <p className="mt-2 text-sm leading-6 text-foreground/60">
            Anything marked <em>Leaves the building</em> stops and asks
            you before it happens, every time. An agent cannot lower that
            bar for itself: the risk level is decided by the server, and
            the approval is a record only you can grant.
          </p>

          <Link
            href="/agents"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            See your agents
          </Link>
        </section>
      </div>
    </div>
  );
}
