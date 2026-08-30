/**
 * SYRAVEN Calendar Integration Service
 *
 * Provider-agnostic calendar abstraction.
 *
 * Supports:
 * - Google Calendar
 * - Microsoft Outlook Calendar
 * - Custom providers
 *
 * Core capabilities:
 * - List calendars
 * - List events
 * - Get event
 * - Create event
 * - Update event
 * - Delete event
 * - Availability checks
 * - Conflict detection
 */

export type CalendarProvider =
  | "google"
  | "microsoft"
  | "apple"
  | "custom";

export type CalendarEventStatus =
  | "confirmed"
  | "tentative"
  | "cancelled";

export type CalendarAttendeeStatus =
  | "needsAction"
  | "accepted"
  | "declined"
  | "tentative";

export interface CalendarCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  provider?: CalendarProvider;
}

export interface Calendar {
  id: string;
  name: string;
  description?: string;
  primary?: boolean;
  readOnly?: boolean;
  color?: string;
  timezone?: string;
  provider: CalendarProvider;
}

export interface CalendarAttendee {
  email: string;
  name?: string;
  status?: CalendarAttendeeStatus;
  optional?: boolean;
  organizer?: boolean;
}

export interface CalendarReminder {
  method: "email" | "popup" | "notification";
  minutesBefore: number;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;

  title: string;
  description?: string;
  location?: string;

  start: Date;
  end: Date;

  allDay?: boolean;

  status?: CalendarEventStatus;

  attendees?: CalendarAttendee[];

  organizer?: CalendarAttendee;

  reminders?: CalendarReminder[];

  recurring?: boolean;
  recurrenceRule?: string;

  meetingUrl?: string;

  createdAt?: Date;
  updatedAt?: Date;

  provider: CalendarProvider;

  metadata?: Record<string, unknown>;
}

export interface CreateCalendarEventInput {
  calendarId: string;

  title: string;
  description?: string;
  location?: string;

  start: Date | string;
  end: Date | string;

  allDay?: boolean;

  attendees?: CalendarAttendee[];

  reminders?: CalendarReminder[];

  recurrenceRule?: string;

  meetingUrl?: string;

  metadata?: Record<string, unknown>;
}

export interface UpdateCalendarEventInput {
  title?: string;
  description?: string;
  location?: string;

  start?: Date | string;
  end?: Date | string;

  allDay?: boolean;

  status?: CalendarEventStatus;

  attendees?: CalendarAttendee[];

  reminders?: CalendarReminder[];

  recurrenceRule?: string;

  meetingUrl?: string;

  metadata?: Record<string, unknown>;
}

export interface CalendarEventQuery {
  calendarId?: string;

  start?: Date | string;
  end?: Date | string;

  search?: string;

  limit?: number;

  includeCancelled?: boolean;
}

export interface CalendarAvailabilityQuery {
  calendarId: string;

  start: Date | string;
  end: Date | string;

  timezone?: string;
}

export interface CalendarAvailability {
  available: boolean;

  conflicts: CalendarEvent[];

  checkedStart: Date;
  checkedEnd: Date;
}

export interface CalendarProviderAdapter {
  provider: CalendarProvider;

  listCalendars(
    credentials: CalendarCredentials
  ): Promise<Calendar[]>;

  listEvents(
    credentials: CalendarCredentials,
    query?: CalendarEventQuery
  ): Promise<CalendarEvent[]>;

  getEvent(
    credentials: CalendarCredentials,
    eventId: string,
    calendarId?: string
  ): Promise<CalendarEvent | null>;

  createEvent(
    credentials: CalendarCredentials,
    input: CreateCalendarEventInput
  ): Promise<CalendarEvent>;

  updateEvent(
    credentials: CalendarCredentials,
    eventId: string,
    input: UpdateCalendarEventInput,
    calendarId?: string
  ): Promise<CalendarEvent>;

  deleteEvent(
    credentials: CalendarCredentials,
    eventId: string,
    calendarId?: string
  ): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/*                              ERROR TYPES                                   */
/* -------------------------------------------------------------------------- */

export class CalendarIntegrationError extends Error {
  public readonly provider?: CalendarProvider;
  public readonly code?: string;
  public readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      provider?: CalendarProvider;
      code?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message);

    this.name = "CalendarIntegrationError";
    this.provider = options.provider;
    this.code = options.code;
    this.cause = options.cause;
  }
}

/* -------------------------------------------------------------------------- */
/*                              DATE HELPERS                                  */
/* -------------------------------------------------------------------------- */

