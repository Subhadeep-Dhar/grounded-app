"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickTriggerCheck = quickTriggerCheck;
exports.likelyNeedsAI = likelyNeedsAI;
exports.shouldCallAI = shouldCallAI;
const cacheService_1 = require("./cacheService");
/**
 * Super lightweight heuristic to instantly drop 80-90% of requests without touching Firestore.
 */
function quickTriggerCheck(state) {
    // If user hasn't submitted yet, and weather is bad or they missed, it's a trigger.
    if (state.miss.missedToday)
        return true;
    if (state.context.isRainLikely || state.weather.rainProbability > 60)
        return true;
    if (state.context.cautionLevel !== "low")
        return true;
    // Check if trust score is near a bucket boundary (e.g., 38-42, 68-72)
    const ts = state.user.trustScore;
    if ((ts >= 38 && ts <= 42) || (ts >= 68 && ts <= 72)) {
        return true;
    }
    // Check if near a streak milestone
    const streak = state.user.streakCount;
    const milestones = [3, 7, 10, 14, 30];
    if (milestones.includes(streak) || milestones.includes(streak + 1)) {
        return true;
    }
    return false; // Safely drop to fallback
}
/**
 * A second, slightly broader heuristic applied before fetching aiMeta,
 * to be extra sure we don't do a useless Firestore read.
 */
function likelyNeedsAI(state) {
    // Just an alias to quickTriggerCheck for now, but separates concerns 
    // if we want different strictness levels.
    return quickTriggerCheck(state);
}
/**
 * Deterministic full evaluation. Only runs AFTER we fetch prevState from Firestore.
 */
function shouldCallAI(currentState, previousState) {
    if (!previousState) {
        return quickTriggerCheck(currentState);
    }
    // 1. Missed Day Logged
    if (currentState.miss.missedToday && !previousState.miss.missedToday)
        return true;
    // 2. Weather Shift
    const rainDelta = Math.abs(currentState.weather.rainProbability - previousState.weather.rainProbability);
    if (rainDelta > 40)
        return true;
    if (currentState.context.cautionLevel !== previousState.context.cautionLevel)
        return true;
    // 3. Trust Bucket Change
    if ((0, cacheService_1.getTrustBucket)(previousState.user.trustScore) !== (0, cacheService_1.getTrustBucket)(currentState.user.trustScore)) {
        return true;
    }
    // 4. Streak Milestone
    const milestones = [3, 7, 10, 14, 30];
    if (currentState.user.streakCount !== previousState.user.streakCount &&
        milestones.includes(currentState.user.streakCount)) {
        return true;
    }
    return false;
}
//# sourceMappingURL=aiUsageController.js.map