import type { Json } from "@/types/database";

export function toJson(value: unknown): Json {
  return value as Json;
}