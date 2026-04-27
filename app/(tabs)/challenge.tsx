import { useEffect, useState } from 'react';
import { View, Text, Button, Platform } from 'react-native';
import * as Location from 'expo-location';

// 🔥 SAFE dynamic import for maps
let MapView: any, Marker: any, Polyline: any, Circle: any;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
  Circle = Maps.Circle;
}

import { getTodayChallenge } from '../../src/services/challenge';
import { useAuthStore } from '../../src/store/authStore';
import { submitChallenge } from '../../src/services/submission';
import { getCurrentLocation } from '../../src/services/gps';
import { getDistance } from '../../src/utils/location';
import { captureImage } from '../../src/services/camera';
import { uploadImage } from '../../src/services/storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { startSession, markArrived, markCompleted } from '../../src/services/session';

import {
  sendArrivalNotification,
  sendCompletionNotification
} from '../../src/services/notifications';

export default function Challenge() {
  const { user } = useAuthStore();

  const [challenge, setChallenge] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);

  const [currentLocation, setCurrentLocation] = useState(null);
  const [path, setPath] = useState([]);

  // 🔥 Timer
  useEffect(() => {
    if (!session || session.status !== "ARRIVED" || !session.arrivedAt) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - session.arrivedAt;
      const remaining = Math.max(0, 120000 - elapsed);
      setRemainingTime(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // 🔥 Load data
  useEffect(() => {
    if (!user) return;

    getTodayChallenge(user.uid).then(async (data) => {
      setChallenge(data);

      const subSnap = await getDoc(doc(db, 'submissions', `${user.uid}_${data.date}`));
      if (subSnap.exists()) setSubmitted(true);

      const sessionSnap = await getDoc(doc(db, 'sessions', `${user.uid}_${data.date}`));
      if (sessionSnap.exists()) setSession(sessionSnap.data());
    });
  }, [user]);

  // 🔥 Tracking
  useEffect(() => {
    if (!session || session.status !== "STARTED" || !challenge) return;
    if (Platform.OS === 'web') return;

    let subscription: any;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        async (loc) => {
          const lat = loc.coords.latitude;
          const lon = loc.coords.longitude;

          setCurrentLocation({ latitude: lat, longitude: lon });
          setPath((prev) => [...prev, { latitude: lat, longitude: lon }]);

          const dist = getDistance(lat, lon, challenge.latitude, challenge.longitude);

          if (dist <= challenge.radius) {
            await markArrived(user.uid, challenge.date);
            await sendArrivalNotification();

            setSession((prev: any) => ({
              ...prev,
              status: "ARRIVED",
              arrivedAt: Date.now()
            }));

            alert("🎉 Reached!");

            if (subscription?.remove) subscription.remove();
          }
        }
      );
    };

    startTracking();

    return () => subscription?.remove && subscription.remove();
  }, [session, challenge]);

  // 🔥 Submit
  const handleSubmit = async () => {
    try {
      if (!session) return alert("Start session ❌");
      if (session.status === "STARTED") return alert("Reach location ❌");

      if (session.status === "ARRIVED") {
        if (remainingTime > 0) return alert("Wait ⏳");

        await markCompleted(user.uid, challenge.date);

        setSession((prev: any) => ({
          ...prev,
          status: "COMPLETED"
        }));
      }

      const existing = await getDoc(doc(db, 'submissions', `${user.uid}_${challenge.date}`));
      if (existing.exists()) return alert("Already submitted ❌");

      const loc = await getCurrentLocation();
      const dist = getDistance(
        loc.coords?.latitude || loc.latitude,
        loc.coords?.longitude || loc.longitude,
        challenge.latitude,
        challenge.longitude
      );

      if (dist > challenge.radius) return alert("Moved away ❌");

      const image = await captureImage();
      if (!image) return;

      const url = await uploadImage(image, user.uid);

      await submitChallenge(user.uid, challenge, url, true);
      await sendCompletionNotification();

      setSubmitted(true);
      alert("Submitted ✅");

    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!challenge) return <Text>Loading...</Text>;

  const target = {
    latitude: challenge.latitude,
    longitude: challenge.longitude
  };

  return (
    <View style={{ flex: 1 }}>

      {/* 🗺️ MAP (ONLY MOBILE) */}
      {Platform.OS !== 'web' && MapView && (
        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            ...target,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker coordinate={target} />
          {currentLocation && <Marker coordinate={currentLocation} pinColor="blue" />}
          <Circle center={target} radius={challenge.radius} />
          {path.length > 1 && <Polyline coordinates={path} />}
        </MapView>
      )}

      {/* 🔘 UI */}
      <View style={{ padding: 10 }}>
        <Text>{challenge.task}</Text>
        <Text>{challenge.location}</Text>

        {!session && (
          <Button title="Start Session" onPress={async () => {
            const s = await startSession(user.uid, challenge.date);
            setSession(s);
          }} />
        )}

        {session?.status === "ARRIVED" && remainingTime > 0 && (
          <Text>⏳ {Math.ceil(remainingTime / 1000)} sec</Text>
        )}

        {session?.status === "ARRIVED" && remainingTime === 0 && (
          <Text>✅ Ready</Text>
        )}

        <Button
          title={submitted ? "Done" : "Submit"}
          onPress={handleSubmit}
          disabled={submitted || session?.status !== "COMPLETED"}
        />
      </View>
    </View>
  );
}