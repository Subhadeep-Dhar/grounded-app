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
exports.cleanupOldSubmissions = onSchedule(
  {
    schedule: "0 */12 * * *", // Run every 12 hours
    timeZone: "Asia/Kolkata",
  },
  async () => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const subSnap = await db.collection("submissions")
      .where("timestamp", "<", oneDayAgo)
      .get();

    console.log(`Starting cleanup for ${subSnap.size} old submissions...`);

    const storage = admin.storage().bucket();
    let deleteCount = 0;

    for (const doc of subSnap.docs) {
      const data = doc.data();

      try {
        // 1. Delete image from Storage if it exists
        if (data.mediaUrl) {
          // Extract filename from URL (Firebase Storage format)
          // Example: https://firebasestorage.googleapis.com/v0/b/[bucket]/o/submissions%2F[filename]?alt=media
          const urlParts = data.mediaUrl.split('/o/');
          if (urlParts.length > 1) {
            const filePathWithParams = urlParts[1].split('?')[0];
            const filePath = decodeURIComponent(filePathWithParams);
            
            console.log(`Deleting storage file: ${filePath}`);
            await storage.file(filePath).delete().catch(e => console.log("File already deleted or not found"));
          }
        }

        // 2. Delete Firestore document
        await doc.ref.delete();
        deleteCount++;
      } catch (error) {
        console.error(`Error deleting submission ${doc.id}:`, error);
      }
    }

    console.log(`Cleanup completed. ${deleteCount} submissions deleted.`);
  }
);