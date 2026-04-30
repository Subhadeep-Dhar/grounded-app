import { AIStateInput } from "./aiPromptBuilder";
import { AIBehavioralResponse } from "./aiResponseParser";

/**
 * Quick hash function to deterministically cycle through variants
 * based on userId and the current date, ensuring daily variety without DB reads.
 */
function getVariantIndex(userId: string, count: number): number {
  const dateStr = new Date().toDateString();
  const hashStr = userId + dateStr;
  let hash = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hash = (hash << 5) - hash + hashStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % count;
}

/**
 * Generates an intelligent fallback response strictly via rules,
 * saving AI costs completely while preserving persona.
 */
export function generateFallbackInsight(state: AIStateInput, userId: string): AIBehavioralResponse {
  const { context, user, miss } = state;

  // STRICT SUBMISSION LOCK: Takes priority over ALL logic
  if (user.hasSubmittedToday) {
    const notifications = [
      "You showed up today—hold that standard.",
      "Requirement fulfilled. Identity reinforced.",
      "Another day banked builds a stronger foundation."
    ];
    return {
      notification: notifications[getVariantIndex(userId, notifications.length)],
      insight: "Consistency speaks for itself. The environment is secondary to your commitment.",
      challengeGuidance: "No further action needed today. Rest and prepare for tomorrow."
    };
  }

  // Rule 1: Missing today (recovery mode)
  if (miss.missedToday) {
    if (miss.isValidReason) {
      return {
        notification: "Rest is valid. Tomorrow is a new start.",
        insight: "Recovery is part of the process. Your established identity allows for strategic pauses.",
        challengeGuidance: "Focus on recovery today. Prepare to resume your commitment tomorrow without guilt."
      };
    } else {
      return {
        notification: "You missed yesterday. Reclaim your momentum today.",
        insight: "Momentum is built through unbroken chains. A pause requires immediate action to prevent a slide.",
        challengeGuidance: "Prioritize completion today above all else. Re-establish your baseline."
      };
    }
  }

  // Rule 2: Bad weather adaptation
  if (context.isRainLikely || context.cautionLevel === "high") {
    const weatherNotifications = [
      "Conditions are difficult. Shift your presence indoors.",
      "Adapt your environment, not your commitment.",
      "Conditions shift—your consistency shouldn’t."
    ];
    return {
      notification: weatherNotifications[getVariantIndex(userId, weatherNotifications.length)],
      insight: "Adversity tests consistency. Intelligent adaptation means changing the location, not the commitment.",
      challengeGuidance: "Find a way to show up in a sheltered environment today. Safety and consistency can coexist."
    };
  }

  // Rule 3: Trust Score & Persona
  if (user.trustScore >= 71) {
    return {
      notification: "Maintain your standard today.",
      insight: "Your high trust score reflects an internalized habit. The environment is just a backdrop to your consistency.",
      challengeGuidance: "Execute with the usual efficiency. You know what to do."
    };
  } else if (user.trustScore <= 40) {
    return {
      notification: "Action required to rebuild trust.",
      insight: "Inconsistency weakens the foundation. Today is an opportunity to prove reliability to the system.",
      challengeGuidance: "Show up. Don't overthink it, just complete the requirement."
    };
  }

  // Default Fallback
  return {
    notification: "Continue your established presence.",
    insight: "Consistency is built through deliberate daily action.",
    challengeGuidance: "Assess your immediate surroundings and execute your presence accordingly."
  };
}
