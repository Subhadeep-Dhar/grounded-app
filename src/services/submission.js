import { db, increment, serverTimestamp } from './db';
import { doc, setDoc, getDoc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { uploadImage } from './storage';
import { calculateScore, calculateTrustDelta, calculateMissedDayPenalty, getTimeWindow } from '../utils/scoring';
import { getDistance } from '../utils/location';
import { TRUST_CONFIG, STAY_DURATION, SESSION_STATES, STORAGE_CONFIG } from '../constants/config';
import { markSubmitted } from './session';
import { getExcusedDaysCount } from './databaseUtils';

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
 * Fetch today's submission details.
 */
export const getTodaySubmission = async (userId) => {
  const today = new Date().toDateString();
  const subRef = doc(db, 'submissions', `${userId}_${today}`);
  const snap = await getDoc(subRef);
  return snap.exists() ? snap.data() : null;
};

/**
 * Determine days missed since last submission.
 */
const getDaysMissed = (user) => {
  if (!user.lastSubmissionDate) return -1;
  let lastDate;
  if (user.lastSubmissionDate?.toDate) { lastDate = user.lastSubmissionDate.toDate(); }
  else if (user.lastSubmissionDate?.seconds) { lastDate = new Date(user.lastSubmissionDate.seconds * 1000); }
  else { lastDate = new Date(user.lastSubmissionDate); }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays - 1);
};

/**
 * Submit a completed challenge.
 * Validates time window, location, prevents duplicates.
 * Applies missed-day penalty ONLY if user is inside region.
 *
 * @param {string} userId
 * @param {object} challenge - challenge document
 * @param {string|null} localImageUri - local URI of captured image
 * @param {object} userLocation - { latitude, longitude }
 * @param {string} sessionState - current SESSION_STATES value (from UI)
 * @param {boolean} isInsideRegion - whether user is inside Manipal
 * @returns {object} submission result with score breakdown
 */
