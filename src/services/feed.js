import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

export const getFeed = async () => {
  const q = query(
    collection(db, 'submissions'),
    orderBy('timestamp', 'desc'),
    limit(20)
  );

  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data());
};