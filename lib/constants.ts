/**
 * SYRAVEN
 * lib/constants.ts
 *
 * Global application constants.
 * Centralized configuration values for the application.
 */

/* -------------------------------------------------------------------------- */
/*                              APPLICATION                                  */
/* -------------------------------------------------------------------------- */

export const APP_NAME = "SYRAVEN";

export const APP_DESCRIPTION =
  "Enterprise AI operating system for intelligence, automation, creation, and business operations.";

export const APP_VERSION = "1.0.0";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export const APP_ENV =
  process.env.NODE_ENV ?? "development";

export const IS_DEVELOPMENT = APP_ENV === "development";

export const IS_PRODUCTION = APP_ENV === "production";

export const IS_TEST = APP_ENV === "test";

/* -------------------------------------------------------------------------- */
/*                              BRANDING                                     */
/* -------------------------------------------------------------------------- */

export const BRAND = {
  name: APP_NAME,
  shortName: "SYRAVEN",
  tagline: "Intelligence Without Limits",
  description: APP_DESCRIPTION,
} as const;

/* -------------------------------------------------------------------------- */
/*                              ROUTES                                       */
/* -------------------------------------------------------------------------- */

export const ROUTES = {
  home: "/",

  auth: {
    signIn: "/login",
    signUp: "/signup",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    callback: "/auth/callback",
  },

  app: {
    dashboard: "/dashboard",
    workspace: "/workspace",
    projects: "/projects",
    activity: "/activity",
    notifications: "/notifications",
  },

  studio: {
    index: "/studio",
    chat: "/studio/chat",
    writing: "/studio/writing",
    coding: "/studio/coding",
    design: "/studio/design",
    research: "/studio/research",
    data: "/studio/data",
    presentation: "/studio/presentation",
    website: "/studio/website",
  },

  agents: {
    index: "/agents",
    automation: "/agents/automation",
    business: "/agents/business",
    coding: "/agents/coding",
    data: "/agents/data",
    design: "/agents/design",
    finance: "/agents/finance",
    marketing: "/agents/marketing",
    news: "/agents/news",
    personal: "/agents/personal",
    research: "/agents/research",
    study: "/agents/study",
    website: "/agents/website",
    writing: "/agents/writing",
  },

  settings: {
    index: "/settings",
    profile: "/settings/profile",
    account: "/settings/account",
    appearance: "/settings/appearance",
    security: "/settings/security",
    billing: "/settings/billing",
    notifications: "/settings/notifications",
    integrations: "/settings/integrations",
  },

  billing: {
    index: "/billing",
    plans: "/pricing",
    checkout: "/checkout",
    success: "/billing/success",
    cancel: "/billing/cancel",
  },

  legal: {
    privacy: "/privacy",
    terms: "/terms",
    cookies: "/cookies",
  },

  api: {
    health: "/api/health",
    ai: "/api/ai",
    agents: "/api/agents",
    tasks: "/api/tasks",
    auth: "/api/auth",
    billing: "/api/billing",
  },
} as const;

/* -------------------------------------------------------------------------- */
/*                            API CONFIGURATION                               */
/* -------------------------------------------------------------------------- */

export const API_VERSION = "v1";

export const API_PREFIX = `/api/${API_VERSION}`;

export const API_TIMEOUT_MS = 30_000;

export const API_LONG_TIMEOUT_MS = 120_000;

export const API_RETRY_ATTEMPTS = 3;

export const API_RETRY_DELAY_MS = 1_000;

/* -------------------------------------------------------------------------- */
/*                            PAGINATION                                      */
/* -------------------------------------------------------------------------- */

export const PAGINATION = {
  defaultPage: 1,
  defaultLimit: 20,
  minLimit: 1,
  maxLimit: 100,
} as const;

/* -------------------------------------------------------------------------- */
/*                            CACHE CONFIG                                    */
/* -------------------------------------------------------------------------- */

export const CACHE = {
  short: 60,
  medium: 300,
  long: 3600,
  day: 86400,
  week: 604800,
} as const;

/* -------------------------------------------------------------------------- */
/*                            TIME CONSTANTS                                  */
/* -------------------------------------------------------------------------- */

export const TIME = {
  second: 1_000,
  minute: 60_000,
  fiveMinutes: 300_000,
  fifteenMinutes: 900_000,
  thirtyMinutes: 1_800_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
} as const;

/* -------------------------------------------------------------------------- */
/*                            AI LIMITS                                       */
/* -------------------------------------------------------------------------- */

export const AI_LIMITS = {
  maxPromptLength: 100_000,
  maxSystemPromptLength: 50_000,
  maxMessages: 100,
  maxContextMessages: 50,
  maxTokens: 16_000,
  maxOutputTokens: 16_000,
  defaultTemperature: 0.7,
  minTemperature: 0,
  maxTemperature: 2,
} as const;

/* -------------------------------------------------------------------------- */
/*                            AGENT LIMITS                                    */
/* -------------------------------------------------------------------------- */

export const AGENT_LIMITS = {
  maxAgentsPerWorkflow: 50,
  maxConcurrentAgents: 10,
  maxTasksPerAgent: 100,
  defaultTaskTimeoutMs: 300_000,
  maxTaskTimeoutMs: 1_800_000,
  maxRetries: 3,
} as const;

/* -------------------------------------------------------------------------- */
/*                            TASK LIMITS                                     */
/* -------------------------------------------------------------------------- */

