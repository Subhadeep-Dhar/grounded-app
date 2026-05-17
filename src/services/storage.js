import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * In-flight upload tracker.
 * Prevents double-uploads if the component re-renders mid-flight.
 * Keyed by URI, value is the Promise<url>.
 */
const _inFlight = new Map();

/**
 * Upload an image to Firebase Storage.
 *
 * - Deduplicates concurrent uploads for the same URI (returns same Promise).
 * - Releases blob memory immediately after upload (critical on Android).
 * - Does NOT re-upload if uri is already a Firebase Storage download URL.
 *
 * @param {string} uri       - Local file URI or data URI
 * @param {string} userId    - Owner user ID (must match storage rules)
 * @param {string} folder    - Storage folder: 'proofs' | 'avatars' | 'watermarks' | 'shares'
 * @returns {Promise<string>} Public download URL
 */
export const uploadImage = async (uri, userId, folder = 'proofs') => {
  if (!uri || !userId) {
    throw new Error('[Storage] Invalid upload params: missing URI or userId');
  }

  // Guard: if this is already a remote Firebase URL, skip the upload.
  if (
    uri.startsWith('https://firebasestorage.googleapis.com') ||
    uri.startsWith('https://storage.googleapis.com')
  ) {
    return uri;
  }

  // Dedup: return the existing in-flight Promise for the same URI.
  if (_inFlight.has(uri)) {
    console.log('[Storage] Reusing in-flight upload for URI:', uri.slice(0, 60));
    return _inFlight.get(uri);
  }

  const uploadPromise = _doUpload(uri, userId, folder).finally(() => {
    _inFlight.delete(uri);
  });

  _inFlight.set(uri, uploadPromise);
  return uploadPromise;
};

const _doUpload = async (uri, userId, folder) => {
  let blob = null;
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`[Storage] Fetch failed: HTTP ${response.status}`);
    }
    blob = await response.blob();

    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const fileRef = ref(storage, `${folder}/${userId}/${fileName}`);

    const metadata = {
      contentType: 'image/jpeg',
      customMetadata: {
        userId,
        folder,
        uploadedAt: String(Date.now()),
      },
    };

    await uploadBytes(fileRef, blob, metadata);
    const url = await getDownloadURL(fileRef);

    console.log(`[Storage] Uploaded to ${folder}/${userId}/${fileName}`);
    return url;
  } catch (error) {
    console.error('[Storage] Upload error:', error.message);
    throw new Error(`Upload failed: ${error.message}`);
  } finally {
    // CRITICAL: release blob to prevent OOM on Android.
    if (blob && typeof blob.close === 'function') {
      try { blob.close(); } catch (_) { /* ignore */ }
    }
  }
};