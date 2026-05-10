import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { reconcileUserTrust } from './reconciliation';

export const getLeaderboard = async () => {
  const snap = await getDocs(collection(db, 'users'));

  // Reconcile trust scores for consistency
  const reconciledUsers = [];
  for (const doc of snap.docs) {
    const userData = doc.data();
    const reconciled = await reconcileUserTrust(doc.id, userData);
    reconciledUsers.push(reconciled);
  }

  // 🔥 custom ranking formula
  return reconciledUsers.sort((a, b) => {
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
};