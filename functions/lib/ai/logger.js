"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAIPipeline = logAIPipeline;
/**
 * Structured observability logger for the AI pipeline.
 */
function logAIPipeline(payload) {
    // In production, this goes to GCP Logging / Stackdriver automatically via Cloud Functions
    console.log(JSON.stringify({
        service: "behavioral-intelligence-engine",
        timestamp: new Date().toISOString(),
        ...payload
    }));
}
//# sourceMappingURL=logger.js.map