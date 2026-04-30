import { z } from "zod";

export const aiResponseSchema = z.object({
  notification: z
    .string()
    .max(100, "Notification must be under 100 characters"),
  insight: z
    .string(),
  challengeGuidance: z
    .string(),
});

export type AIBehavioralResponse = z.infer<typeof aiResponseSchema>;

/**
 * Validates the raw LLM output against the expected schema.
 * Throws an error if parsing or validation fails, so the caller can safely fallback.
 */
export function validateResponse(rawOutput: string | null): AIBehavioralResponse {
  if (!rawOutput) {
    throw new Error("Empty response from LLM");
  }

  // LLMs sometimes wrap JSON in markdown blocks like ```json ... ```
  const cleanedOutput = rawOutput.replace(/```json\n?|```/g, "").trim();
  
  // Enforce strict parsing safety
  const parsedObj = JSON.parse(cleanedOutput);
  
  // Enforce strict schema using Zod
  return aiResponseSchema.parse(parsedObj);
}
