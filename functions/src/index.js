"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ─── Inline config (mirrors src/constants/config.js) ────────────────────────
const TRUST_MIN = 0;
const MISSED_DAY_PENALTY = -5;   // per unexcused missed day
const STREAK_BREAK_PENALTY = -2; // extra one-time penalty for breaking streak
const PENALTY_CAP = -15;         // most negative a single reconciliation can apply
const FEED_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24h

const RECON_PAGE_SIZE = 100; // users per pagination page
const CLEANUP_LIMIT = 200;   // submissions per cleanup run

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert any Firestore Timestamp / plain number / Date to milliseconds.
 * Handles admin SDK Timestamp, serialised {seconds,nanoseconds}, and raw numbers.
 */
const toMs = (val) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (typeof val.toMillis === "function") return val.toMillis(); // admin Timestamp
  if (val._seconds) return val._seconds * 1000;
  if (val.seconds) return val.seconds * 1000;
  if (val instanceof Date) return val.getTime();
  return 0;
};

/**
 * Missed-day trust penalty. Mirrors client calculateMissedDayPenalty().
 * Returns a NEGATIVE number capped at PENALTY_CAP.
 */
const calcPenalty = (daysMissed) =>
  Math.max(daysMissed * MISSED_DAY_PENALTY + STREAK_BREAK_PENALTY, PENALTY_CAP);

/**
 * Safe ephemeral Storage path check.
 * Only proofs/, watermarks/, shares/, temp/ are ephemeral — never avatars/ or assets/.
 */
const isEphemeralPath = (filePath) =>
  filePath.startsWith("proofs/") ||
  filePath.startsWith("watermarks/") ||
  filePath.startsWith("shares/") ||
  filePath.startsWith("temp/");

/** Extract Storage file path from a download URL. Returns null if unparseable. */
const extractStoragePath = (url) => {
  if (!url || typeof url !== "string") return null;
  const parts = url.split("/o/");
  if (parts.length < 2) return null;
  try {
    return decodeURIComponent(parts[1].split("?")[0]);
  } catch {
    return null;
  }
};

// ─── Badge definitions (cloud-side mirror) ──────────────────────────────────
const BADGE_CHECKS = [
  { id: "3_day_streak",   check: (u) => (u.streakCount || 0) >= 3 },
  { id: "7_day_streak",   check: (u) => (u.streakCount || 0) >= 7 },
  { id: "14_day_streak",  check: (u) => (u.streakCount || 0) >= 14 },
  { id: "5_completions",  check: (u) => (u.totalCompletions || 0) >= 5 },
  { id: "30_completions", check: (u) => (u.totalCompletions || 0) >= 30 },
  { id: "high_trust",     check: (u) => (u.trustScore || 0) >= 80 },
  { id: "trusted",        check: (u) => (u.trustScore || 0) >= 60 },
];

// ─── 1. Submission Trigger ───────────────────────────────────────────────────
exports.onSubmissionCreate = onDocumentCreated(
  { document: "submissions/{id}", region: "us-central1" },
  async (event) => {
    const data = event.data.data();
    const ref  = event.data.ref;

    const userRef  = db.collection("users").doc(data.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.error("[Submission] User not found:", data.userId);
      return;
    }

    const user = userSnap.data();
    const merged = {
      ...user,
      trustScore:       user.trustScore       ?? 0,
      streakCount:      user.streakCount       ?? 0,
      totalCompletions: user.totalCompletions  ?? 0,
    };

    // Award badges
    const badges = Array.isArray(user.badges) ? [...user.badges] : [];
    for (const badge of BADGE_CHECKS) {
      if (!badges.includes(badge.id) && badge.check(merged)) {
        badges.push(badge.id);
        console.log(`[Submission] Badge awarded ${data.userId}: ${badge.id}`);
      }
    }

    // Sync lastReconciliationDate so daily job uses the correct baseline.
    await userRef.update({
      badges,
      lastReconciliationDate: Date.now(),
    });

    await ref.update({
      processedAt:     admin.firestore.FieldValue.serverTimestamp(),
      serverValidated: true,
    });

    console.log("[Submission] Processed:", ref.id, "status:", data.status);
  }
);

