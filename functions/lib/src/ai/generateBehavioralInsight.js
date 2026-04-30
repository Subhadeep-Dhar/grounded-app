"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBehavioralInsight = generateBehavioralInsight;
const aiPromptBuilder_1 = require("./aiPromptBuilder");
const aiService_1 = require("./aiService");
const aiResponseParser_1 = require("./aiResponseParser");
/**
 * Orchestrator function to generate behavioral insight.
 * 1. Takes the user's structured state.
 * 2. Builds the strict system prompt.
 * 3. Calls the LLM.
 * 4. Parses, validates, and returns the strict JSON schema.
 */
async function generateBehavioralInsight(state) {
    // Step 1: Build the prompt
    const systemPrompt = (0, aiPromptBuilder_1.buildSystemPrompt)(state);
    // Step 2: Call the LLM
    const rawResponse = await (0, aiService_1.callBehavioralLLM)(systemPrompt);
    // Step 3: Parse and validate the response (handles fallbacks)
    const validatedInsight = (0, aiResponseParser_1.parseAIResponse)(rawResponse);
    return validatedInsight;
}
//# sourceMappingURL=generateBehavioralInsight.js.map