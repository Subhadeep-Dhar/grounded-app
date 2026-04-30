"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAIMeta = fetchAIMeta;
exports.checkRateLimitAndCooldown = checkRateLimitAndCooldown;
exports.acquireAILock = acquireAILock;
exports.finalizeAIOperation = finalizeAIOperation;
exports.releaseAILockSafely = releaseAILockSafely;
const firebaseClient_1 = require("./firebaseClient");
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const LOCK_TIMEOUT_MS = 10 * 1000; // 10 seconds
/**
 * Fetches the aiMeta document. Returns defaults if it doesn't exist.
 */
async function fetchAIMeta(userId) {
    const docRef = firebaseClient_1.db.collection("users").doc(userId).collection("aiMeta").doc("data");
    const snap = await docRef.get();
    if (!snap.exists) {
        return {
            lastAICall: 0,
            rateLimitCount: 0,
            rateLimitWindowStart: 0,
            lock: false,
            lockTimestamp: 0
        };
    }
    return snap.data();
}
/**
 * Checks rate limit and cooldown purely from memory (using the fetched aiMeta).
 * Throws specific strings if blocked.
 */
function checkRateLimitAndCooldown(meta) {
    const now = Date.now();
    // 1. Rate Limit
    if (now - meta.rateLimitWindowStart < RATE_LIMIT_WINDOW_MS) {
        if (meta.rateLimitCount >= RATE_LIMIT_MAX) {
            throw "RATE_LIMIT_EXCEEDED";
        }
    }
    // 2. Cooldown (30 mins)
    if (now - meta.lastAICall < 30 * 60 * 1000) {
        throw "COOLDOWN_ACTIVE";
    }
}
/**
 * Atomically acquires the lock via Firestore Transaction.
 * Also re-checks cooldown inside the transaction to strictly prevent race conditions.
 * Updates the rate limit counter here, since we are committed to the AI path.
 */
async function acquireAILock(userId) {
    const docRef = firebaseClient_1.db.collection("users").doc(userId).collection("aiMeta").doc("data");
    return firebaseClient_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const meta = snap.exists
            ? snap.data()
            : {
                lastAICall: 0,
                rateLimitCount: 0,
                rateLimitWindowStart: Date.now(),
                lock: false,
                lockTimestamp: 0
            };
        const now = Date.now();
        // Stale lock check
        const isStale = now - meta.lockTimestamp > LOCK_TIMEOUT_MS;
        // Fail fast if actively locked
        if (meta.lock && !isStale) {
            throw "LOCKED";
        }
        // Re-check cooldown (Anti-race condition)
        if (now - meta.lastAICall < 30 * 60 * 1000) {
            throw "COOLDOWN_ACTIVE_RACE";
        }
        // Rate Limit Increment
        let newCount = meta.rateLimitCount;
        let newWindowStart = meta.rateLimitWindowStart;
        if (now - meta.rateLimitWindowStart >= RATE_LIMIT_WINDOW_MS) {
            newCount = 1;
            newWindowStart = now;
        }
        else {
            newCount++;
        }
        if (newCount > RATE_LIMIT_MAX) {
            throw "RATE_LIMIT_EXCEEDED";
        }
        // Acquire lock and update rate limit simultaneously
        tx.set(docRef, {
            ...meta,
            lock: true,
            lockTimestamp: now,
            rateLimitCount: newCount,
            rateLimitWindowStart: newWindowStart
        });
        return meta;
    });
}
/**
 * Releases the lock, updates cooldown, and stores previous state in a single write.
 */
async function finalizeAIOperation(userId, currentState) {
    const docRef = firebaseClient_1.db.collection("users").doc(userId).collection("aiMeta").doc("data");
    await docRef.set({
        lastAICall: Date.now(),
        prevState: currentState,
        lock: false,
        lockTimestamp: 0
    }, { merge: true });
}
/**
 * Failsafe: Releases the lock if the AI operation failed.
 */
async function releaseAILockSafely(userId) {
    const docRef = firebaseClient_1.db.collection("users").doc(userId).collection("aiMeta").doc("data");
    await docRef.set({
        lock: false,
        lockTimestamp: 0
    }, { merge: true });
}
//# sourceMappingURL=stateManager.js.map