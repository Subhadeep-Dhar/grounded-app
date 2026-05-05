const functions = require('./src/index');
exports.onSubmissionCreate = functions.onSubmissionCreate;
exports.markMissedUsers = functions.markMissedUsers;
exports.cleanupOldSubmissions = functions.cleanupOldSubmissions;
exports.getBehavioralInsight = require('./lib/ai/index').getBehavioralInsight;