// ─── 2. Daily Trust & Streak Reconciliation (2:00 AM IST) ───────────────────
// Processes ALL users via cursor pagination so no user is missed.
// Applies missed-day penalty and streak reset for inactive users.
// Respects regionStatus === 'outside' (same as client reconciliation.js).
exports.dailyTrustReconciliation = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "Asia/Kolkata",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const now = Date.now();

    // Midnight of today in local time (IST computation is fine here —
    // what matters is the day boundary relative to wall-clock IST).
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);
    const todayMidnightMs = todayMidnight.getTime();

    console.log(`[Reconciliation] Starting at ${new Date(now).toISOString()}`);

    let lastDoc = null;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let batchCount = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let q = db.collection("users").orderBy("__name__").limit(RECON_PAGE_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      // Use WriteBatch (max 500 ops); our batch is ≤100 docs so always safe.
      const batch = db.batch();
      let batchHasWrites = false;

      for (const userDoc of snap.docs) {
        const user = userDoc.data();

        // Determine the latest known "good" point for this user.
        // Use whichever is more recent: lastReconciliationDate or lastSubmissionDate.
        const lastReconMs = Math.max(
          toMs(user.lastReconciliationDate),
          toMs(user.lastSubmissionDate)
        );
        // Fall back to account creation date if neither exists.
        const baselineMs = lastReconMs || toMs(user.createdAt) || 0;

        const baselineMidnight = new Date(baselineMs);
        baselineMidnight.setHours(0, 0, 0, 0);

        const daysSince = Math.floor(
          (todayMidnightMs - baselineMidnight.getTime()) / 86400000
        );

        // Already reconciled today — skip.
        if (daysSince <= 0) {
          totalProcessed++;
          continue;
        }

        // daysSince = 1 → last seen yesterday, today not over → no penalty yet.
        const missedPastDays = daysSince - 1;

        if (missedPastDays <= 0) {
          // Update timestamp so next run sees today as baseline.
          batch.update(userDoc.ref, { lastReconciliationDate: now });
          batchHasWrites = true;
          totalProcessed++;
          continue;
        }

        // Region-excluded users: freeze progression, no penalty.
        if (user.regionStatus === "outside") {
          batch.update(userDoc.ref, { lastReconciliationDate: now });
          batchHasWrites = true;
          totalProcessed++;
          continue;
        }

        // Apply penalty for unexcused missed days.
        const penalty = calcPenalty(missedPastDays);
        const currentTrust = typeof user.trustScore === "number" ? user.trustScore : 0;
        const newTrust = Math.max(TRUST_MIN, currentTrust + penalty);

        batch.update(userDoc.ref, {
          trustScore:              newTrust,
          streakCount:             0,
          lastReconciliationDate:  now,
          lastMissedPenaltyAt:     now,
          lastMissedDays:          missedPastDays,
        });
        batchHasWrites = true;
        totalUpdated++;

        console.log(
          `[Reconciliation] ${userDoc.id}: trust ${currentTrust}→${newTrust}` +
          ` | missed ${missedPastDays}d | penalty ${penalty}`
        );

        totalProcessed++;
      }

      if (batchHasWrites) {
        await batch.commit();
        batchCount++;
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < RECON_PAGE_SIZE) break; // last page
    }

    console.log(
      `[Reconciliation] Done. Batches: ${batchCount}, ` +
      `Processed: ${totalProcessed}, Updated: ${totalUpdated}`
    );
  }
);

