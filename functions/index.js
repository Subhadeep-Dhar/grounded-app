const functions = require('./src/index');
exports.onSubmissionCreate = functions.onSubmissionCreate;
exports.cleanupOldSubmissions = functions.cleanupOldSubmissions;
exports.dailyTrustReconciliation = functions.dailyTrustReconciliation;
exports.backfillStaleUsers = functions.backfillStaleUsers;
exports.getBehavioralInsight = require('./lib/ai/index').getBehavioralInsight;