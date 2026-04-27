import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export const getLeaderboard = async () => {
  const snap = await getDocs(collection(db, 'users'));

  const users = snap.docs.map(doc => doc.data());

  // 🔥 custom ranking formula
  return users.sort((a, b) => {
    const scoreA =
      (a.totalCompletions || 0) * 2 +
      (a.streakCount || 0) * 3 +
      (a.trustScore || 0);

    const scoreB =
      (b.totalCompletions || 0) * 2 +
      (b.streakCount || 0) * 3 +
      (b.trustScore || 0);

    return scoreB - scoreA;
  });
};