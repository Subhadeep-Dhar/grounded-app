import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const getCurrentLocation = async () => {

  // ✅ WEB SUPPORT (use browser API)
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => reject(error),
        { enableHighAccuracy: true }
      );
    });
  }

  // ✅ MOBILE (expo-location)
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('Permission denied');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return location;
};

export const watchUserLocation = async (callback) => {

  if (Platform.OS === 'web') {
    console.log("⚠️ Watch not supported on web");
    return null;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 5,
    },
    callback
  );

  return subscription;
};