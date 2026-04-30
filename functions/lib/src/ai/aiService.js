"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callBehavioralLLM = callBehavioralLLM;
const openai_1 = __importDefault(require("openai"));
const zod_1 = require("openai/helpers/zod");
const aiResponseParser_1 = require("./aiResponseParser");
/**
 * Initializes the OpenAI client.
 * In Firebase, the API key is typically injected via environment variables or Firebase Secrets.
 */
function getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn("OPENAI_API_KEY is not set. AI calls will fail.");
    }
    return new openai_1.default({
        apiKey: apiKey || "",
    });
}
/**
 * Calls the LLM with the generated system prompt.
 * Utilizes OpenAI's structured output format to enforce the exact JSON schema.
 */
async function callBehavioralLLM(systemPrompt) {
    const openai = getOpenAIClient();
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Or gpt-4o-mini depending on cost preferences
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate the insight based on the current state." }
            ],
            // Enforce strict JSON structure matching our Zod schema
            response_format: (0, zod_1.zodResponseFormat)(aiResponseParser_1.aiResponseSchema, "behavioral_insight"),
            temperature: 0.7,
            max_tokens: 300,
        });
        const output = response.choices[0]?.message?.content;
        return output || null;
    }
    catch (error) {
        console.error("Error calling OpenAI:", error);
        return null;
    }
}
//# sourceMappingURL=aiService.js.map