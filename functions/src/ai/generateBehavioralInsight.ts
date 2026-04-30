import { AIStateInput, buildSystemPrompt } from "./aiPromptBuilder";
import { callBehavioralLLM } from "./aiService";
import { validateResponse, AIBehavioralResponse } from "./aiResponseParser";
import { shouldCallAI, quickTriggerCheck, likelyNeedsAI } from "./aiUsageController";
import { generateFallbackInsight } from "./fallbackEngine";
import { getLocalCache, getFirestoreCache, setDistributedCache } from "./cacheService";
import { fetchAIMeta, checkRateLimitAndCooldown, acquireAILock, finalizeAIOperation, releaseAILockSafely } from "./stateManager";
import { logAIPipeline } from "./logger";

function validateOrFallback(rawResponse: string | null, state: AIStateInput, userId: string): AIBehavioralResponse {
  try {
    return validateResponse(rawResponse);
  } catch (error) {
    console.error(`[${userId}] Gemini validation failed. Error:`, error);
    return generateFallbackInsight(state, userId);
  }
}

/**
 * The final, ultra-lazy, race-safe orchestrator pipeline.
 */
export async function generateBehavioralInsight(
  state: AIStateInput,
  userId: string
): Promise<AIBehavioralResponse> {
  let firestoreReads = 0;
  let firestoreWrites = 0;

  const returnFallback = (reason: any) => {
    logAIPipeline({ userId, path: "fallback", reason, firestoreReads, firestoreWrites, preventedDuplicateCall: false });
    return generateFallbackInsight(state, userId);
  };

  // 1. STRICT SUBMISSION LOCK (In-Memory)
  if (state.user.hasSubmittedToday) {
    return returnFallback("submitted");
  }

  // 2. NODE-CACHE CHECK (In-Memory)
  const localCache = getLocalCache(state, userId);
  if (localCache) {
    logAIPipeline({ userId, path: "cache", reason: "cache-hit", firestoreReads, firestoreWrites, preventedDuplicateCall: false });
    return localCache;
  }

  // 3. & 4. QUICK HEURISTICS (In-Memory)
  if (!quickTriggerCheck(state) || !likelyNeedsAI(state)) {
    return returnFallback("no-trigger");
  }

  // 5. FETCH DISTRIBUTED STATE (1 Read)
  const aiMeta = await fetchAIMeta(userId);
  firestoreReads++;

  // 6. & 7. RATE LIMIT & COOLDOWN (In-Memory evaluating fetched state)
  try {
    checkRateLimitAndCooldown(aiMeta);
  } catch (e: any) {
    return returnFallback(e === "RATE_LIMIT_EXCEEDED" ? "rate-limit" : "cooldown");
  }

  // 8. STRICT EVENT-DRIVEN CHECK
  if (!shouldCallAI(state, aiMeta.prevState)) {
    return returnFallback("no-trigger");
  }

  // 9. FIRESTORE CACHE CHECK (1 Read)
  const fsCache = await getFirestoreCache(state, userId);
  firestoreReads++;
  if (fsCache) {
    logAIPipeline({ userId, path: "cache", reason: "cache-hit", firestoreReads, firestoreWrites, preventedDuplicateCall: false });
    return fsCache;
  }

  // 10. ACQUIRE LOCK VIA TRANSACTION (1 Write)
  try {
    await acquireAILock(userId);
    firestoreWrites++;
  } catch (e: any) {
    // Fails fast if locked or racing
    logAIPipeline({ 
      userId, path: "fallback", reason: "locked", firestoreReads, firestoreWrites, preventedDuplicateCall: true 
    });
    return generateFallbackInsight(state, userId);
  }

  let finalResponse: AIBehavioralResponse;
  
  try {
    // 12. CALL GEMINI
    const systemPrompt = buildSystemPrompt(state);
    const rawResponse = await callBehavioralLLM(systemPrompt);

    // 13. VALIDATE
    finalResponse = validateOrFallback(rawResponse, state, userId);

    // 14. BATCH WRITES: CACHE + RELEASE LOCK + UPDATE META (2 Writes)
    await setDistributedCache(state, userId, finalResponse);
    await finalizeAIOperation(userId, state);
    firestoreWrites += 2;

    logAIPipeline({ userId, path: "ai", reason: "ai-success", firestoreReads, firestoreWrites, preventedDuplicateCall: false });
    return finalResponse;

  } catch (error) {
    // 15. FAIL-SAFE LOCK RELEASE
    await releaseAILockSafely(userId);
    firestoreWrites++;
    logAIPipeline({ userId, path: "error", reason: "ai-failed", firestoreReads, firestoreWrites, preventedDuplicateCall: false });
    return generateFallbackInsight(state, userId);
  }
}
