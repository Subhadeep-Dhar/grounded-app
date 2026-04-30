"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBehavioralInsight = void 0;
const https_1 = require("firebase-functions/v2/https");
const generateBehavioralInsight_1 = require("./generateBehavioralInsight");
/**
 * Firebase Cloud Function (Callable) to generate behavioral insights.
 * Validates the input state and calls the AI orchestrator.
 */
exports.getBehavioralInsight = (0, https_1.onCall)({
    region: "us-central1",
    // Can optionally restrict to authenticated users
    // enforceAppCheck: true, // If AppCheck is enabled
}, async (request) => {
    // 1. Authentication check
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in to get behavioral insights.");
    }
    // 2. Validate input payload loosely before sending to AI
    const state = request.data;
    if (!state.weather || !state.context || !state.user || !state.miss) {
        throw new https_1.HttpsError("invalid-argument", "Missing required state objects (weather, context, user, miss).");
    }
    try {
        // 3. Generate insight via AI Orchestrator
        const insight = await (0, generateBehavioralInsight_1.generateBehavioralInsight)(state);
        return insight;
    }
    catch (error) {
        console.error("Failed to generate behavioral insight:", error);
        throw new https_1.HttpsError("internal", "An error occurred while generating the insight.");
    }
});
//# sourceMappingURL=index.js.map