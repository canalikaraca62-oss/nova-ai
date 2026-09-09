/**
 * SYRAVEN — Connector capability declarations
 * lib/integrations/capabilities.ts
 *
 * SECURITY BOUNDARY.
 *
 * WHAT THIS IS
 *
 * The single place that answers: what can a connector do, how dangerous
 * is each of those things, and is it actually reachable right now?
 *
 * WHY IT EXISTS
 *
 * services/integrations/ holds roughly 5,850 lines of real API clients —
 * Gmail, Google Calendar, GitHub, Slack, Notion — that call the genuine
 * REST endpoints. Nothing imported them. No route, no tool, no UI, and
 * no table to hold a credential. They were unreachable code sitting
 * beside a product whose promise is "give SYRAVEN the goal, it runs the
 * work".
 *
 * The gap was never the HTTP calls. It was that the orchestrator had no
 * way to ask "can I send mail for this user?" and get a truthful answer.
 *
 * THE RULE THIS ENCODES
 *
 * A capability is AVAILABLE only when a connection for it exists, is
 * active, and has not expired. Everything else — no connection, a
 * revoked one, an expired token, a provider that is not configured on
 * this deployment — is UNAVAILABLE, and unavailable means the action
 * does not happen and the user is told why.
 *
 * There is deliberately no state between "connected" and "not". A
 * "probably fine, try it and see" would put the decision back inside
 * whichever caller forgot to check.
 *
 * WHAT THIS FILE DOES NOT DO
 *
 * It does not hold credentials, refresh tokens, or perform OAuth. It
 * describes capabilities and reads connection state. Token custody
 * belongs behind the server-only boundary in lib/integrations/store.ts,
 * and is gated on a migration that has not been applied.
 */

/*
 * NOT marked `server-only`, deliberately, and this is the one place in
 * lib/ where that is true.
 *
 * Everything in this file is a pure decision over plain data: it holds
 * no credential, opens no connection, and reads no database. Its whole
 * job is to answer "may this run?" — and that answer has to be
 * verifiable directly by a test rather than re-implemented inside one.
 *
 * The server-only boundary lives where it belongs, on the module that
 * actually reads connection rows and touches the secret store. This one
 * is given a snapshot and returns a verdict.
 */

import type { IntegrationProvider } from "../../services/integrations/types";

/* -------------------------------------------------------------------------- */
/*                                CAPABILITIES                                */
/* -------------------------------------------------------------------------- */

/**
 * Every capability a connector can expose.
 *
 * Named `provider.verb.object` so a capability id reads the same way a
 * tool id does, and so the risk of one is legible without opening the
 * client that implements it.
 */
export const CONNECTOR_CAPABILITIES = [
  "gmail.read.messages",
  "gmail.draft.message",
  "gmail.send.message",

  "calendar.read.events",
  "calendar.create.event",
  "calendar.modify.event",
  "calendar.cancel.event",

  "github.read.issues",
  "github.comment.issue",

  "slack.read.messages",
  "slack.send.message",

  "notion.read.pages",
  "notion.create.page",
] as const;

export type ConnectorCapability =
  (typeof CONNECTOR_CAPABILITIES)[number];

/**
 * How much damage one call can do.
 *
 * This mirrors lib/orchestration/registry.ts deliberately: a capability
 * that leaves the building is `high` and therefore needs a human, and
 * that judgement must not depend on which layer is asking.
 *
 *   low    — reads. Reversible, invisible to anyone else.
 *   medium — writes that stay inside the user's own account (a draft).
 *   high   — anything a third party sees, or that cannot be taken back.
 */
export type CapabilityRisk = "low" | "medium" | "high";

export interface CapabilityDefinition {
  readonly id: ConnectorCapability;
  readonly provider: IntegrationProvider;
  /** Shown to the user when consent is requested. Plain language. */
  readonly description: string;
  readonly risk: CapabilityRisk;
  /**
   * Provider scopes this capability requires.
   *
   * Recorded so a connection can be checked against what it was
   * actually granted, rather than assuming that connecting an account
   * granted everything the product might want from it.
   */
  readonly requiredScopes: readonly string[];
}

