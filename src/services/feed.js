import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit, where, doc, getDoc } from 'firebase/firestore';

export const getFeed = async () => {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  
  const q = query(
    collection(db, 'submissions'),
    where('timestamp', '>', oneDayAgo),
    orderBy('timestamp', 'desc'),
    limit(20)
  );

  const snap = await getDocs(q);
  const submissions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Fetch unique user data
  const userIds = [...new Set(submissions.map(s => s.userId))];
  const userMap = {};

  await Promise.all(userIds.map(async (uid) => {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      userMap[uid] = userSnap.data();
    }
  }));

  return submissions.map(sub => ({
    ...sub,
    user: userMap[sub.userId] || { username: 'Grounded User' }
  }));
};