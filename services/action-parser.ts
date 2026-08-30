/**
 * SYRAVEN Action Parser
 *
 * Production-grade action parsing and normalization layer.
 *
 * Responsibilities:
 * - Parse unknown input safely
 * - Parse JSON strings
 * - Normalize action types
 * - Support multiple AI action schemas
 * - Validate single and batch actions
 * - Return fully type-safe discriminated results
 */

export type ActionParseErrorCode =
  | "INVALID_INPUT"
  | "INVALID_JSON"
  | "INVALID_ACTION"
  | "MISSING_ACTION_TYPE"
  | "INVALID_ACTION_TYPE"
  | "INVALID_PAYLOAD"
  | "EMPTY_ACTION_LIST"
  | "TOO_MANY_ACTIONS";

export interface ActionParseError {
  message: string;
  code: ActionParseErrorCode;
  path?: string;
}

export interface ParsedAction<TInput = unknown> {
  type: string;
  input: TInput;
  id?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionParseSuccess<TInput = unknown> {
  success: true;
  status: "success";
  action: ParsedAction<TInput>;
}

export interface ActionParseFailure {
  success: false;
  status: "error";
  error: ActionParseError;
}

export type ActionParseResult<TInput = unknown> =
  | ActionParseSuccess<TInput>
  | ActionParseFailure;

export interface ActionBatchParseSuccess<TInput = unknown> {
  success: true;
  status: "success";
  actions: ParsedAction<TInput>[];
}

export interface ActionBatchParseFailure {
  success: false;
  status: "error";
  error: ActionParseError;
}

export type ActionBatchParseResult<TInput = unknown> =
  | ActionBatchParseSuccess<TInput>
  | ActionBatchParseFailure;

export interface ActionParserOptions {
  allowJsonString?: boolean;
  allowEmptyInput?: boolean;
  normalizeType?: boolean;
  acceptedTypePattern?: RegExp;
  maxActions?: number;
}

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_MAX_ACTIONS = 100;

const DEFAULT_ACTION_TYPE_PATTERN =
  /^[a-zA-Z][a-zA-Z0-9._:/-]*$/;

/* -------------------------------------------------------------------------- */
/*                                TYPE GUARDS                                 */
/* -------------------------------------------------------------------------- */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonEmptyString(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

/* -------------------------------------------------------------------------- */
/*                              RESULT HELPERS                                */
/* -------------------------------------------------------------------------- */

function createParseFailure(
  message: string,
  code: ActionParseErrorCode,
  path?: string
): ActionParseFailure {
  return {
    success: false,
    status: "error",
    error: {
      message,
      code,
      ...(path ? { path } : {}),
    },
  };
}

function createBatchParseFailure(
  message: string,
  code: ActionParseErrorCode,
  path?: string
): ActionBatchParseFailure {
  return {
    success: false,
    status: "error",
    error: {
      message,
      code,
      ...(path ? { path } : {}),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                              NORMALIZATION                                 */
/* -------------------------------------------------------------------------- */

function normalizeActionType(
  value: string,
  normalize: boolean
): string {
  const trimmed = value.trim();

  if (!normalize) {
    return trimmed;
  }

  return trimmed
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-");
}

function normalizeActionId(
  value: unknown
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function normalizeMetadata(
  value: unknown
): Record<string, unknown> | undefined {
  return isRecord(value)
    ? value
    : undefined;
}

/* -------------------------------------------------------------------------- */
/*                                JSON PARSER                                 */
/* -------------------------------------------------------------------------- */

type JsonParseResult =
  | {
      success: true;
      data: unknown;
    }
  | {
      success: false;
      error: ActionParseError;
    };

function tryParseJson(
  value: string
): JsonParseResult {
  try {
    return {
      success: true,
      data: JSON.parse(value),
    };
  } catch {
    return {
      success: false,
      error: {
        message:
          "Invalid JSON action payload.",
        code: "INVALID_JSON",
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                             ACTION FIELD HELPERS                           */
/* -------------------------------------------------------------------------- */

function extractActionType(
  value: Record<string, unknown>
): unknown {
  return (
    value.type ??
    value.actionType ??
    value.action ??
    value.name
  );
}

function extractActionInput(
  value: Record<string, unknown>
): unknown {
  if ("input" in value) {
    return value.input;
  }

  if ("payload" in value) {
    return value.payload;
  }

  if ("data" in value) {
    return value.data;
  }

  if ("params" in value) {
    return value.params;
  }

  return undefined;
}

function extractActionId(
  value: Record<string, unknown>
): unknown {
  return (
    value.id ??
    value.actionId ??
    value.requestId
  );
}

/* -------------------------------------------------------------------------- */
/*                             SINGLE ACTION PARSER                           */
/* -------------------------------------------------------------------------- */

export function parseAction<TInput = unknown>(
  value: unknown,
  options: ActionParserOptions = {}
): ActionParseResult<TInput> {
  const allowJsonString =
    options.allowJsonString ?? true;

  const allowEmptyInput =
    options.allowEmptyInput ?? true;

  const normalizeType =
    options.normalizeType ?? true;

  const acceptedTypePattern =
    options.acceptedTypePattern ??
    DEFAULT_ACTION_TYPE_PATTERN;

  let parsedValue = value;

  if (typeof parsedValue === "string") {
    if (!allowJsonString) {
      return createParseFailure(
        "String action input is not allowed.",
        "INVALID_INPUT"
      );
    }

    const jsonResult =
      tryParseJson(parsedValue);

    if (!jsonResult.success) {
      return {
        success: false,
        status: "error",
        error: jsonResult.error,
      };
    }

    parsedValue = jsonResult.data;
  }

  if (!isRecord(parsedValue)) {
    return createParseFailure(
      "Action must be an object.",
      "INVALID_ACTION"
    );
  }

  const rawType =
    extractActionType(parsedValue);

  if (
    rawType === undefined ||
    rawType === null
  ) {
    return createParseFailure(
      "Action type is required.",
      "MISSING_ACTION_TYPE",
      "type"
    );
  }

  if (!isNonEmptyString(rawType)) {
    return createParseFailure(
      "Action type must be a non-empty string.",
      "INVALID_ACTION_TYPE",
      "type"
    );
  }

  const type =
    normalizeActionType(
      rawType,
      normalizeType
    );

  if (!acceptedTypePattern.test(type)) {
    return createParseFailure(
      `Invalid action type "${type}".`,
      "INVALID_ACTION_TYPE",
      "type"
    );
  }

  const input =
    extractActionInput(parsedValue);

  if (
    input === undefined &&
    !allowEmptyInput
  ) {
    return createParseFailure(
      "Action input is required.",
      "INVALID_PAYLOAD",
      "input"
    );
  }

  const id =
    normalizeActionId(
      extractActionId(parsedValue)
    );

  const metadata =
    normalizeMetadata(
      parsedValue.metadata
    );

  const action: ParsedAction<TInput> = {
    type,
    input: input as TInput,
  };

  if (id) {
    action.id = id;
  }

  if (metadata) {
    action.metadata = metadata;
  }

  return {
    success: true,
    status: "success",
    action,
  };
}

/* -------------------------------------------------------------------------- */
/*                              BATCH ACTION PARSER                           */
/* -------------------------------------------------------------------------- */

export function parseActions<TInput = unknown>(
  value: unknown,
  options: ActionParserOptions = {}
): ActionBatchParseResult<TInput> {
  const allowJsonString =
    options.allowJsonString ?? true;

  const maxActions =
    options.maxActions ??
    DEFAULT_MAX_ACTIONS;

  let parsedValue = value;

  if (typeof parsedValue === "string") {
    if (!allowJsonString) {
      return createBatchParseFailure(
        "String action input is not allowed.",
        "INVALID_INPUT"
      );
    }

    const jsonResult =
      tryParseJson(parsedValue);

    if (!jsonResult.success) {
      return {
        success: false,
        status: "error",
        error: jsonResult.error,
      };
    }

    parsedValue = jsonResult.data;
  }

  let rawActions: unknown[];

  if (Array.isArray(parsedValue)) {
    rawActions = parsedValue;
  } else if (isRecord(parsedValue)) {
    if (Array.isArray(parsedValue.actions)) {
      rawActions = parsedValue.actions;
    } else {
      rawActions = [parsedValue];
    }
  } else {
    return createBatchParseFailure(
      "Actions must be an array or object.",
      "INVALID_INPUT"
    );
  }

  if (rawActions.length === 0) {
    return createBatchParseFailure(
      "Action list cannot be empty.",
      "EMPTY_ACTION_LIST"
    );
  }

  const normalizedMaxActions =
    Number.isFinite(maxActions) &&
    maxActions > 0
      ? Math.floor(maxActions)
      : DEFAULT_MAX_ACTIONS;

  if (
    rawActions.length >
    normalizedMaxActions
  ) {
    return createBatchParseFailure(
      `Action list exceeds maximum allowed size of ${normalizedMaxActions}.`,
      "TOO_MANY_ACTIONS",
      "actions"
    );
  }

  const actions: ParsedAction<TInput>[] = [];

  for (
    let index = 0;
    index < rawActions.length;
    index += 1
  ) {
    const result =
      parseAction<TInput>(
        rawActions[index],
        options
      );

    if (!result.success) {
      const errorPath =
        result.error.path
          ? `actions[${index}].${result.error.path}`
          : `actions[${index}]`;

      return createBatchParseFailure(
        result.error.message,
        result.error.code,
        errorPath
      );
    }

    actions.push(result.action);
  }

  return {
    success: true,
    status: "success",
    actions,
  };
}

/* -------------------------------------------------------------------------- */
/*                              ACTION PARSER CLASS                           */
/* -------------------------------------------------------------------------- */

export class ActionParser {
  private readonly options:
    Required<
      Omit<
        ActionParserOptions,
        "acceptedTypePattern"
      >
    > & {
      acceptedTypePattern: RegExp;
    };

  constructor(
    options: ActionParserOptions = {}
  ) {
    this.options = {
      allowJsonString:
        options.allowJsonString ?? true,

      allowEmptyInput:
        options.allowEmptyInput ?? true,

      normalizeType:
        options.normalizeType ?? true,

      acceptedTypePattern:
        options.acceptedTypePattern ??
        DEFAULT_ACTION_TYPE_PATTERN,

      maxActions:
        options.maxActions ??
        DEFAULT_MAX_ACTIONS,
    };
  }

  parse<TInput = unknown>(
    value: unknown
  ): ActionParseResult<TInput> {
    return parseAction<TInput>(
      value,
      this.options
    );
  }

  parseMany<TInput = unknown>(
    value: unknown
  ): ActionBatchParseResult<TInput> {
    return parseActions<TInput>(
      value,
      this.options
    );
  }

  tryParse<TInput = unknown>(
    value: unknown
  ): ParsedAction<TInput> | null {
    const result =
      this.parse<TInput>(value);

    if (!result.success) {
      return null;
    }

    return result.action;
  }

  isValid(
    value: unknown
  ): boolean {
    return this.parse(value).success;
  }
}

/* -------------------------------------------------------------------------- */
/*                              TYPE GUARDS                                   */
/* -------------------------------------------------------------------------- */

export function isParsedAction(
  value: unknown
): value is ParsedAction {
  if (!isRecord(value)) {
    return false;
  }

  return isNonEmptyString(value.type);
}

export function safeParseAction<TInput = unknown>(
  value: unknown,
  options: ActionParserOptions = {}
): ParsedAction<TInput> | null {
  const result =
    parseAction<TInput>(
      value,
      options
    );

  return result.success
    ? result.action
    : null;
}

/* -------------------------------------------------------------------------- */
/*                              DEFAULT INSTANCE                              */
/* -------------------------------------------------------------------------- */

export const actionParser =
  new ActionParser();

/* -------------------------------------------------------------------------- */
/*                              DEFAULT EXPORT                                */
/* -------------------------------------------------------------------------- */

export default actionParser;