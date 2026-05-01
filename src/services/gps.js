import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const getCurrentLocation = async () => {
  try {

    if (Platform.OS === 'web') {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          return resolve(null);
        }

        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position),
          () => resolve(null), // no reject
          { enableHighAccuracy: true }
        );
      });
    }

    let { status } = await Location.getForegroundPermissionsAsync();

    if (status !== 'granted') {
      const res = await Location.requestForegroundPermissionsAsync();
      status = res.status;
    }

    if (status !== 'granted') {
      return null;
    }

    // Safest approach to prevent GPS initialization crashes natively on Android
    let location = await Location.getLastKnownPositionAsync();
    
    if (!location) {
      location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    }

    return location;

  } catch (error) {
    console.log("GPS error:", error);
    return null; // Prevents crash
  }
};

export const watchUserLocation = async (callback) => {

  if (Platform.OS === 'web') {
    console.log("⚠️ Watch not supported on web");
    return null;
  }

  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  try {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      (loc) => {
        if (!loc || !loc.coords) return; // guard
        callback(loc);
      }
    );

    return subscription;
  } catch (error) {
    console.log("Watch GPS error:", error);
    return null;
  }
};