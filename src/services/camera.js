import * as ImagePicker from 'expo-image-picker';

export const captureImage = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Camera permission denied');

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.5
  });

  if (result.canceled) return null;

  return result.assets[0].uri;
};