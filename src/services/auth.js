import { auth } from '../lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { createUserDoc } from './db';

export const register = async (email, password) => {
  const res = await createUserWithEmailAndPassword(auth, email, password);

  const user = res.user;

  // 🔥 ensure user doc is created properly
  await createUserDoc(user);

  return user;
};

export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export const subscribeToAuth = (callback) =>
  onAuthStateChanged(auth, callback);