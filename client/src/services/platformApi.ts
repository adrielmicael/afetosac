import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

const platform = axios.create({
  baseURL: `${apiBaseUrl}/platform`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

platform.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

platform.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('platform-token');
      localStorage.removeItem('platform-admin');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface PlatformLoginResponse {
  success: boolean;
  token?: string;
  admin?: { id: string; email: string; name: string; role: string };
  requires2FA?: boolean;
  challengeToken?: string;
  mustEnable2FA?: boolean;
}

export const platformAuthApi = {
  login: (data: { email: string; password: string }) =>
    platform.post<PlatformLoginResponse>('/auth/login', data),
  verify2FA: (data: { challengeToken: string; token?: string; backupCode?: string }) =>
    platform.post<PlatformLoginResponse>('/auth/2fa/verify', data),
  me: () => platform.get('/auth/me'),
  logout: () => platform.post('/auth/logout'),
};

export const platformDataApi = {
  overview: () => platform.get('/overview'),
  billing: () => platform.get('/billing'),
  operations: () => platform.get('/operations'),
  lgpd: (params?: { status?: string; page?: number }) => platform.get('/lgpd', { params }),
  organizations: (params?: { status?: string; plan?: string; search?: string; page?: number }) =>
    platform.get('/organizations', { params }),
  organization: (id: string) => platform.get(`/organizations/${id}`),
  createOrganization: (data: {
    name: string;
    slug?: string;
    userEmail: string;
    userName: string;
    userPassword?: string;
    externalId?: string;
  }) => platform.post('/organizations', data),
  setStatus: (id: string, status: string) =>
    platform.patch(`/organizations/${id}/status`, { status }),
  setPlan: (id: string, plan: string) => platform.patch(`/organizations/${id}/plan`, { plan }),
};

export default platform;