const DEFINITIONS: Readonly<
  Record<ConnectorCapability, CapabilityDefinition>
> = {
  "gmail.read.messages": {
    id: "gmail.read.messages",
    provider: "gmail",
    description: "Read your recent email.",
    risk: "low",
    requiredScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  },

  "gmail.draft.message": {
    id: "gmail.draft.message",
    provider: "gmail",
    /*
     * A draft is `medium`, not `high`: it is written into the user's own
     * mailbox and nobody else can see it. Sending it is the step that
     * reaches another person, and that is a separate capability.
     */
    description: "Write a draft email for you to review.",
    risk: "medium",
    requiredScopes: ["https://www.googleapis.com/auth/gmail.compose"],
  },

  "gmail.send.message": {
    id: "gmail.send.message",
    provider: "gmail",
    description: "Send email on your behalf.",
    risk: "high",
    requiredScopes: ["https://www.googleapis.com/auth/gmail.send"],
  },

  "calendar.read.events": {
    id: "calendar.read.events",
    provider: "calendar",
    description: "Read your calendar.",
    risk: "low",
    requiredScopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  },

  "calendar.create.event": {
    id: "calendar.create.event",
    provider: "calendar",
    /*
     * High, despite being a create: an invitation notifies every other
     * attendee the moment it is written. It is not a private change.
     */
    description: "Create a calendar event and invite attendees.",
    risk: "high",
    requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
  },

  "calendar.modify.event": {
    id: "calendar.modify.event",
    provider: "calendar",
    description: "Change the time or details of an existing event.",
    risk: "high",
    requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
  },

  "calendar.cancel.event": {
    id: "calendar.cancel.event",
    provider: "calendar",
    description: "Cancel an event and notify its attendees.",
    risk: "high",
    requiredScopes: ["https://www.googleapis.com/auth/calendar.events"],
  },

  "github.read.issues": {
    id: "github.read.issues",
    provider: "github",
    description: "Read issues and pull requests.",
    risk: "low",
    requiredScopes: ["repo"],
  },

  "github.comment.issue": {
    id: "github.comment.issue",
    provider: "github",
    description: "Comment on an issue or pull request.",
    risk: "high",
    requiredScopes: ["repo"],
  },

  "slack.read.messages": {
    id: "slack.read.messages",
    provider: "slack",
    description: "Read messages in channels you have joined.",
    risk: "low",
    requiredScopes: ["channels:history"],
  },

  "slack.send.message": {
    id: "slack.send.message",
    provider: "slack",
    description: "Post a message to a channel.",
    risk: "high",
    requiredScopes: ["chat:write"],
  },

  "notion.read.pages": {
    id: "notion.read.pages",
    provider: "notion",
    description: "Read pages you have shared with SYRAVEN.",
    risk: "low",
    requiredScopes: ["read_content"],
  },

  "notion.create.page": {
    id: "notion.create.page",
    provider: "notion",
    /*
     * Medium: a page lands in a shared workspace, but Notion does not
     * push a notification to anyone the way mail and calendar do.
     */
    description: "Create a page in your workspace.",
    risk: "medium",
    requiredScopes: ["insert_content"],
  },
};

/**
 * Resolves a capability definition.
 *
 * Returns null for anything unrecognised rather than a default, so an
 * unknown capability id can never inherit the risk level of a known one.
 */
export function getCapability(
  id: unknown,
): CapabilityDefinition | null {
  if (typeof id !== "string") {
    return null;
  }

  return (
    DEFINITIONS[id as ConnectorCapability] ?? null
  );
}

/**
 * Every capability a provider declares.
 */
export function capabilitiesForProvider(
  provider: IntegrationProvider,
): readonly CapabilityDefinition[] {
  return Object.values(DEFINITIONS).filter(
    (definition) => definition.provider === provider,
  );
}

/**
 * True when a capability needs a human to approve each use.
 *
 * Identical in shape to `requiresHumanApproval` in the orchestration
 * registry, and for the same reason: an agent must never be able to
 * reach outside the product without a person agreeing to that specific
 * act. A connector cannot lower this bar for itself.
 */
export function requiresApproval(risk: CapabilityRisk): boolean {
  return risk === "high";
}

