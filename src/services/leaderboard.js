import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

/**
 * Fetch the top 50 users ordered by trustScore for the leaderboard.
 *
 * Trust scores are kept globally accurate by the server-side
 * dailyTrustReconciliation Cloud Function (runs 2 AM IST daily),
 * so no client-side per-user reconciliation is needed here.
 *
 * The composite ranking (completions × 2 + streak × 3 + trust) is computed
 * client-side after fetch so we can keep the Firestore query simple and indexed.
 */
export const getLeaderboard = async () => {
  // Fetch the top candidates by trustScore (best single-field index available).
  const q = query(
    collection(db, 'users'),
    orderBy('trustScore', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);

  const users = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Apply composite ranking formula (same weights as original).
  users.sort((a, b) => {
    const scoreA =
      (a.totalCompletions ?? 0) * 2 +
      (a.streakCount ?? 0) * 3 +
      (a.trustScore ?? 0);
    const scoreB =
      (b.totalCompletions ?? 0) * 2 +
      (b.streakCount ?? 0) * 3 +
      (b.trustScore ?? 0);
    return scoreB - scoreA;
  });

  return users;
};