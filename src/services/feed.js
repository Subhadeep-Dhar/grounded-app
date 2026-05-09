import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit, where, doc, getDoc } from 'firebase/firestore';
import { STORAGE_CONFIG } from '../constants/config';

export const getFeed = async () => {
  const now = Date.now();
  
  // Efficient query using expiresAt (or fallback to timestamp age)
  const q = query(
    collection(db, 'submissions'),
    where('expiresAt', '>', now),
    orderBy('expiresAt', 'desc'),
    limit(20)
  );

  let snap = await getDocs(q);
  
  // Backward compatibility: If no expiresAt results, try legacy timestamp filtering
  if (snap.empty) {
    const legacyCutoff = now - STORAGE_CONFIG.feedExpirationMs;
    const legacyQ = query(
      collection(db, 'submissions'),
      where('timestamp', '>', legacyCutoff),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    snap = await getDocs(legacyQ);
  }

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