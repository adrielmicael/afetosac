import { create } from 'zustand';

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'SUPPORT' | 'BILLING' | 'READONLY';
}

interface PlatformState {
  admin: PlatformAdmin | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (admin: PlatformAdmin, token: string) => void;
  logout: () => void;
}

const stored = (): { admin: PlatformAdmin | null; token: string | null } => {
  try {
    return {
      admin: JSON.parse(localStorage.getItem('platform-admin') || 'null'),
      token: localStorage.getItem('platform-token'),
    };
  } catch {
    return { admin: null, token: null };
  }
};

const initial = stored();

export const usePlatformStore = create<PlatformState>((set) => ({
  admin: initial.admin,
  token: initial.token,
  isAuthenticated: Boolean(initial.token),
  setAuth: (admin, token) => {
    localStorage.setItem('platform-token', token);
    localStorage.setItem('platform-admin', JSON.stringify(admin));
    set({ admin, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('platform-token');
    localStorage.removeItem('platform-admin');
    set({ admin: null, token: null, isAuthenticated: false });
  },
}));
