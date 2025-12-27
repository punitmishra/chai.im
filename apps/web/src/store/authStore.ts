import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
}

interface AuthState {
  user: User | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setUser: (user: User, token: string) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      sessionToken: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setUser: (user, token) =>
        set({
          user,
          sessionToken: token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          sessionToken: null,
          isAuthenticated: false,
        }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'chai-auth',
      partialize: (state) => ({
        user: state.user,
        sessionToken: state.sessionToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
