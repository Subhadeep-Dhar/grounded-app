import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { calculateScore } from '../utils/scoring';

export const submitChallenge = async (userId, challenge, mediaUrl, locationOk) => {
  const subRef = doc(db, 'submissions', `${userId}_${challenge.date}`);
  const userRef = doc(db, 'users', userId);

  const timeOk = true; // (we’ll improve later)

  const score = calculateScore({
    timeOk,
    locationOk,
    hasMedia: !!mediaUrl
  });

  const status =
    score >= 70 ? "approved" :
    score >= 40 ? "flagged" :
    "rejected";

  await setDoc(subRef, {
    userId,
    challengeId: challenge.date,
    mediaUrl,
    score,
    status,
    timestamp: Date.now()
  });

  if (status === "approved") {
    const userSnap = await getDoc(userRef);
    const user = userSnap.data();

    await updateDoc(userRef, {
      totalCompletions: (user.totalCompletions || 0) + 1,
      streakCount: (user.streakCount || 0) + 1
    });
  }
};