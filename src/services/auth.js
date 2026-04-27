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
  await createUserDoc(res.user);
  return res.user;
};

export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export const subscribeToAuth = (callback) =>
  onAuthStateChanged(auth, callback);