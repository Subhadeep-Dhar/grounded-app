import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';

export const getFeed = async () => {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  
  const q = query(
    collection(db, 'submissions'),
    where('timestamp', '>', oneDayAgo),
    orderBy('timestamp', 'desc'),
    limit(20)
  );

  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data());
};