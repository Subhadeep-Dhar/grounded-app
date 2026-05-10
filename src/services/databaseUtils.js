import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Check how many of the missed days were 'region_locked'.
 * If a day has no challenge doc but user's regionStatus was 'outside', it's also excused.
 */
export const getExcusedDaysCount = async (userId, lastDateOrMs) => {
  try {
    const timeMs = lastDateOrMs instanceof Date ? lastDateOrMs.getTime() : lastDateOrMs;
    const q = query(
      collection(db, 'challenges'),
      where('userId', '==', userId),
      where('status', '==', 'region_locked'),
      where('createdAt', '>', timeMs)
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch (e) {
    console.error('[Submission] getExcusedDaysCount error:', e);
    return 0;
  }
};