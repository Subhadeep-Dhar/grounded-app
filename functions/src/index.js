const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Badge definitions
const BADGE_CHECKS = [
  { id: '3_day_streak', check: (u) => (u.streakCount || 0) >= 3 },
  { id: '7_day_streak', check: (u) => (u.streakCount || 0) >= 7 },
  { id: '14_day_streak', check: (u) => (u.streakCount || 0) >= 14 },
  { id: '5_completions', check: (u) => (u.totalCompletions || 0) >= 5 },
  { id: '30_completions', check: (u) => (u.totalCompletions || 0) >= 30 },
  { id: 'high_trust', check: (u) => (u.trustScore || 0) >= 80 },
];

// ─── Submission Trigger ────────────────────────
exports.onSubmissionCreate = onDocumentCreated(
  {
    document: "submissions/{id}",
    region: "us-central1",
  },
  async (event) => {
    const data = event.data.data();
    const ref = event.data.ref;

    const userRef = db.collection("users").doc(data.userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.error("User not found:", data.userId);
      return;
    }

    const user = userSnap.data();

    // Check and award badges
    const updatedUser = {
      ...user,
      trustScore: user.trustScore ?? 0,
      streakCount: user.streakCount ?? 0,
      totalCompletions: user.totalCompletions ?? 0,
    };

    let badges = user.badges || [];
    for (const badge of BADGE_CHECKS) {
      if (!badges.includes(badge.id) && badge.check(updatedUser)) {
        badges.push(badge.id);
        console.log(`Badge awarded to ${data.userId}: ${badge.id}`);
      }
    }

    // Update user badges
    await userRef.update({
      badges,
    });

    // Update submission with server-side validation
    await ref.update({
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      serverValidated: true,
    });

    console.log("Processed submission:", ref.id, "Status:", data.status);
  }
);

// ─── Scheduled Job: Miss Detection (7:30 AM IST daily) ────
exports.markMissedUsers = onSchedule(
  {
    schedule: "30 7 * * *",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    const today = new Date().toDateString();
    const usersSnap = await db.collection("users").get();

    let missedCount = 0;

    for (const doc of usersSnap.docs) {
      const user = doc.data();

      // Skip if already completed or already marked missed today
      if (user.lastCompletedDate === today) continue;
      if (user.lastMissedDate === today) continue;

      // Mark as missed
      const updates = {
        lastMissedDate: today,
        canRecover: true,
      };

      // Reset streak if they missed (but allow recovery)
      if (user.streakCount > 0) {
        // Don't reset yet — recovery window allows next day
        updates.missWarning = true;
      }

      await db.collection("users").doc(doc.id).update(updates);
      missedCount++;
      console.log(`User missed: ${doc.id}`);
    }

    console.log(`Miss detection completed. ${missedCount} users missed.`);
  }
);

// ─── Scheduled Job: Cleanup (Every 12 hours) ────
// Safeguards storage costs and privacy by removing ephemeral verification content.
exports.cleanupOldSubmissions = onSchedule(
  {
    schedule: "0 */12 * * *", 
    timeZone: "Asia/Kolkata",
    memory: "256MiB", // Lightweight
  },
  async () => {
    const now = Date.now();
    const RETENTION_MS = 24 * 60 * 60 * 1000;
    const CLEANUP_LIMIT = 200;
    
    // 1. Fetch expired submissions using expiresAt (Primary) or legacy timestamp (Fallback)
    let subSnap = await db.collection("submissions")
      .where("expiresAt", "<", now)
      .limit(CLEANUP_LIMIT)
      .get();
      
    if (subSnap.empty) {
      const legacyCutoff = now - RETENTION_MS;
      subSnap = await db.collection("submissions")
        .where("timestamp", "<", legacyCutoff)
        .limit(CLEANUP_LIMIT)
        .get();
    }

    if (subSnap.empty) {
      console.log("[Cleanup] No expired submissions found.");
      return;
    }

    console.log(`[Cleanup] Found ${subSnap.size} expired candidates. Starting removal...`);

    const storage = admin.storage().bucket();
    let deletedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const doc of subSnap.docs) {
      const data = doc.data();

      // Safeguard: Ensure we don't delete very recent/active uploads 
      const age = now - (data.timestamp || 0);
      if (age < 3600000 && !data.expiresAt) {
        skippedCount++;
        continue;
      }

      try {
        // 1. Delete image from Storage if it exists
        if (data.mediaUrl) {
          const urlParts = data.mediaUrl.split('/o/');
          if (urlParts.length > 1) {
            const filePathWithParams = urlParts[1].split('?')[0];
            const filePath = decodeURIComponent(filePathWithParams);
            
            // Safety check: ONLY delete from ephemeral folders (proofs/)
            // Never touch profile/ or permanent/ assets
            if (filePath.startsWith('proofs/')) {
              await storage.file(filePath).delete().catch(e => {
                if (e.code !== 404) console.warn(`[Cleanup] Storage skip for ${filePath}:`, e.message);
              });
            } else {
              console.log(`[Cleanup] Safeguard: Skipping non-ephemeral path: ${filePath}`);
            }
          }
        }

        // 2. Delete Firestore document
        await doc.ref.delete();
        deletedCount++;
      } catch (error) {
        failedCount++;
        console.error(`[Cleanup] Error processing ${doc.id}:`, error);
      }
    }

    console.log(`[Cleanup] Finished. Deleted: ${deletedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
  }
);