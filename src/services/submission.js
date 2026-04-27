import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { calculateScore } from '../utils/scoring';

export const submitChallenge = async (userId, challenge, mediaUrl, locationOk) => {
  const subRef = doc(db, 'submissions', `${userId}_${challenge.date}`);
  const userRef = doc(db, 'users', userId);

  // ❌ prevent multiple submissions
  const existing = await getDoc(subRef);
  if (existing.exists()) {
    throw new Error("Already submitted today ❌");
  }

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  const currentMinutes = hour * 60 + minute;

  const actionStart = 5 * 60;        // 5:00
  const actionEnd = 7 * 60;          // 7:00
  const submitEnd = 7 * 60 + 30;     // 7:30

  const didInTime = currentMinutes >= actionStart && currentMinutes <= actionEnd;
  const submittedInTime = currentMinutes <= submitEnd;

  // ❌ hard block after submission window
  if (!submittedInTime) {
    throw new Error("Submission window closed (after 7:30 AM) ❌");
  }

  // 🔥 scoring (use strict time logic)
  const score = calculateScore({
    timeOk: didInTime, // 🔥 FIXED (not submittedInTime)
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
    didInTime,
    timestamp: Date.now(),
    clientTime: now.toISOString()
  });

  // 🔥 Update user ONLY if approved
  if (status === "approved") {
    const userSnap = await getDoc(userRef);
    const user = userSnap.data();

    const today = new Date().toDateString();

    let newStreak = 1;
    let canRecover = false;

    if (user.lastCompletedDate) {
      const last = new Date(user.lastCompletedDate);
      const diff = (new Date(today) - last) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        // ✅ normal streak
        newStreak = (user.streakCount || 0) + 1;
      } 
      else if (diff > 1) {
        // ❌ missed → reset but allow recovery
        newStreak = 1;
        canRecover = true;
      } 
      else {
        newStreak = user.streakCount;
      }
    }

    // 🔥 Recovery logic
    if (user.canRecover) {
      newStreak = (user.streakCount || 0) + 1;
      canRecover = false;
    }

    let trustDelta = 0;
    if (status === "approved") trustDelta = +2;
    if (status === "flagged") trustDelta = -1;
    if (status === "rejected") trustDelta = -3;

    await updateDoc(userRef, {
      totalCompletions: (user.totalCompletions || 0) + 1,
      streakCount: newStreak,
      lastCompletedDate: today,
      canRecover,
      trustScore: Math.max(
        0,
        Math.min(100, (user.trustScore || 50) + trustDelta)
      )
    });
  }
};