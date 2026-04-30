"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiResponseSchema = void 0;
exports.parseAIResponse = parseAIResponse;
const zod_1 = require("zod");
// Define the exact schema the user requested
exports.aiResponseSchema = zod_1.z.object({
    notification: zod_1.z
        .string()
        .max(100, "Notification must be under 100 characters")
        .describe("Actionable notification string"),
    insight: zod_1.z
        .string()
        .describe("2 sentences, contextual, personalized insight"),
    challengeGuidance: zod_1.z
        .string()
        .describe("1-2 sentences on how to approach today"),
});
/**
 * Validates and parses the raw LLM output into the strict expected format.
 * If validation fails, it returns a safe fallback.
 */
function parseAIResponse(rawOutput) {
    if (!rawOutput) {
        return getFallbackResponse("Empty response from LLM");
    }
    try {
        // LLMs sometimes wrap JSON in markdown blocks like ```json ... ```
        // We try to clean it up before parsing
        const cleanedOutput = rawOutput.replace(/```json\n?|```/g, "").trim();
        const parsedObj = JSON.parse(cleanedOutput);
        // Validate strict schema using Zod
        const validatedData = exports.aiResponseSchema.parse(parsedObj);
        return validatedData;
    }
    catch (error) {
        console.error("AI Response Parsing Failed:", error);
        return getFallbackResponse("Failed to parse valid JSON from LLM output");
    }
}
function getFallbackResponse(reason) {
    console.warn(`Using fallback AI response. Reason: ${reason}`);
    return {
        notification: "Continue your established presence today.",
        insight: "Consistency builds the foundation. Regardless of the current variables, maintain your commitment.",
        challengeGuidance: "Execute your challenge securely and efficiently today.",
    };
}
//# sourceMappingURL=aiResponseParser.js.map