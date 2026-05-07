import * as ImagePicker from 'expo-image-picker';

export const captureImage = async () => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Camera permission is required to capture proof.');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6, // Balanced quality for memory and clarity
      allowsEditing: true, // Encourages smaller/cropped images
      aspect: [4, 3],
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      throw new Error('Capture failed: Image URI is missing.');
    }

    return asset.uri;
  } catch (error) {
    console.error('Capture image error:', error);
    throw error;
  }
};