/* -------------------------------------------------------------------------- */
/*                             AVAILABILITY                                   */
/* -------------------------------------------------------------------------- */

export type UnavailableReason =
  | "NOT_CONNECTED"
  | "CONNECTION_INACTIVE"
  | "CREDENTIAL_EXPIRED"
  | "SCOPE_NOT_GRANTED"
  | "PROVIDER_NOT_CONFIGURED"
  | "UNKNOWN_CAPABILITY";

export type CapabilityAvailability =
  | {
      available: true;
      capability: CapabilityDefinition;
      connectionId: string;
    }
  | {
      available: false;
      reason: UnavailableReason;
      /**
       * What the user should be told. Written for a person, and never
       * containing a token, an account id, or a provider error body.
       */
      message: string;
    };

/**
 * The connection facts this module needs in order to decide.
 *
 * Deliberately NOT the full connection record: nothing here can carry a
 * credential, so no availability check can leak one by accident.
 */
export interface ConnectionSnapshot {
  readonly id: string;
  readonly provider: IntegrationProvider;
  readonly status: string;
  /** ISO timestamp, or null when the credential does not expire. */
  readonly expiresAt: string | null;
  readonly grantedScopes: readonly string[];
}

/**
 * Decides whether one capability can be exercised right now.
 *
 * FAILS CLOSED at every step. A missing connection, an unrecognised
 * status, an expired token and a scope that was never granted are all
 * unavailable — there is no path through this function that returns
 * `available: true` without a live, active, in-scope connection.
 *
 * @param now Injected so expiry is testable without freezing the clock.
 */
export function resolveAvailability(
  capabilityId: unknown,
  connection: ConnectionSnapshot | null,
  now: Date = new Date(),
): CapabilityAvailability {
  const capability = getCapability(capabilityId);

  if (!capability) {
    return {
      available: false,
      reason: "UNKNOWN_CAPABILITY",
      message: "That action is not something SYRAVEN can do.",
    };
  }

  if (!connection || connection.provider !== capability.provider) {
    return {
      available: false,
      reason: "NOT_CONNECTED",
      message: `Connect ${providerLabel(capability.provider)} to do this.`,
    };
  }

  if (connection.status !== "active") {
    /*
     * `revoked`, `error`, `pending` and anything unrecognised land here
     * together. Distinguishing them for the user would mostly be noise;
     * the action they need to take is the same.
     */
    return {
      available: false,
      reason: "CONNECTION_INACTIVE",
      message:
        `Your ${providerLabel(capability.provider)} connection is not ` +
        `active. Reconnect it to continue.`,
    };
  }

  if (connection.expiresAt !== null) {
    const expiresAt = Date.parse(connection.expiresAt);

    /*
     * An unparseable expiry is treated as expired. The alternative is
     * trusting a timestamp we could not read.
     */
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      return {
        available: false,
        reason: "CREDENTIAL_EXPIRED",
        message:
          `Your ${providerLabel(capability.provider)} connection has ` +
          `expired. Reconnect it to continue.`,
      };
    }
  }

  const granted = new Set(connection.grantedScopes);

  const missing = capability.requiredScopes.filter(
    (scope) => !granted.has(scope),
  );

  if (missing.length > 0) {
    /*
     * The scopes themselves are not named to the user: they are provider
     * jargon, and listing them invites someone to go hunting for a way
     * to grant one manually. The remedy is the same either way.
     */
    return {
      available: false,
      reason: "SCOPE_NOT_GRANTED",
      message:
        `SYRAVEN does not have permission to ${lowerFirst(
          capability.description,
        )} Reconnect ${providerLabel(capability.provider)} to grant it.`,
    };
  }

  return {
    available: true,
    capability,
    connectionId: connection.id,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  LABELS                                    */
/* -------------------------------------------------------------------------- */

const PROVIDER_LABELS: Readonly<Record<IntegrationProvider, string>> = {
  gmail: "Gmail",
  calendar: "Google Calendar",
  github: "GitHub",
  slack: "Slack",
  notion: "Notion",
};

export function providerLabel(provider: IntegrationProvider): string {
  return PROVIDER_LABELS[provider];
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
