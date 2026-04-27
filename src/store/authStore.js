import { create } from 'zustand';
import { subscribeToAuth } from '../services/auth';

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,

  init: () => {
    subscribeToAuth((user) => {
      set({ user, loading: false });
    });
  },

  setUser: (user) => set({ user })
}));