export const submitChallenge = async (
  userId,
  challenge,
  localImageUri,
  userLocation,
  sessionState,
  isInsideRegion = true
) => {
  const today = new Date().toDateString();
  const subRef = doc(db, 'submissions', `${userId}_${challenge.date}`);
  const userRef = doc(db, 'users', userId);

  // Guard: duplicate submission
  const existing = await getDoc(subRef);
  if (existing.exists()) throw new Error('Already submitted today.');

  // Guard: session must be VERIFICATION_UNLOCKED
  if (sessionState !== SESSION_STATES.VERIFICATION_UNLOCKED) {
    throw new Error('Verification not yet unlocked. Complete the timer first.');
  }

  // Guard: region lock — outside region cannot submit
  if (!isInsideRegion) {
    throw new Error('Progression is paused until you return to Manipal.');
  }

  // Time window validation (device clock for quick guard, server timestamp is source of truth)
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const timeWindow = getTimeWindow(currentMinutes);
  if (!timeWindow) {
    throw new Error('Submission window is closed. Submit between 5–7:30am or 6–9pm.');
  }

  // Anti-cheat: location distance
  let distance = 9999;
  if (userLocation && challenge.latitude && challenge.longitude) {
    distance = getDistance(
      userLocation.latitude,
      userLocation.longitude,
      challenge.latitude,
      challenge.longitude
    );
  }
  if (distance > 200) {
    throw new Error('You are too far from the challenge location to submit.');
  }

  // Upload proof image
  let mediaUrl = null;
  if (localImageUri) {
    mediaUrl = await uploadImage(localImageUri, userId);
  }

  // Fetch user data
  const userSnap = await getDoc(userRef);
  const user = userSnap.exists() ? userSnap.data() : {};

  // Determine if session had mocked GPS
  const sessionSnap = await getDoc(doc(db, 'sessions', `${userId}_${today}`));
  const sessionData = sessionSnap.exists() ? sessionSnap.data() : {};
  const isSuspicious = sessionData.isMocked || false;

  // Calculate score
  const breakdown = calculateScore({
    distance,
    stayTime: challenge.stayTime || STAY_DURATION,
    targetStayTime: STAY_DURATION,
    hasMedia: !!mediaUrl,
    streakCount: user.streakCount || 0,
    isCleanSession: !isSuspicious,
    timeWindow,
  });

  const { score } = breakdown;
  const status =
    score >= 80 ? 'approved' :
    score >= 55 ? 'flagged' :
    'rejected';

  // Persist submission (server timestamp for audit trail)
  await setDoc(subRef, {
    userId,
    challengeId: challenge.date,
    locationId: challenge.locationId || null,
    mediaUrl,
    ...breakdown,
    status,
    timeWindow,
    didInTime: timeWindow === 'primary',
    isInsideRegion,
    isSuspicious,
    createdAt: serverTimestamp(),
    timestamp: Date.now(),
    expiresAt: Date.now() + STORAGE_CONFIG.feedExpirationMs,
    clientTime: now.toISOString(),
  });

  // ─── Update user stats ────────────────────────────────────────────────────
  const daysMissed = getDaysMissed(user);
  
  let lastSubDateObj = null;
  if (user.lastSubmissionDate) {
    lastSubDateObj = user.lastSubmissionDate?.toDate ? user.lastSubmissionDate.toDate() : 
                     (user.lastSubmissionDate?.seconds ? new Date(user.lastSubmissionDate.seconds * 1000) : new Date(user.lastSubmissionDate));
  }

  // Region-aware missed days: subtract excused days (region_locked) from daysMissed
  let excusedDays = 0;
  if (daysMissed > 0 && lastSubDateObj) {
    excusedDays = await getExcusedDaysCount(userId, lastSubDateObj);
  }
  
  const penalizedMissedDays = Math.max(0, daysMissed - excusedDays);

  // Streak logic: freeze streak if days were excused
  let newStreakCount = 1;
  let streakUpdate = 1;

  if (!user.lastSubmissionDate) {
    newStreakCount = 1;
    streakUpdate = 1;
  } else if (penalizedMissedDays === 0) {
    // Gap was only excused days (or no gap at all) -> continue streak
    newStreakCount = (user.streakCount || 0) + 1;
    streakUpdate = increment(1);
  } else {
    // There was at least one unexcused missed day -> reset streak
    newStreakCount = 1;
    streakUpdate = 1;
  }

  const currentTrust = user.trustScore ?? TRUST_CONFIG.initial;

  // Trust delta for this submission
  const trustDelta = calculateTrustDelta(score, currentTrust, newStreakCount, timeWindow, isSuspicious);

  // Missed-day penalty (ONLY if they were unexcused)
  let penaltyDelta = 0;
  if (penalizedMissedDays >= 1) {
    penaltyDelta = calculateMissedDayPenalty(penalizedMissedDays);
    console.log(`[Submission] ${penalizedMissedDays} unexcused missed day(s), penalty: ${penaltyDelta}`);
  }
  const newTrustScore = Math.max(
    TRUST_CONFIG.min,
    Math.min(TRUST_CONFIG.max, currentTrust + trustDelta + penaltyDelta)
  );

  await updateDoc(userRef, {
    totalCompletions: increment(1),
    streakCount: streakUpdate,
    lastSubmissionDate: serverTimestamp(),
    trustScore: newTrustScore,
    lastTrustDelta: parseFloat((trustDelta + penaltyDelta).toFixed(2)),
  });

  // Update challenge status
  await setDoc(
    doc(db, 'challenges', `${userId}_${challenge.date}`),
    { status: 'completed' },
    { merge: true }
  );

  // Mark session submitted in Firestore
  try {
    await markSubmitted(userId, challenge.date);
  } catch (e) {
    console.warn('[Submission] markSubmitted failed silently:', e);
  }

  return {
    ...breakdown,
    status,
    mediaUrl,
    trustDelta,
    penaltyDelta,
    newTrustScore,
    timeWindow,
  };
};