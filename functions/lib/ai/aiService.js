"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callBehavioralLLM = callBehavioralLLM;
const generative_ai_1 = require("@google/generative-ai");
/**
 * Initializes the Gemini API client using the environment variable.
 */
function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("GEMINI_API_KEY is not set. AI calls will fail.");
    }
    return new generative_ai_1.GoogleGenerativeAI(apiKey || "");
}
/**
 * Calls the Google Gemini Free Tier LLM with the generated system prompt.
 * Enforces a strict JSON output using responseMimeType.
 */
async function callBehavioralLLM(systemPrompt) {
    const genAI = getGeminiClient();
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            // Enforce JSON format output natively through Gemini API
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.6, // Low temperature for consistent, reliable output
                maxOutputTokens: 300,
            },
            systemInstruction: systemPrompt
        });
        const prompt = "Analyze the current state provided in the system instruction and generate the structured JSON output.";
        const result = await model.generateContent(prompt);
        const output = result.response.text();
        return output || null;
    }
    catch (error) {
        console.error("Error calling Gemini API:", error);
        return null;
    }
}
//# sourceMappingURL=aiService.js.map