function toDate(value: Date | string): Date {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new CalendarIntegrationError(
      `Invalid date value: ${String(value)}`,
      {
        code: "INVALID_DATE",
      }
    );
  }

  return date;
}

function validateEventTime(
  start: Date,
  end: Date
): void {
  if (start.getTime() >= end.getTime()) {
    throw new CalendarIntegrationError(
      "Event start time must be before end time.",
      {
        code: "INVALID_EVENT_TIME",
      }
    );
  }
}

function eventsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
): boolean {
  return (
    firstStart.getTime() < secondEnd.getTime() &&
    firstEnd.getTime() > secondStart.getTime()
  );
}

/* -------------------------------------------------------------------------- */
/*                         PROVIDER REGISTRY                                  */
/* -------------------------------------------------------------------------- */

const providerAdapters = new Map<
  CalendarProvider,
  CalendarProviderAdapter
>();

export function registerCalendarProvider(
  adapter: CalendarProviderAdapter
): void {
  if (!adapter?.provider) {
    throw new CalendarIntegrationError(
      "Calendar provider adapter must define a provider.",
      {
        code: "INVALID_PROVIDER",
      }
    );
  }

  providerAdapters.set(
    adapter.provider,
    adapter
  );
}

export function unregisterCalendarProvider(
  provider: CalendarProvider
): void {
  providerAdapters.delete(provider);
}

export function getCalendarProvider(
  provider: CalendarProvider
): CalendarProviderAdapter {
  const adapter =
    providerAdapters.get(provider);

  if (!adapter) {
    throw new CalendarIntegrationError(
      `Calendar provider "${provider}" is not registered.`,
      {
        provider,
        code: "PROVIDER_NOT_REGISTERED",
      }
    );
  }

  return adapter;
}

export function getRegisteredCalendarProviders(): CalendarProvider[] {
  return Array.from(
    providerAdapters.keys()
  );
}

/* -------------------------------------------------------------------------- */
/*                           CALENDAR SERVICE                                 */
/* -------------------------------------------------------------------------- */

export class CalendarService {
  private readonly provider: CalendarProvider;
  private readonly credentials: CalendarCredentials;
  private readonly adapter: CalendarProviderAdapter;

  constructor(
    provider: CalendarProvider,
    credentials: CalendarCredentials
  ) {
    if (!credentials?.accessToken) {
      throw new CalendarIntegrationError(
        "Calendar credentials require an access token.",
        {
          provider,
          code: "MISSING_ACCESS_TOKEN",
        }
      );
    }

    this.provider = provider;
    this.credentials = {
      ...credentials,
      provider,
    };

    this.adapter = getCalendarProvider(
      provider
    );
  }

  /**
   * List calendars available to the user.
   */
  async listCalendars(): Promise<Calendar[]> {
    try {
      return await this.adapter.listCalendars(
        this.credentials
      );
    } catch (error) {
      throw this.wrapError(
        "Failed to list calendars.",
        error
      );
    }
  }

  /**
   * List calendar events.
   */
  async listEvents(
    query: CalendarEventQuery = {}
  ): Promise<CalendarEvent[]> {
    try {
      const normalizedQuery: CalendarEventQuery = {
        ...query,
      };

      if (query.start) {
        normalizedQuery.start =
          toDate(query.start);
      }

      if (query.end) {
        normalizedQuery.end =
          toDate(query.end);
      }

      if (
        normalizedQuery.start &&
        normalizedQuery.end
      ) {
        validateEventTime(
          normalizedQuery.start as Date,
          normalizedQuery.end as Date
        );
      }

      return await this.adapter.listEvents(
        this.credentials,
        normalizedQuery
      );
    } catch (error) {
      throw this.wrapError(
        "Failed to list calendar events.",
        error
      );
    }
  }

  /**
   * Get a single event.
   */
  async getEvent(
    eventId: string,
    calendarId?: string
  ): Promise<CalendarEvent | null> {
    if (!eventId?.trim()) {
      throw new CalendarIntegrationError(
        "Event ID is required.",
        {
          provider: this.provider,
          code: "INVALID_EVENT_ID",
        }
      );
    }

    try {
      return await this.adapter.getEvent(
        this.credentials,
        eventId,
        calendarId
      );
    } catch (error) {
      throw this.wrapError(
        `Failed to get calendar event "${eventId}".`,
        error
      );
    }
  }

