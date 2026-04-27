import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const uploadImage = async (uri, userId) => {
  const response = await fetch(uri);
  const blob = await response.blob();

  const fileRef = ref(storage, `proofs/${userId}_${Date.now()}.jpg`);

  await uploadBytes(fileRef, blob);

  const url = await getDownloadURL(fileRef);

  return url;
};