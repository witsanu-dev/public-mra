'use client';

import { create } from 'zustand';
import { AuthUser } from '@/lib/auth';

interface AuthState {
  user: AuthUser | null;
  securityKey: string | null;
  isLoading: boolean;
  initialized: boolean;
  checkSession: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setSecurityKey: (key: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  securityKey: null,
  isLoading: false,
  initialized: false,

  setUser: (user) => set({ user, initialized: true }),
  setSecurityKey: (securityKey) => set({ securityKey }),

  checkSession: async () => {
    try {
      set({ isLoading: true });
      const res = await fetch('/api/auth/me');
      const json = await res.json();
      if (res.ok && json.success && json.user) {
        set({
          user: json.user,
          securityKey: json.securityKey || 'mra@admin2026',
          initialized: true,
          isLoading: false,
        });
        return json.user;
      } else {
        set({ user: null, securityKey: null, initialized: true, isLoading: false });
        return null;
      }
    } catch {
      set({ user: null, securityKey: null, initialized: true, isLoading: false });
      return null;
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continue cleanup
    } finally {
      set({ user: null, initialized: true, isLoading: false });
      window.location.href = '/login';
    }
  },
}));
