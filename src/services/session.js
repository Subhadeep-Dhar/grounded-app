import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

export const startSession = async (userId, date) => {
  const ref = doc(db, 'sessions', `${userId}_${date}`);

  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();

  const session = {
    userId,
    date,
    status: "STARTED",
    startedAt: Date.now(),
    arrivedAt: null,
    stayed: false
  };

  await setDoc(ref, session);
  return session;
};

export const markArrived = async (userId, date) => {
  const ref = doc(db, 'sessions', `${userId}_${date}`);

  await updateDoc(ref, {
    status: "ARRIVED",
    arrivedAt: Date.now()
  });
};

export const markCompleted = async (userId, date) => {
  const ref = doc(db, 'sessions', `${userId}_${date}`);

  await updateDoc(ref, {
    status: "COMPLETED",
    stayed: true
  });
};