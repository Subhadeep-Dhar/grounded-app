import { onCall, HttpsError } from "firebase-functions/v2/https";
import { generateBehavioralInsight } from "./generateBehavioralInsight";
import { AIStateInput } from "./aiPromptBuilder";

/**
 * Firebase Cloud Function (Callable) to generate behavioral insights.
 * Validates the input state and intelligently orchestrates AI, Fallbacks, and Cache.
 */
export const getBehavioralInsight = onCall(
  {
    region: "us-central1",
    // enforceAppCheck: true, // Uncomment if AppCheck is configured
  },
  async (request) => {
    // 1. Authentication check
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError(
        "unauthenticated",
        "User must be logged in to get behavioral insights."
      );
    }
    
    const userId = request.auth.uid;

    // 2. Validate input payload loosely before sending to AI
    const state = request.data.state as Partial<AIStateInput>;
    
    if (!state || !state.weather || !state.context || !state.user || !state.miss) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required current state objects (weather, context, user, miss)."
      );
    }

    try {
      // 3. Generate insight via the Optimized Pipeline
      const insight = await generateBehavioralInsight(
        state as AIStateInput,
        userId
      );
      
      return insight;
    } catch (error) {
      console.error("Failed to generate behavioral insight:", error);
      throw new HttpsError("internal", "An error occurred while generating the insight.");
    }
  }
);
