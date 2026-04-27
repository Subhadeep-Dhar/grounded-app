import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const getTodayChallenge = async (userId) => {
    const today = new Date().toDateString();
    const ref = doc(db, 'challenges', `${userId}_${today}`);

    const snap = await getDoc(ref);

    if (snap.exists()) return snap.data();

    const challenge = {
        userId,
        date: today,
        task: "Do 10 pushups",
        location: "Football Ground",
        latitude: 13.34656044444444,
        longitude: 74.79371888888889,
        radius: 200, // meters
        status: "pending"
    };

    await setDoc(ref, challenge);

    return challenge;
};