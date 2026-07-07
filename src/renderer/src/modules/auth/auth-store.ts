import { create } from 'zustand';
import type { SessionUser } from '@shared/api-types';
import { getSitescopApi } from '@/lib/sitescop-api';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  setUser: (user: SessionUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  logout: async () => {
    await getSitescopApi().auth.logout();
    set({ user: null });
  },
}));
