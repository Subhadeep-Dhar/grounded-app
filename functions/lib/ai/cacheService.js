"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrustBucket = getTrustBucket;
exports.getStreakBucket = getStreakBucket;
exports.getLocalCache = getLocalCache;
exports.getFirestoreCache = getFirestoreCache;
exports.setDistributedCache = setDistributedCache;
const node_cache_1 = __importDefault(require("node-cache"));
const firebaseClient_1 = require("./firebaseClient");
const insightCache = new node_cache_1.default({ stdTTL: 1200, checkperiod: 120 }); // 20 mins
function getTrustBucket(score) {
    if (score <= 40)
        return "low";
    if (score <= 70)
        return "medium";
    return "high";
}
function getStreakBucket(streak) {
    if (streak === 0)
        return "0";
    if (streak <= 3)
        return "1-3";
    if (streak <= 7)
        return "4-7";
    if (streak <= 14)
        return "8-14";
    return "15+";
}
function generateCacheKey(state, userId) {
    const trustBucket = getTrustBucket(state.user.trustScore);
    const streakBucket = getStreakBucket(state.user.streakCount);
    const isSubmitted = state.user.hasSubmittedToday;
    const cautionLevel = state.context.cautionLevel;
    const isRainLikely = state.context.isRainLikely;
    return `${userId}_${trustBucket}_${streakBucket}_${isSubmitted}_${cautionLevel}_${isRainLikely}`;
}
/**
 * 1. Primary check: Node Cache (Instant, Free)
 */
function getLocalCache(state, userId) {
    const key = generateCacheKey(state, userId);
    return insightCache.get(key);
}
/**
 * 2. Secondary check: Firestore Cache (Distributed, 1 Read)
 * ONLY called if shouldCallAI passes and cooldown is false.
 */
async function getFirestoreCache(state, userId) {
    const key = generateCacheKey(state, userId);
    const docRef = firebaseClient_1.db.collection("ai_cache").doc(key);
    const snap = await docRef.get();
    if (snap.exists) {
        const data = snap.data();
        // Check TTL manually just in case
        if (data && data.expiresAt > Date.now()) {
            const response = data.response;
            // Repopulate local cache
            insightCache.set(key, response);
            return response;
        }
    }
    return null;
}
/**
 * Store in both Node Cache and Firestore Cache.
 */
async function setDistributedCache(state, userId, response) {
    const key = generateCacheKey(state, userId);
    // 1. Local
    insightCache.set(key, response);
    // 2. Distributed
    await firebaseClient_1.db.collection("ai_cache").doc(key).set({
        response,
        expiresAt: Date.now() + (20 * 60 * 1000) // 20 mins
    });
}
//# sourceMappingURL=cacheService.js.map