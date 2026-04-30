import { db, increment, serverTimestamp } from './db';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { uploadImage } from './storage';
import { calculateScore, calculateTrustDelta } from '../utils/scoring';
import { getDistance } from '../utils/location';
import { TIME_CONFIG, TRUST_CONFIG } from '../constants/config';

/**
 * Check if user has already submitted today.
 */
export const hasUserSubmittedToday = async (userId) => {
  const today = new Date().toDateString();
  const subRef = doc(db, 'submissions', `${userId}_${today}`);
  const snap = await getDoc(subRef);
  return snap.exists();
};

/**
 * Submit a completed challenge.
 * Uploads image, verifies location, calculates score, updates user stats.
 */
export const submitChallenge = async (userId, challenge, localImageUri, userLocation) => {
  const subRef = doc(db, 'submissions', `${userId}_${challenge.date}`);
  const userRef = doc(db, 'users', userId);

  // Prevent duplicate submissions
  const existing = await getDoc(subRef);
  if (existing.exists()) {
    throw new Error('Already submitted today');
  }

  // Time validation
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const didInTime = currentMinutes >= TIME_CONFIG.actionStart && currentMinutes <= TIME_CONFIG.actionEnd;
  const submittedInTime = currentMinutes <= TIME_CONFIG.submitEnd;

  if (!submittedInTime) {
    throw new Error('Submission window closed for today');
  }

  // Anti-cheat: calculate distance
  let distance = 9999;
  if (userLocation && challenge.latitude && challenge.longitude) {
    distance = getDistance(
      userLocation.latitude,
      userLocation.longitude,
      challenge.latitude,
      challenge.longitude
    );
  }

  if (distance > 100) { // Still allow submission up to 100m but with 0 score
    throw new Error('You are too far from the destination to submit.');
  }

  // Upload image to Firebase Storage (not just local URI)
  let mediaUrl = null;
  if (localImageUri) {
    mediaUrl = await uploadImage(localImageUri, userId);
  }

  // Fetch user data for streak check
  const userSnap = await getDoc(userRef);
  const user = userSnap.exists() ? userSnap.data() : {};

  // Calculate score breakdown
  const breakdown = calculateScore({
    distance,
    stayTime: challenge.stayTime || 120, // Should be passed from UI
    targetStayTime: 120,
    hasMedia: !!mediaUrl,
    streakCount: user.streakCount || 0,
    isCleanSession: true, // Default to true for now
  });

  const { score } = breakdown;

  const status =
    score >= 80 ? 'approved' :
    score >= 60 ? 'flagged' :
    'rejected';

  // Save submission with breakdown
  await setDoc(subRef, {
    userId,
    challengeId: challenge.date,
    locationId: challenge.locationId || null,
    mediaUrl,
    ...breakdown,
    status,
    createdAt: serverTimestamp(),
    timestamp: Date.now(),
    clientTime: now.toISOString(),
  });

  // Update user stats
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  let newStreakCount = 1;
  let streakUpdate = 1;

  if (user.lastSubmissionDate) {
    let lastDate;
    if (user.lastSubmissionDate?.toDate) {
      lastDate = user.lastSubmissionDate.toDate();
    } else if (typeof user.lastSubmissionDate === 'number' || typeof user.lastSubmissionDate === 'string') {
      lastDate = new Date(user.lastSubmissionDate);
    } else if (user.lastSubmissionDate?.seconds) {
      lastDate = new Date(user.lastSubmissionDate.seconds * 1000);
    }

    if (lastDate) {
      lastDate.setHours(0, 0, 0, 0);
      const diffMs = startOfToday.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreakCount = (user.streakCount || 0) + 1;
        streakUpdate = increment(1);
      } else if (diffDays === 0) {
        newStreakCount = user.streakCount || 0;
        streakUpdate = increment(0);
      }
    }
  }

  const trustDelta = calculateTrustDelta(score, newStreakCount, false);
  const newTrustScore = Math.max(0, Math.min(100, (user.trustScore || 50) + trustDelta));

  await updateDoc(userRef, {
    totalCompletions: increment(1),
    streakCount: streakUpdate,
    lastSubmissionDate: serverTimestamp(),
    trustScore: newTrustScore,
  });

  // Update challenge status
  await setDoc(doc(db, 'challenges', `${userId}_${challenge.date}`), {
    status: 'completed',
  }, { merge: true });

  return { ...breakdown, status, mediaUrl };
};