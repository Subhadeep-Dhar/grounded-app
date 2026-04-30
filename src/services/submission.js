import { db, increment, serverTimestamp } from './db';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { uploadImage } from './storage';
import { calculateScore } from '../utils/scoring';
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

  // Anti-cheat: re-verify location at submission time
  let locationOk = false;
  if (userLocation && challenge.latitude && challenge.longitude) {
    const dist = getDistance(
      userLocation.latitude,
      userLocation.longitude,
      challenge.latitude,
      challenge.longitude
    );
    locationOk = dist <= challenge.radius;
  }

  if (!locationOk) {
    throw new Error('Location verification failed. You must be at the destination.');
  }

  // Upload image to Firebase Storage (not just local URI)
  let mediaUrl = null;
  if (localImageUri) {
    mediaUrl = await uploadImage(localImageUri, userId);
  }

  // Calculate score
  const score = calculateScore({
    timeOk: didInTime,
    locationOk,
    hasMedia: !!mediaUrl,
    streakCount: 0, // Will be computed below
  });

  const status =
    score >= 70 ? 'approved' :
    score >= 40 ? 'flagged' :
    'rejected';

  // Save submission
  await setDoc(subRef, {
    userId,
    challengeId: challenge.date,
    locationId: challenge.locationId || null,
    mediaUrl,
    score,
    status,
    didInTime,
    locationOk,
    timestamp: Date.now(),
    serverTimestamp: serverTimestamp(),
    clientTime: now.toISOString(),
  });

  // Update user stats (only if approved or flagged)
  if (status === 'approved' || status === 'flagged') {
    const userSnap = await getDoc(userRef);
    const user = userSnap.exists() ? userSnap.data() : {};

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    let streakUpdate = 1; // Default reset to 1
    let canRecover = false;

    if (user.lastSubmissionDate) {
      // Handle Timestamp (Web/Mobile), Number, or String
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
          // Submitted yesterday -> increment
          streakUpdate = increment(1);
        } else if (diffDays === 0) {
          // Already submitted today (safety)
          streakUpdate = user.streakCount || 1;
        } else if (diffDays > 1) {
          // Missed a day
          if (user.canRecover) {
            streakUpdate = increment(1);
            canRecover = false;
          } else {
            streakUpdate = 1;
            canRecover = true;
          }
        }
      }
    }

    // Trust delta
    let trustDelta = 0;
    if (status === 'approved') trustDelta = TRUST_CONFIG.approvedDelta;
    if (status === 'flagged') trustDelta = TRUST_CONFIG.flaggedDelta;

    await updateDoc(userRef, {
      totalCompletions: increment(1),
      streakCount: streakUpdate,
      lastSubmissionDate: serverTimestamp(),
      lastCompletedDate: new Date().toDateString(), // Keep for legacy UI if needed
      canRecover,
      trustScore: Math.max(
        TRUST_CONFIG.min,
        Math.min(TRUST_CONFIG.max, (user.trustScore || TRUST_CONFIG.initial) + trustDelta)
      ),
    });
  }

  // Update challenge status
  await setDoc(doc(db, 'challenges', `${userId}_${challenge.date}`), {
    status: 'completed',
  }, { merge: true });

  return { score, status, mediaUrl };
};