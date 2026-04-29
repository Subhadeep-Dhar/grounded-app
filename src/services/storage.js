import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Upload image to Firebase Storage.
 * Path: proofs/{userId}/{timestamp}.jpg
 * Matches storage rules: /proofs/{userId}/{fileName}
 */
export const uploadImage = async (uri, userId) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    const fileName = `${Date.now()}.jpg`;
    const fileRef = ref(storage, `proofs/${userId}/${fileName}`);

    await uploadBytes(fileRef, blob);
    const url = await getDownloadURL(fileRef);

    return url;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload image. Please try again.');
  }
};