// ─── 3. Storage & Firestore Cleanup (Every 12 hours) ────────────────────────
// Deletes expired submissions from Firestore + their proof images from Storage.
// Runs BOTH expiresAt and legacy timestamp queries so no old doc is missed.
exports.cleanupOldSubmissions = onSchedule(
  {
    schedule: "0 */12 * * *",
    timeZone: "Asia/Kolkata",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const now = Date.now();
    const legacyCutoff = now - FEED_EXPIRATION_MS;
    const bucket = admin.storage().bucket();

    // ── Query 1: docs with expiresAt field that has expired ──────────────────
    const q1 = db.collection("submissions")
      .where("expiresAt", "<", now)
      .limit(CLEANUP_LIMIT);

    // ── Query 2: legacy docs (no expiresAt) older than retention period ──────
    const q2 = db.collection("submissions")
      .where("timestamp", "<", legacyCutoff)
      .limit(CLEANUP_LIMIT);

    const [snap1, snap2] = await Promise.all([q1.get(), q2.get()]);

    // Deduplicate by document ID so we don't process the same doc twice.
    const docMap = new Map();
    snap1.docs.forEach((d) => docMap.set(d.id, d));
    snap2.docs.forEach((d) => docMap.set(d.id, d));

    if (docMap.size === 0) {
      console.log("[Cleanup] No expired submissions found.");
      return;
    }

    console.log(`[Cleanup] Found ${docMap.size} expired candidates.`);

    let deletedDocs = 0;
    let deletedFiles = 0;
    let skipped = 0;
    let failed = 0;

    // Use WriteBatch for Firestore deletes (commit every 400 to stay under 500 limit).
    const BATCH_FLUSH = 400;
    let batch = db.batch();
    let batchOps = 0;

    for (const [, docSnap] of docMap) {
      const data = docSnap.data();

      // Safeguard: skip anything created in the last hour that has no expiresAt
      // (could be an in-flight upload race condition).
      const ageMs = now - (toMs(data.timestamp) || 0);
      if (ageMs < 3_600_000 && !data.expiresAt) {
        skipped++;
        continue;
      }

      try {
        // 1. Delete Storage file (ephemeral paths only).
        if (data.mediaUrl) {
          const filePath = extractStoragePath(data.mediaUrl);
          if (filePath && isEphemeralPath(filePath)) {
            await bucket.file(filePath).delete().catch((e) => {
              if (e.code !== 404) {
                console.warn(`[Cleanup] Storage delete skip ${filePath}:`, e.message);
              }
            });
            deletedFiles++;
          } else if (filePath) {
            console.log(`[Cleanup] Safeguard: skipping non-ephemeral path: ${filePath}`);
          }
        }

        // 2. Queue Firestore doc deletion.
        batch.delete(docSnap.ref);
        batchOps++;
        deletedDocs++;

        // Flush batch if approaching limit.
        if (batchOps >= BATCH_FLUSH) {
          await batch.commit();
          batch = db.batch();
          batchOps = 0;
        }
      } catch (err) {
        failed++;
        console.error(`[Cleanup] Error on ${docSnap.id}:`, err.message);
      }
    }

    // Commit remaining.
    if (batchOps > 0) await batch.commit();

    console.log(
      `[Cleanup] Done. Docs deleted: ${deletedDocs}, ` +
      `Files deleted: ${deletedFiles}, Skipped: ${skipped}, Failed: ${failed}`
    );
  }
);

// ─── 4. One-time Backfill: Fix stale trustScore=50 users ────────────────────
// Invoke via: firebase functions:shell → backfillStaleUsers({})
// Or deploy and call via HTTP once. Safe to call multiple times (idempotent).
exports.backfillStaleUsers = onRequest(
  { region: "us-central1", memory: "512MiB", timeoutSeconds: 300 },
  async (req, res) => {
    // Minimal auth check — only allow POST with a secret header.
    const secret = req.headers["x-admin-secret"];
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      res.status(403).send("Forbidden");
      return;
    }

    const now = Date.now();

    // Find users with the old default trustScore of 50
    // (the old architecture initialised trust at 50; new is 0).
    // We reset them to 0 ONLY if they have no submissions (totalCompletions === 0).
    // Users who actually earned their score are left untouched.
    const staleSnap = await db.collection("users")
      .where("trustScore", "==", 50)
      .get();

    let reset = 0;
    let kept = 0;
    const batch = db.batch();

    for (const doc of staleSnap.docs) {
      const user = doc.data();
      if ((user.totalCompletions || 0) === 0) {
        // Stale default — reset to 0
        batch.update(doc.ref, {
          trustScore: 0,
          streakCount: 0,
          lastReconciliationDate: now,
        });
        reset++;
      } else {
        // User earned their score — just stamp reconciliation date
        batch.update(doc.ref, { lastReconciliationDate: now });
        kept++;
      }
    }

    await batch.commit();

    const msg = `Backfill done. Reset: ${reset}, Kept as-is: ${kept}`;
    console.log("[Backfill]", msg);
    res.status(200).send(msg);
  }
);