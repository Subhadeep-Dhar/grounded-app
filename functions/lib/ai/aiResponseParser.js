"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiResponseSchema = void 0;
exports.validateResponse = validateResponse;
const zod_1 = require("zod");
exports.aiResponseSchema = zod_1.z.object({
    notification: zod_1.z
        .string()
        .max(100, "Notification must be under 100 characters"),
    insight: zod_1.z
        .string(),
    challengeGuidance: zod_1.z
        .string(),
});
/**
 * Validates the raw LLM output against the expected schema.
 * Throws an error if parsing or validation fails, so the caller can safely fallback.
 */
function validateResponse(rawOutput) {
    if (!rawOutput) {
        throw new Error("Empty response from LLM");
    }
    // LLMs sometimes wrap JSON in markdown blocks like ```json ... ```
    const cleanedOutput = rawOutput.replace(/```json\n?|```/g, "").trim();
    // Enforce strict parsing safety
    const parsedObj = JSON.parse(cleanedOutput);
    // Enforce strict schema using Zod
    return exports.aiResponseSchema.parse(parsedObj);
}
//# sourceMappingURL=aiResponseParser.js.map