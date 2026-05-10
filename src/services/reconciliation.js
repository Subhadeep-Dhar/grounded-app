import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { calculateMissedDayPenalty } from '../utils/scoring';
import { TRUST_CONFIG } from '../constants/config';
import { getExcusedDaysCount } from './databaseUtils';

/**
 * Lazy trust reconciliation.
 * Automatically evaluates missed days and applies penalties/streak resets
 * without requiring a backend cron job or waiting for the next submission.
 * 
 * @param {string} userId - User ID
 * @param {object} userDoc - The fetched user document
 * @returns {object} The reconciled user document
 */
export const reconcileUserTrust = async (userId, userDoc) => {
  if (!userDoc || !userId) return userDoc;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Determine the last time we checked/submitted
    let lastCheckedRaw = userDoc.lastReconciliationDate || userDoc.lastSubmissionDate || userDoc.createdAt;
    if (!lastCheckedRaw) return userDoc;

    let lastCheckedDate = new Date();
    if (lastCheckedRaw.toDate) {
      lastCheckedDate = lastCheckedRaw.toDate();
    } else if (lastCheckedRaw.seconds) {
      lastCheckedDate = new Date(lastCheckedRaw.seconds * 1000);
    } else {
      lastCheckedDate = new Date(lastCheckedRaw);
    }
    
    // Normalize to midnight UTC-safe local time
    lastCheckedDate.setHours(0, 0, 0, 0);

    // Calculate full days elapsed
    const diffMs = today.getTime() - lastCheckedDate.getTime();
    const daysSinceLastCheck = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Idempotency: If we already reconciled today (or are ahead), do nothing
    if (daysSinceLastCheck <= 0) return userDoc;

    // We only penalize for fully missed PAST days.
    // If last check was yesterday, daysSince = 1. Past days = 0.
    const missedPastDays = daysSinceLastCheck - 1;

    // Fast-path: Just update reconciliation timestamp without penalties
    if (missedPastDays <= 0) {
      const safeTime = Date.now();
      await updateDoc(doc(db, 'users', userId), { lastReconciliationDate: safeTime });
      return { ...userDoc, lastReconciliationDate: safeTime };
    }

    // 2. Validate Region Excuses
    // If user's cached regionStatus is 'outside', assume they were traveling the entire time.
    let excusedDays = await getExcusedDaysCount(userId, lastCheckedDate);
    if (userDoc.regionStatus === 'outside') {
      excusedDays = missedPastDays; // Fully excuse all missed days
      console.log(`[Reconciliation] Progression frozen (outside region). Excusing ${missedPastDays} days.`);
    }

    const penalizedMissedDays = Math.max(0, missedPastDays - excusedDays);

    const safeTime = Date.now();

    if (penalizedMissedDays <= 0) {
      // Days were missed, but they were excused (e.g. out of region)
      await updateDoc(doc(db, 'users', userId), { lastReconciliationDate: safeTime });
      return { ...userDoc, lastReconciliationDate: safeTime };
    }

    // 3. Apply Penalties
    const penalty = calculateMissedDayPenalty(penalizedMissedDays);
    const currentTrust = userDoc.trustScore ?? TRUST_CONFIG.initial;
    
    // Prevent underflow below minimum threshold
    const newTrustScore = Math.max(TRUST_CONFIG.min, currentTrust + penalty); // penalty is negative

    const updates = {
      trustScore: newTrustScore,
      streakCount: 0, // Unexcused gap breaks the streak
      lastReconciliationDate: safeTime,
    };

    // 4. Persist and return
    await updateDoc(doc(db, 'users', userId), updates);
    console.log(`[Reconciliation] Reconciled user ${userId}: applied ${penalty} trust penalty for ${penalizedMissedDays} missed days.`);

    return { ...userDoc, ...updates };
  } catch (error) {
    console.warn('[Reconciliation] Error reconciling user:', error);
    return userDoc; // Failsafe: return original user to prevent UI blocking
  }
};