export const TASK_LIMITS = {
  maxConcurrentTasks: 10,
  defaultTimeoutMs: 300_000,
  maxTimeoutMs: 1_800_000,
  maxRetries: 3,
  retryDelayMs: 1_000,
  pollingIntervalMs: 1_000,
} as const;

/* -------------------------------------------------------------------------- */
/*                            FILE UPLOAD                                     */
/* -------------------------------------------------------------------------- */

export const FILE_LIMITS = {
  maxFileSize: 50 * 1024 * 1024,
  maxFiles: 20,
  maxImageSize: 10 * 1024 * 1024,
  maxDocumentSize: 50 * 1024 * 1024,
} as const;

export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/* -------------------------------------------------------------------------- */
/*                            SECURITY                                        */
/* -------------------------------------------------------------------------- */

export const SECURITY = {
  sessionCookieName: "syraven-session",
  csrfHeaderName: "x-csrf-token",
  requestIdHeaderName: "x-request-id",

  password: {
    minLength: 8,
    maxLength: 128,
  },

  rateLimit: {
    windowMs: 60_000,
    maxRequests: 100,
  },

  authRateLimit: {
    windowMs: 60_000,
    maxRequests: 10,
  },
} as const;

/* -------------------------------------------------------------------------- */
/*                            UI                                              */
/* -------------------------------------------------------------------------- */

export const UI = {
  sidebarWidth: 280,
  sidebarCollapsedWidth: 80,
  headerHeight: 64,

  animation: {
    fast: 150,
    normal: 250,
    slow: 400,
  },

  toastDuration: 5000,
} as const;

/* -------------------------------------------------------------------------- */
/*                            LOCAL STORAGE                                   */
/* -------------------------------------------------------------------------- */

export const STORAGE_KEYS = {
  theme: "syraven-theme",
  sidebar: "syraven-sidebar",
  locale: "syraven-locale",

  auth: "syraven-auth",
  session: "syraven-session",

  recentProjects: "syraven-recent-projects",
  recentAgents: "syraven-recent-agents",

  onboarding: "syraven-onboarding-completed",
} as const;

/* -------------------------------------------------------------------------- */
/*                            QUERY KEYS                                      */
/* -------------------------------------------------------------------------- */

export const QUERY_KEYS = {
  user: ["user"],
  session: ["session"],

  projects: ["projects"],
  agents: ["agents"],
  tasks: ["tasks"],

  notifications: ["notifications"],
  billing: ["billing"],

  models: ["ai", "models"],
  conversations: ["ai", "conversations"],
} as const;

/* -------------------------------------------------------------------------- */
/*                            HTTP STATUS                                     */
/* -------------------------------------------------------------------------- */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/* -------------------------------------------------------------------------- */
/*                            ERROR CODES                                     */
/* -------------------------------------------------------------------------- */

export const ERROR_CODES = {
  UNKNOWN: "UNKNOWN",
  VALIDATION_ERROR: "VALIDATION_ERROR",

  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",

  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_INPUT: "INVALID_INPUT",

  RATE_LIMITED: "RATE_LIMITED",
  TIMEOUT: "TIMEOUT",

  AI_ERROR: "AI_ERROR",
  AGENT_ERROR: "AGENT_ERROR",
  TASK_ERROR: "TASK_ERROR",

  DATABASE_ERROR: "DATABASE_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",

  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

/* -------------------------------------------------------------------------- */
/*                            REGEX                                           */
/* -------------------------------------------------------------------------- */

export const REGEX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  username: /^[a-zA-Z0-9_-]{3,30}$/,

  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,

  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  url: /^https?:\/\/.+/i,
} as const;

/* -------------------------------------------------------------------------- */
/*                            FEATURE FLAGS                                   */
/* -------------------------------------------------------------------------- */

export const FEATURES = {
  ai: true,
  agents: true,
  automation: true,
  workflows: true,

  presentations: true,
  websiteBuilder: true,
  codingStudio: true,
  researchStudio: true,

  billing: true,
  teams: true,
  organizations: true,

  analytics: true,
  auditLogs: true,
} as const;

/* -------------------------------------------------------------------------- */
/*                            SOCIAL LINKS                                    */
/* -------------------------------------------------------------------------- */

export const SOCIAL_LINKS = {
  x: "",
  linkedin: "",
  github: "",
  youtube: "",
  discord: "",
} as const;

/* -------------------------------------------------------------------------- */
/*                            CONTACT                                         */
/* -------------------------------------------------------------------------- */

export const CONTACT = {
  supportEmail: "support@syraven.ai",
  businessEmail: "business@syraven.ai",
  privacyEmail: "privacy@syraven.ai",
} as const;

/* -------------------------------------------------------------------------- */
/*                            EXPORT                                          */
/* -------------------------------------------------------------------------- */

const constants = {
  APP_NAME,
  APP_DESCRIPTION,
  APP_VERSION,
  APP_URL,
  APP_ENV,

  BRAND,
  ROUTES,

  API_VERSION,
  API_PREFIX,
  API_TIMEOUT_MS,
  API_LONG_TIMEOUT_MS,

  PAGINATION,
  CACHE,
  TIME,

  AI_LIMITS,
  AGENT_LIMITS,
  TASK_LIMITS,

  FILE_LIMITS,
  ALLOWED_FILE_TYPES,

  SECURITY,
  UI,
  STORAGE_KEYS,
  QUERY_KEYS,

  HTTP_STATUS,
  ERROR_CODES,
  REGEX,
  FEATURES,
  SOCIAL_LINKS,
  CONTACT,
};

export default constants;