  /**
   * Create a calendar event.
   */
  async createEvent(
    input: CreateCalendarEventInput
  ): Promise<CalendarEvent> {
    if (!input?.calendarId?.trim()) {
      throw new CalendarIntegrationError(
        "Calendar ID is required.",
        {
          provider: this.provider,
          code: "INVALID_CALENDAR_ID",
        }
      );
    }

    if (!input.title?.trim()) {
      throw new CalendarIntegrationError(
        "Event title is required.",
        {
          provider: this.provider,
          code: "INVALID_EVENT_TITLE",
        }
      );
    }

    const start = toDate(input.start);
    const end = toDate(input.end);

    validateEventTime(start, end);

    try {
      return await this.adapter.createEvent(
        this.credentials,
        {
          ...input,
          start,
          end,
        }
      );
    } catch (error) {
      throw this.wrapError(
        "Failed to create calendar event.",
        error
      );
    }
  }

  /**
   * Update a calendar event.
   */
  async updateEvent(
    eventId: string,
    input: UpdateCalendarEventInput,
    calendarId?: string
  ): Promise<CalendarEvent> {
    if (!eventId?.trim()) {
      throw new CalendarIntegrationError(
        "Event ID is required.",
        {
          provider: this.provider,
          code: "INVALID_EVENT_ID",
        }
      );
    }

    const normalizedInput: UpdateCalendarEventInput = {
      ...input,
    };

    if (input.start) {
      normalizedInput.start =
        toDate(input.start);
    }

    if (input.end) {
      normalizedInput.end =
        toDate(input.end);
    }

    if (
      normalizedInput.start &&
      normalizedInput.end
    ) {
      validateEventTime(
        normalizedInput.start as Date,
        normalizedInput.end as Date
      );
    }

    try {
      return await this.adapter.updateEvent(
        this.credentials,
        eventId,
        normalizedInput,
        calendarId
      );
    } catch (error) {
      throw this.wrapError(
        `Failed to update calendar event "${eventId}".`,
        error
      );
    }
  }

  /**
   * Delete a calendar event.
   */
  async deleteEvent(
    eventId: string,
    calendarId?: string
  ): Promise<void> {
    if (!eventId?.trim()) {
      throw new CalendarIntegrationError(
        "Event ID is required.",
        {
          provider: this.provider,
          code: "INVALID_EVENT_ID",
        }
      );
    }

    try {
      await this.adapter.deleteEvent(
        this.credentials,
        eventId,
        calendarId
      );
    } catch (error) {
      throw this.wrapError(
        `Failed to delete calendar event "${eventId}".`,
        error
      );
    }
  }

  /**
   * Check whether a time range is available.
   */
  async checkAvailability(
    query: CalendarAvailabilityQuery
  ): Promise<CalendarAvailability> {
    if (!query.calendarId?.trim()) {
      throw new CalendarIntegrationError(
        "Calendar ID is required.",
        {
          provider: this.provider,
          code: "INVALID_CALENDAR_ID",
        }
      );
    }

    const start = toDate(query.start);
    const end = toDate(query.end);

    validateEventTime(start, end);

    const events = await this.listEvents({
      calendarId: query.calendarId,
      start,
      end,
      includeCancelled: false,
    });

    const conflicts = events.filter((event) => {
      if (event.status === "cancelled") {
        return false;
      }

      return eventsOverlap(
        start,
        end,
        new Date(event.start),
        new Date(event.end)
      );
    });

    return {
      available: conflicts.length === 0,
      conflicts,
      checkedStart: start,
      checkedEnd: end,
    };
  }

  /**
   * Find conflicts for a proposed event.
   */
  async findConflicts(
    calendarId: string,
    start: Date | string,
    end: Date | string
  ): Promise<CalendarEvent[]> {
    const availability =
      await this.checkAvailability({
        calendarId,
        start,
        end,
      });

    return availability.conflicts;
  }

  private wrapError(
    message: string,
    cause: unknown
  ): CalendarIntegrationError {
    if (cause instanceof CalendarIntegrationError) {
      return cause;
    }

    const detail =
      cause instanceof Error
        ? cause.message
        : "Unknown calendar provider error.";

    return new CalendarIntegrationError(
      `${message} ${detail}`,
      {
        provider: this.provider,
        code: "CALENDAR_PROVIDER_ERROR",
        cause,
      }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                         SERVICE FACTORY                                    */
/* -------------------------------------------------------------------------- */

export function createCalendarService(
  provider: CalendarProvider,
  credentials: CalendarCredentials
): CalendarService {
  return new CalendarService(
    provider,
    credentials
  );
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

export default CalendarService;