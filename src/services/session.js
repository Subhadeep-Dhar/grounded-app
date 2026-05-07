/**
 * session.js — Persistent session state machine.
 * States: NOT_STARTED → TRAVELING → ARRIVED_WAITING → VERIFICATION_UNLOCKED → SUBMITTED | EXPIRED
 * State is persisted to Firestore so app restarts cannot bypass verification flow.
 */
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { SESSION_STATES, STAY_DURATION } from '../constants/config';

const sessionRef = (userId, date) => doc(db, 'sessions', `${userId}_${date}`);

/**
 * Get today's session. Returns null if none exists.
 */
export const getSession = async (userId, date) => {
  try {
    const snap = await getDoc(sessionRef(userId, date));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('[Session] getSession error:', e);
    return null;
  }
};

/**
 * Start a new session: NOT_STARTED → TRAVELING.
 * Idempotent — returns existing session if already started today.
 */
export const startSession = async (userId, date) => {
  const ref = sessionRef(userId, date);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();

  const session = {
    userId,
    date,
    state: SESSION_STATES.TRAVELING,
    startedAt: Date.now(),
    startedAtServer: serverTimestamp(),
    arrivedAt: null,
    countdownEndsAt: null,
    verificationUnlockedAt: null,
    isMocked: false,
    suspicionFlags: [],
  };

  await setDoc(ref, session);
  return session;
};

/**
 * Mark arrival: TRAVELING → ARRIVED_WAITING.
 * Records arrivedAt and countdownEndsAt for restart persistence.
 * Idempotent — returns existing state if already arrived.
 */
export const markArrived = async (userId, date) => {
  const ref = sessionRef(userId, date);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Session not found. Start session first.');

  const session = snap.data();

  // Idempotent: already in or past ARRIVED_WAITING
  if (session.state !== SESSION_STATES.TRAVELING) return session;

  const arrivedAt = Date.now();
  const countdownEndsAt = arrivedAt + STAY_DURATION * 1000;

  const updates = {
    state: SESSION_STATES.ARRIVED_WAITING,
    arrivedAt,
    countdownEndsAt,
    arrivedAtServer: serverTimestamp(),
  };
  await updateDoc(ref, updates);
  return { ...session, ...updates };
};

/**
 * Reset arrival: ARRIVED_WAITING → TRAVELING.
 * Called when user exits the challenge radius during countdown.
 * Resets timer so re-entry starts a fresh countdown.
 */
export const resetArrival = async (userId, date) => {
  const ref = sessionRef(userId, date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const session = snap.data();
  if (session.state !== SESSION_STATES.ARRIVED_WAITING) return;

  await updateDoc(ref, {
    state: SESSION_STATES.TRAVELING,
    arrivedAt: null,
    countdownEndsAt: null,
  });
};

/**
 * Unlock verification: ARRIVED_WAITING → VERIFICATION_UNLOCKED.
 * Only valid when countdown has actually elapsed.
 * Validates against stored countdownEndsAt (not device clock alone).
 */
export const unlockVerification = async (userId, date) => {
  const ref = sessionRef(userId, date);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Session not found.');

  const session = snap.data();
  if (session.state === SESSION_STATES.VERIFICATION_UNLOCKED) return session; // already unlocked

  if (session.state !== SESSION_STATES.ARRIVED_WAITING) {
    throw new Error(`Cannot unlock: invalid state ${session.state}`);
  }

  const now = Date.now();
  if (!session.countdownEndsAt || now < session.countdownEndsAt) {
    throw new Error('Countdown not yet complete.');
  }

  const updates = {
    state: SESSION_STATES.VERIFICATION_UNLOCKED,
    verificationUnlockedAt: now,
    verificationUnlockedAtServer: serverTimestamp(),
  };
  await updateDoc(ref, updates);
  return { ...session, ...updates };
};

/**
 * Mark session as submitted: VERIFICATION_UNLOCKED → SUBMITTED.
 */
export const markSubmitted = async (userId, date) => {
  const ref = sessionRef(userId, date);
  await updateDoc(ref, {
    state: SESSION_STATES.SUBMITTED,
    submittedAt: Date.now(),
    submittedAtServer: serverTimestamp(),
  });
};

/**
 * Mark session as expired. No-op if already submitted or expired.
 */
export const markExpired = async (userId, date) => {
  try {
    const ref = sessionRef(userId, date);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const { state } = snap.data();
    if (state === SESSION_STATES.SUBMITTED || state === SESSION_STATES.EXPIRED) return;
    await updateDoc(ref, { state: SESSION_STATES.EXPIRED, expiredAt: Date.now() });
  } catch (e) {
    console.warn('[Session] markExpired error:', e);
  }
};

/**
 * Log a suspicion flag (e.g. mocked GPS).
 * Non-blocking — never throws. Does NOT hard-block the user.
 */
export const logSuspicion = async (userId, date, flag) => {
  try {
    const ref = sessionRef(userId, date);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const session = snap.data();
    const flags = [...(session.suspicionFlags || []), { flag, timestamp: Date.now() }];
    await updateDoc(ref, {
      suspicionFlags: flags,
      isMocked: flags.some((f) => f.flag === 'MOCKED_GPS'),
    });
  } catch (e) {
    console.warn('[Session] logSuspicion silently failed:', e);
  }
};