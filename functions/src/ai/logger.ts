export interface AILogPayload {
  userId: string;
  path: "fallback" | "cache" | "ai" | "error";
  reason: 
    | "submitted" 
    | "no-trigger" 
    | "cooldown" 
    | "rate-limit" 
    | "cache-hit" 
    | "locked"
    | "ai-success"
    | "ai-failed";
  firestoreReads: number;
  firestoreWrites: number;
  preventedDuplicateCall: boolean;
  lockWaitTime?: number;
}

/**
 * Structured observability logger for the AI pipeline.
 */
export function logAIPipeline(payload: AILogPayload): void {
  // In production, this goes to GCP Logging / Stackdriver automatically via Cloud Functions
  console.log(JSON.stringify({
    service: "behavioral-intelligence-engine",
    timestamp: new Date().toISOString(),
    ...payload
  }));
}
