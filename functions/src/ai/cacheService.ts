import NodeCache from "node-cache";
import { AIStateInput } from "./aiPromptBuilder";
import { AIBehavioralResponse } from "./aiResponseParser";
import { db } from "./firebaseClient";

const insightCache = new NodeCache({ stdTTL: 1200, checkperiod: 120 }); // 20 mins

export function getTrustBucket(score: number): "low" | "medium" | "high" {
  if (score <= 40) return "low";
  if (score <= 70) return "medium";
  return "high";
}

export function getStreakBucket(streak: number): string {
  if (streak === 0) return "0";
  if (streak <= 3) return "1-3";
  if (streak <= 7) return "4-7";
  if (streak <= 14) return "8-14";
  return "15+";
}

function generateCacheKey(state: AIStateInput, userId: string): string {
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
export function getLocalCache(state: AIStateInput, userId: string): AIBehavioralResponse | undefined {
  const key = generateCacheKey(state, userId);
  return insightCache.get<AIBehavioralResponse>(key);
}

/**
 * 2. Secondary check: Firestore Cache (Distributed, 1 Read)
 * ONLY called if shouldCallAI passes and cooldown is false.
 */
export async function getFirestoreCache(state: AIStateInput, userId: string): Promise<AIBehavioralResponse | null> {
  const key = generateCacheKey(state, userId);
  const docRef = db.collection("ai_cache").doc(key);
  const snap = await docRef.get();

  if (snap.exists) {
    const data = snap.data();
    // Check TTL manually just in case
    if (data && data.expiresAt > Date.now()) {
      const response = data.response as AIBehavioralResponse;
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
export async function setDistributedCache(state: AIStateInput, userId: string, response: AIBehavioralResponse): Promise<void> {
  const key = generateCacheKey(state, userId);
  
  // 1. Local
  insightCache.set(key, response);

  // 2. Distributed
  await db.collection("ai_cache").doc(key).set({
    response,
    expiresAt: Date.now() + (20 * 60 * 1000) // 20 mins
  });
}
