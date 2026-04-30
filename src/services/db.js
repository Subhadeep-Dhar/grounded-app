import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, increment, serverTimestamp } from 'firebase/firestore';

export const createUserDoc = async (user) => {
    if (!user) return;

    const ref = doc(db, 'users', user.uid);

    await setDoc(
        ref,
        {
            userId: user.uid,
            email: user.email,
            streakCount: 0,
            totalCompletions: 0,
            trustScore: 50,

            lastCompletedDate: null,
            lastMissedDate: null,
            canRecover: false,

            createdAt: Date.now()
        },
        { merge: true }
    );
};

export const getUserDoc = async (uid) => {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
};

export { db, increment, serverTimestamp };