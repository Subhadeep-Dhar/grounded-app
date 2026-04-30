"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBehavioralInsight = generateBehavioralInsight;
const aiPromptBuilder_1 = require("./aiPromptBuilder");
const aiService_1 = require("./aiService");
const aiResponseParser_1 = require("./aiResponseParser");
const aiUsageController_1 = require("./aiUsageController");
const fallbackEngine_1 = require("./fallbackEngine");
const cacheService_1 = require("./cacheService");
const stateManager_1 = require("./stateManager");
const logger_1 = require("./logger");
function validateOrFallback(rawResponse, state, userId) {
    try {
        return (0, aiResponseParser_1.validateResponse)(rawResponse);
    }
    catch (error) {
        console.error(`[${userId}] Gemini validation failed. Error:`, error);
        return (0, fallbackEngine_1.generateFallbackInsight)(state, userId);
    }
}
/**
 * The final, ultra-lazy, race-safe orchestrator pipeline.
 */
async function generateBehavioralInsight(state, userId) {
    let firestoreReads = 0;
    let firestoreWrites = 0;
    const returnFallback = (reason) => {
        (0, logger_1.logAIPipeline)({ userId, path: "fallback", reason, firestoreReads, firestoreWrites, preventedDuplicateCall: false });
        return (0, fallbackEngine_1.generateFallbackInsight)(state, userId);
    };
    // 1. STRICT SUBMISSION LOCK (In-Memory)
    if (state.user.hasSubmittedToday) {
        return returnFallback("submitted");
    }
    // 2. NODE-CACHE CHECK (In-Memory)
    const localCache = (0, cacheService_1.getLocalCache)(state, userId);
    if (localCache) {
        (0, logger_1.logAIPipeline)({ userId, path: "cache", reason: "cache-hit", firestoreReads, firestoreWrites, preventedDuplicateCall: false });
        return localCache;
    }
    // 3. & 4. QUICK HEURISTICS (In-Memory)
    if (!(0, aiUsageController_1.quickTriggerCheck)(state) || !(0, aiUsageController_1.likelyNeedsAI)(state)) {
        return returnFallback("no-trigger");
    }
    // 5. FETCH DISTRIBUTED STATE (1 Read)
    const aiMeta = await (0, stateManager_1.fetchAIMeta)(userId);
    firestoreReads++;
    // 6. & 7. RATE LIMIT & COOLDOWN (In-Memory evaluating fetched state)
    try {
        (0, stateManager_1.checkRateLimitAndCooldown)(aiMeta);
    }
    catch (e) {
        return returnFallback(e === "RATE_LIMIT_EXCEEDED" ? "rate-limit" : "cooldown");
    }
    // 8. STRICT EVENT-DRIVEN CHECK
    if (!(0, aiUsageController_1.shouldCallAI)(state, aiMeta.prevState)) {
        return returnFallback("no-trigger");
    }
    // 9. FIRESTORE CACHE CHECK (1 Read)
    const fsCache = await (0, cacheService_1.getFirestoreCache)(state, userId);
    firestoreReads++;
    if (fsCache) {
        (0, logger_1.logAIPipeline)({ userId, path: "cache", reason: "cache-hit", firestoreReads, firestoreWrites, preventedDuplicateCall: false });
        return fsCache;
    }
    // 10. ACQUIRE LOCK VIA TRANSACTION (1 Write)
    try {
        await (0, stateManager_1.acquireAILock)(userId);
        firestoreWrites++;
    }
    catch (e) {
        // Fails fast if locked or racing
        (0, logger_1.logAIPipeline)({
            userId, path: "fallback", reason: "locked", firestoreReads, firestoreWrites, preventedDuplicateCall: true
        });
        return (0, fallbackEngine_1.generateFallbackInsight)(state, userId);
    }
    let finalResponse;
    try {
        // 12. CALL GEMINI
        const systemPrompt = (0, aiPromptBuilder_1.buildSystemPrompt)(state);
        const rawResponse = await (0, aiService_1.callBehavioralLLM)(systemPrompt);
        // 13. VALIDATE
        finalResponse = validateOrFallback(rawResponse, state, userId);
        // 14. BATCH WRITES: CACHE + RELEASE LOCK + UPDATE META (2 Writes)
        await (0, cacheService_1.setDistributedCache)(state, userId, finalResponse);
        await (0, stateManager_1.finalizeAIOperation)(userId, state);
        firestoreWrites += 2;
        (0, logger_1.logAIPipeline)({ userId, path: "ai", reason: "ai-success", firestoreReads, firestoreWrites, preventedDuplicateCall: false });
        return finalResponse;
    }
    catch (error) {
        // 15. FAIL-SAFE LOCK RELEASE
        await (0, stateManager_1.releaseAILockSafely)(userId);
        firestoreWrites++;
        (0, logger_1.logAIPipeline)({ userId, path: "error", reason: "ai-failed", firestoreReads, firestoreWrites, preventedDuplicateCall: false });
        return (0, fallbackEngine_1.generateFallbackInsight)(state, userId);
    }
}
//# sourceMappingURL=generateBehavioralInsight.js.map