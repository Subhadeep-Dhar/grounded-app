import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const createUserDoc = async (user) => {
  const ref = doc(db, 'users', user.uid);

  await setDoc(ref, {
    userId: user.uid,
    email: user.email,
    streakCount: 0,
    totalCompletions: 0,
    trustScore: 50,
    lastCompletedDate: null,
    createdAt: Date.now()
  });
};

export const getUserDoc = async (uid) => {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};