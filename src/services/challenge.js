import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { assignLocation } from './locations';
import { getRandomTask } from '../constants/messages';
import { isInsideRegion } from './region';

export const getTodayChallenge = async (userId, userLatitude = null, userLongitude = null) => {
  const today = new Date().toDateString();
  const ref = doc(db, 'challenges', `${userId}_${today}`);

  // Return existing challenge if already assigned
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  // Region gate: if coordinates provided and outside Manipal, don't assign
  if (userLatitude != null && userLongitude != null) {
    const inside = isInsideRegion(userLatitude, userLongitude);
    if (!inside) {
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
      return lockDoc;
    }
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