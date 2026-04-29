import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { assignLocation } from './locations';
import { getRandomTask } from '../constants/messages';

export const getTodayChallenge = async (userId) => {
  const today = new Date().toDateString();
  const ref = doc(db, 'challenges', `${userId}_${today}`);

  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

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