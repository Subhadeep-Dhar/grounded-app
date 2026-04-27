import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { calculateScore } from '../utils/scoring';

export const submitChallenge = async (userId, challenge, mediaUrl, locationOk) => {
    const subRef = doc(db, 'submissions', `${userId}_${challenge.date}`);
    const userRef = doc(db, 'users', userId);

    // ❌ prevent multiple submissions
    const existing = await getDoc(subRef);
    if (existing.exists()) {
        throw new Error("Already submitted today ❌");
    }

    const timeOk = true;

    const score = calculateScore({
        timeOk,
        locationOk,
        hasMedia: !!mediaUrl
    });

    const status =
        score >= 70 ? "approved" :
            score >= 40 ? "flagged" :
                "rejected";

    await setDoc(subRef, {
        userId,
        challengeId: challenge.date,
        mediaUrl,
        score,
        status,
        timestamp: Date.now()
    });

    if (status === "approved") {
        const userSnap = await getDoc(userRef);
        const user = userSnap.data();

        const today = new Date().toDateString();

        let newStreak = 1;

        if (user.lastCompletedDate) {
            const last = new Date(user.lastCompletedDate);
            const diff = (new Date(today) - last) / (1000 * 60 * 60 * 24);

            if (diff === 1) newStreak = (user.streakCount || 0) + 1;
            else if (diff === 0) newStreak = user.streakCount;
            else newStreak = 1;
        }

        let trustDelta = 0;
        if (status === "approved") trustDelta = +2;
        if (status === "flagged") trustDelta = -1;
        if (status === "rejected") trustDelta = -3;

        await updateDoc(userRef, {
            totalCompletions: (user.totalCompletions || 0) + 1,
            streakCount: newStreak,
            lastCompletedDate: today,
            trustScore: Math.max(0, Math.min(100, (user.trustScore || 50) + trustDelta))
        });
    }
};