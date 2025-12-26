import { create } from 'zustand';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ConnectionState {
  status: ConnectionStatus;
  error: string | null;
  reconnectAttempts: number;

  // Actions
  setStatus: (status: ConnectionStatus, error?: string) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  error: null,
  reconnectAttempts: 0,

  setStatus: (status, error = null) => {
    set({ status, error });
    if (status === 'connected') {
      set({ reconnectAttempts: 0 });
    }
  },

  incrementReconnectAttempts: () => {
    set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 }));
  },

  resetReconnectAttempts: () => {
    set({ reconnectAttempts: 0 });
  },
}));
