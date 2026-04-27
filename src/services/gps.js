import * as Location from 'expo-location';

export const getCurrentLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Permission denied');

  const loc = await Location.getCurrentPositionAsync({});
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy
  };
};

export const watchUserLocation = async (callback) => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;

  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000, // every 5 sec
      distanceInterval: 5, // or movement
    },
    callback
  );
};