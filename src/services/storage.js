import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Upload image to Firebase Storage.
 * Path: proofs/{userId}/{timestamp}.jpg
 * Matches storage rules: /proofs/{userId}/{fileName}
 */
export const uploadImage = async (uri, userId) => {
  if (!uri || !userId) {
    throw new Error('Invalid upload parameters: missing URI or User ID');
  }

  let blob = null;
  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Failed to fetch image for upload');
    
    blob = await response.blob();

    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const fileRef = ref(storage, `proofs/${userId}/${fileName}`);

    const metadata = {
      contentType: 'image/jpeg',
      customMetadata: {
        userId,
        originalUri: uri.substring(0, 100),
      }
    };

    await uploadBytes(fileRef, blob, metadata);
    const url = await getDownloadURL(fileRef);

    return url;
  } catch (error) {
    console.error('[StorageService] Upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  } finally {
    // CRITICAL: Release blob memory to prevent OOM on Android
    if (blob && typeof blob.close === 'function') {
      try {
        blob.close();
      } catch (e) {
        console.warn('[StorageService] Failed to close blob:', e);
      }
    }
  }
};