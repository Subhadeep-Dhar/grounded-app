import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

export const getLeaderboard = async () => {
  const q = query(
    collection(db, 'users'),
    orderBy('totalCompletions', 'desc'),
    limit(10)
  );

  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data());
};