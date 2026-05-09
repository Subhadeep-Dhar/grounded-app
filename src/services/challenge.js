import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { assignLocation } from './locations';
import { getRandomTask } from '../constants/messages';
import { isInsideRegion } from './region';

export const getTodayChallenge = async (userId, userLatitude = null, userLongitude = null) => {
  const today = new Date().toDateString();
  const ref = doc(db, 'challenges', `${userId}_${today}`);

  const userDoc = await getDoc(doc(db, 'users', userId));
  const regionStatus = userDoc.exists() ? userDoc.data().regionStatus : 'unknown';

  // Return existing challenge if already assigned (with retro-lock protection)
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    if (data.status === 'pending' && regionStatus === 'outside') {
      // User traveled outside after generation but before completion. Safely lock the challenge.
      const lockedData = { ...data, regionLocked: true, status: 'region_locked' };
      await setDoc(ref, { regionLocked: true, status: 'region_locked' }, { merge: true });
      console.log('[Challenge] Retro-locked pending challenge for departed user.');
      return lockedData;
    }
    return data;
  }

  // Region gate: prevent assignment if regionStatus is outside
  if (regionStatus === 'outside') {
    const lockDoc = {
      userId,
      date: today,
      task: null,
      location: null,
      regionLocked: true,
      status: 'region_locked',
      createdAt: Date.now(),
    };
    await setDoc(ref, lockDoc);
    console.log('[Challenge] Assignment blocked — user is outside region.');
    return lockDoc;
  }

  // Assign location via load-balanced system
  const location = await assignLocation(userId);
  const task = getRandomTask();

  const challenge = {
    userId,
    date: today,
    task,
    location: location.name,
    locationId: location.id,
    latitude: location.latitude,
    longitude: location.longitude,
    radius: location.radius,
    regionLocked: false,
    status: 'pending',
    createdAt: Date.now(),
  };

  await setDoc(ref, challenge);
  return challenge;
};

export const updateChallengeStatus = async (userId, date, status) => {
  const ref = doc(db, 'challenges', `${userId}_${date}`);
  await setDoc(ref, { status }, { merge: true });
};