import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { TASKS, LOCATIONS } from '../constants/config';

export const getTodayChallenge = async (userId) => {
    const today = new Date().toDateString();
    const ref = doc(db, 'challenges', `${userId}_${today}`);

    const randomTask = TASKS[Math.floor(Math.random() * TASKS.length)];
    const randomLocation = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

    const snap = await getDoc(ref);

    if (snap.exists()) return snap.data();

    const challenge = {
        userId,
        date: today,
        task: randomTask,
        location: randomLocation.name,
        latitude: randomLocation.latitude,
        longitude: randomLocation.longitude,
        radius: randomLocation.radius,
        status: "pending"
    };

    await setDoc(ref, challenge);

    return challenge;
};