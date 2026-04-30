import axios, { AxiosError } from 'axios';
import { AuthResponse, LoginCredentials } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (credentials: LoginCredentials) =>
    api.post<AuthResponse>('/auth/login', credentials),
  me: () => api.get<{ success: boolean; user: AuthResponse['user'] }>('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
};

// Chats API
export const chatsApi = {
  getAll: (params?: { status?: string; search?: string }) =>
    api.get<{ success: boolean; chats: any[] }>('/chats', { params }),
  getById: (id: string) => api.get<{ success: boolean; chat: any }>(`/chats/${id}`),
  assign: (id: string) => api.post<{ success: boolean; chat: any }>(`/chats/${id}/assign`),
  transfer: (id: string, agentId: string) =>
    api.post<{ success: boolean; chat: any }>(`/chats/${id}/transfer`, { agentId }),
  close: (id: string) => api.post<{ success: boolean; chat: any }>(`/chats/${id}/close`),
  updateTags: (id: string, tagIds: string[]) =>
    api.put(`/chats/${id}/tags`, { tagIds }),
  linkPatient: (id: string, patientId: string) =>
    api.post(`/chats/${id}/link-patient`, { patientId }),
};

// Messages API
export const messagesApi = {
  getByChatId: (chatId: string, params?: { limit?: number; before?: string }) =>
    api.get<{ success: boolean; messages: any[] }>(`/messages/${chatId}`, { params }),
  send: (chatId: string, data: {
    content: string;
    type?: string;
    isInternal?: boolean;
    replyToId?: string;
  }) => api.post<{ success: boolean; message: any }>(`/messages/${chatId}`, data),
  sendTemplate: (chatId: string, data: { templateName: string; variables?: string[] }) =>
    api.post(`/messages/${chatId}/template`, data),
  markAsRead: (chatId: string) => api.post(`/messages/${chatId}/read`),
};

// Patients API
export const patientsApi = {
  getAll: (params?: { search?: string; therapy?: string }) =>
    api.get<{ success: boolean; patients: any[] }>('/patients', { params }),
  getById: (id: string) =>
    api.get<{ success: boolean; patient: any }>(`/patients/${id}`),
  create: (data: any) => api.post<{ success: boolean; patient: any }>('/patients', data),
  update: (id: string, data: any) => api.put(`/patients/${id}`, data),
  delete: (id: string) => api.delete(`/patients/${id}`),
  createAppointment: (id: string, data: any) => api.post(`/patients/${id}/appointments`, data),
  confirmAppointment: (appointmentId: string) =>
    api.post(`/patients/appointments/${appointmentId}/confirm`),
  getMedicalRecords: (id: string) => api.get(`/patients/${id}/records`),
  createMedicalRecord: (id: string, data: any) => api.post(`/patients/${id}/records`, data),
};

// Users API
export const usersApi = {
  getAll: () => api.get<{ success: boolean; users: any[] }>('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  invite: (data: { name: string; email: string; role: string }) =>
    api.post<{ success: boolean; user: any; tempPassword: string }>('/users/invite', data),
};

// Templates API
export const templatesApi = {
  getAll: () => api.get<{ success: boolean; templates: any[] }>('/templates'),
  create: (data: any) => api.post('/templates', data),
  update: (id: string, data: any) => api.put(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
};

// Quick Replies API
export const quickRepliesApi = {
  getAll: () => api.get<{ success: boolean; replies: any[] }>('/quick-replies'),
  create: (data: any) => api.post('/quick-replies', data),
  update: (id: string, data: any) => api.put(`/quick-replies/${id}`, data),
  delete: (id: string) => api.delete(`/quick-replies/${id}`),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get<{ success: boolean; stats: any; agents: any[]; recentChats: any[] }>('/dashboard/stats'),
  getReports: (params?: { startDate?: string; endDate?: string }) =>
    api.get<{ success: boolean; period: any; summary: any; chatsByDay: any[]; agentPerformance: any[]; topPatients: any[] }>('/dashboard/reports', { params }),
};

// Window 24h API
export const window24hApi = {
  checkStatus: (chatId: string) =>
    api.get<{ success: boolean; window: any }>(`/window24h/chats/${chatId}/window-status`),
  reopenWindow: (chatId: string, data: { templateName: string; variables?: string[] }) =>
    api.post<{ success: boolean }>(`/window24h/chats/${chatId}/reopen-window`, data),
  getTemplates: () =>
    api.get<{ success: boolean; templates: any[] }>('/window24h/window-templates'),
  getStats: () =>
    api.get<{ success: boolean; stats: any }>('/window24h/window-stats'),
};

// Upload API
export const uploadApi = {
  getUploadUrl: (data: { chatId: string; fileName: string; fileType: string; fileSize: number }) =>
    api.post<{ success: boolean; uploadUrl: string; filePath: string }>('/upload/upload-url', data),
  confirmUpload: (data: { chatId: string; filePath: string; fileName: string; fileType: string; fileSize: number; caption?: string }) =>
    api.post<{ success: boolean; message: any; url: string }>('/upload/confirm', data),
  uploadDirect: (formData: FormData, onProgress?: (progress: number) => void) => {
    return api.post('/upload/direct', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },
  listFiles: (chatId: string, params?: { type?: string; page?: number; limit?: number }) =>
    api.get<{ success: boolean; files: any[]; pagination: any }>(`/upload/list/${chatId}`, { params }),
  deleteFile: (filePath: string) =>
    api.post('/upload/delete', { filePath }),
  getBucketInfo: () =>
    api.get<{ success: boolean; bucket: string; totalSize: string; fileCount: number }>('/upload/bucket-info'),
};

// SLA API
export const slaApi = {
  getConfig: () =>
    api.get<{ success: boolean; config: any[] }>('/sla/config'),
  createConfig: (data: any) =>
    api.post<{ success: boolean; config: any }>('/sla/config', data),
  updateConfig: (id: string, data: any) =>
    api.put<{ success: boolean; config: any }>(`/sla/config/${id}`, data),
  getChatStatus: (chatId: string) =>
    api.get<{ success: boolean; sla: any }>(`/sla/chats/${chatId}/status`),
  assignToChat: (chatId: string, slaConfigId: string) =>
    api.post<{ success: boolean; chat: any }>(`/sla/chats/${chatId}/assign`, { slaConfigId }),
  getReport: (params?: { startDate?: string; endDate?: string; agentId?: string }) =>
    api.get<{ success: boolean; report: any }>('/sla/report', { params }),
};

export default api;
