/**
 * Shared parsers for the opaque JSON columns on assessment questions
 * (`options`, `correctAnswers`). Used by both the candidate assessment service
 * and the admin question-bank service so the stored shape has one reader.
 *
 * Pure (no Prisma / server dependency) — accepts `unknown` so it works with
 * `Prisma.JsonValue` or any deserialised value.
 */

/** One answer option as stored in the `options` JSON column. */
export interface ParsedQuestionOption {
  id: string;
  text: string;
  imageUrl: string | null;
}

/** Parse the `options` JSON into typed, validated option records. */
export function parseQuestionOptions(value: unknown): ParsedQuestionOption[] {
  if (!Array.isArray(value)) return [];
  const out: ParsedQuestionOption[] = [];
  for (const item of value) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      if (typeof record.id === "string" && typeof record.text === "string") {
        out.push({
          id: record.id,
          text: record.text,
          imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : null,
        });
      }
    }
  }
  return out;
}

/** Parse a JSON array of strings (e.g. `correctAnswers`, `expectedKeywords`). */
export function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}
