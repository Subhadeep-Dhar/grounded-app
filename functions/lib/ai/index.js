"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBehavioralInsight = void 0;
const https_1 = require("firebase-functions/v2/https");
const generateBehavioralInsight_1 = require("./generateBehavioralInsight");
/**
 * Firebase Cloud Function (Callable) to generate behavioral insights.
 * Validates the input state and intelligently orchestrates AI, Fallbacks, and Cache.
 */
exports.getBehavioralInsight = (0, https_1.onCall)({
    region: "us-central1",
    // enforceAppCheck: true, // Uncomment if AppCheck is configured
}, async (request) => {
    // 1. Authentication check
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in to get behavioral insights.");
    }
    const userId = request.auth.uid;
    // 2. Validate input payload loosely before sending to AI
    const state = request.data.state;
    if (!state || !state.weather || !state.context || !state.user || !state.miss) {
        throw new https_1.HttpsError("invalid-argument", "Missing required current state objects (weather, context, user, miss).");
    }
    try {
        // 3. Generate insight via the Optimized Pipeline
        const insight = await (0, generateBehavioralInsight_1.generateBehavioralInsight)(state, userId);
        return insight;
    }
    catch (error) {
        console.error("Failed to generate behavioral insight:", error);
        throw new https_1.HttpsError("internal", "An error occurred while generating the insight.");
    }
});
//# sourceMappingURL=index.js.map