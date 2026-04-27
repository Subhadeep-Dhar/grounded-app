import { useEffect, useState } from 'react';
import { View, Text, Button } from 'react-native';
import { getTodayChallenge } from '../../src/services/challenge';
import { useAuthStore } from '../../src/store/authStore';
import { submitChallenge } from '../../src/services/submission';
import { getCurrentLocation, watchUserLocation } from '../../src/services/gps';
import { getDistance } from '../../src/utils/location';
import { captureImage } from '../../src/services/camera';
import { uploadImage } from '../../src/services/storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { startSession, markArrived, markCompleted } from '../../src/services/session';
import { sendArrivalNotification, sendCompletionNotification } from '../../src/services/notifications';

export default function Challenge() {
    const { user } = useAuthStore();

    const [challenge, setChallenge] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [session, setSession] = useState(null);
    const [remainingTime, setRemainingTime] = useState(0);
    const [distance, setDistance] = useState(null);

    // 🔥 Stay timer
    useEffect(() => {
        if (!session || session.status !== "ARRIVED" || !session.arrivedAt) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - session.arrivedAt;

            const total = 2 * 60 * 1000;
            const remaining = Math.max(0, total - elapsed);

            setRemainingTime(remaining);

            if (remaining === 0) clearInterval(interval);
        }, 1000);

        return () => clearInterval(interval);
    }, [session]);

    // 🔥 Load challenge + session
    useEffect(() => {
        if (user) {
            getTodayChallenge(user.uid).then(async (data) => {
                setChallenge(data);

                const subRef = doc(db, 'submissions', `${user.uid}_${data.date}`);
                const subSnap = await getDoc(subRef);
                if (subSnap.exists()) setSubmitted(true);

                const sessionRef = doc(db, 'sessions', `${user.uid}_${data.date}`);
                const sessionSnap = await getDoc(sessionRef);
                if (sessionSnap.exists()) {
                    setSession(sessionSnap.data());
                }
            });
        }
    }, [user]);

    // 🔥 Auto geofence tracking
    useEffect(() => {
        if (!session || session.status !== "STARTED" || !challenge?.latitude) return;

        let subscription;

        const startTracking = async () => {
            try {
                subscription = await watchUserLocation(async (loc) => {
                    const lat1 = loc.coords.latitude;
                    const lon1 = loc.coords.longitude;

                    const lat2 = challenge.latitude;
                    const lon2 = challenge.longitude;

                    const dist = getDistance(lat1, lon1, lat2, lon2);
                    setDistance(dist);

                    // 🔥 ARRIVAL DETECTION (clean)
                    if (dist <= challenge.radius) {
                        await markArrived(user.uid, challenge.date);

                        setSession((prev) => ({
                            ...prev,
                            status: "ARRIVED",
                            arrivedAt: Date.now()
                        }));

                        await sendArrivalNotification();
                        alert("🎉 You reached the location!");

                        if (subscription && typeof subscription.remove === 'function') {
                            subscription.remove();
                        }
                    }
                });
            } catch (e) {
                console.log("Tracking error:", e);
            }
        };

        startTracking();

        return () => {
            try {
                if (subscription && typeof subscription.remove === 'function') {
                    subscription.remove();
                }
            } catch (e) {
                console.log("Cleanup error:", e);
            }
        };
    }, [session, challenge]);

    // 🔥 Submit flow
    const handleSubmit = async () => {
        try {
            if (!session) {
                alert("Start session first ❌");
                return;
            }

            if (session.status === "STARTED") {
                alert("Reach the location first ❌");
                return;
            }

            // 🔥 Stay validation
            if (session.status === "ARRIVED") {
                if (remainingTime > 0) {
                    alert(`Wait ${Math.ceil(remainingTime / 1000)} sec ⏳`);
                    return;
                }

                await markCompleted(user.uid, challenge.date);

                setSession((prev) => ({
                    ...prev,
                    status: "COMPLETED"
                }));
            }

            // 🔥 Prevent duplicate
            const subRef = doc(db, 'submissions', `${user.uid}_${challenge.date}`);
            const existing = await getDoc(subRef);
            if (existing.exists()) {
                alert("Already submitted today ❌");
                return;
            }

            // 🔥 Final location check
            const loc = await getCurrentLocation();

            const lat1 = parseFloat(loc.coords?.latitude || loc.latitude);
            const lon1 = parseFloat(loc.coords?.longitude || loc.longitude);

            const lat2 = parseFloat(challenge.latitude);
            const lon2 = parseFloat(challenge.longitude);

            const dist = getDistance(lat1, lon1, lat2, lon2);
            const locationOk = dist <= challenge.radius;

            if (!locationOk) {
                alert("You moved away from location ❌");
                return;
            }

            // 🔥 Capture + upload
            const image = await captureImage();
            if (!image) return;

            const imageUrl = await uploadImage(image, user.uid);

            await submitChallenge(user.uid, challenge, imageUrl, locationOk);

            setSubmitted(true);
            alert("Submitted ✅");

            await sendCompletionNotification();

        } catch (e) {
            alert(e.message);
        }
    };

    if (!challenge) return <Text>Loading...</Text>;

    return (
        <View>
            <Text>Today's Challenge</Text>
            <Text>{challenge.task}</Text>
            <Text>{challenge.location}</Text>

            {/* 🔥 Distance UI */}
            {distance !== null && session?.status === "STARTED" && (
                <Text>
                    {distance > 200 && `🚶 ${Math.round(distance)}m away`}
                    {distance <= 200 && distance > 50 && `🔥 Almost there (${Math.round(distance)}m)`}
                    {distance <= 50 && `🎯 You're very close!`}
                </Text>
            )}

            {/* 🔥 Start Session */}
            {!session && (
                <Button
                    title="Start Session"
                    onPress={async () => {
                        const s = await startSession(user.uid, challenge.date);
                        setSession(s);
                    }}
                />
            )}

            {/* 🔥 Timer UI */}
            {session?.status === "ARRIVED" && remainingTime > 0 && (
                <Text>⏳ Stay time left: {Math.ceil(remainingTime / 1000)} sec</Text>
            )}

            {session?.status === "ARRIVED" && remainingTime === 0 && (
                <Text>✅ You can submit now!</Text>
            )}

            {/* 🔥 Submit */}
            <Button
                title={submitted ? "Already Submitted" : "Submit"}
                onPress={handleSubmit}
                disabled={submitted || session?.status !== "COMPLETED"}
            />
        </View>
    );
}