import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : '/api'
);

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Request interceptor — attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sarthak_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sarthak_token');
      localStorage.removeItem('sarthak_user');
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/caregiver/login' && currentPath !== '/' && !currentPath.startsWith('/caregiver/setup-password')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth API ──
export interface PatientRegistrationPayload {
  fullName: string;
  email: string;
  password: string;
  age: number;
  phone: string;
  primaryLanguage?: string;
  caregiver: {
    fullName: string;
    phone: string;
    email: string;
    relationship?: string;
  };
}

export const authAPI = {
  // Patient registration (includes mandatory caregiver details)
  register: (data: PatientRegistrationPayload) => {
    return api.post('/auth/register', {
      ...data,
      caregiverName: data.caregiver?.fullName,
      caregiverPhone: data.caregiver?.phone,
      caregiverEmail: data.caregiver?.email,
      caregiverRelationship: data.caregiver?.relationship,
    });
  },
  // Patient login
  login: (data: { email: string; password: string }) => {
    return api.post('/auth/login', data);
  },
  // Caregiver login
  caregiverLogin: (data: { email: string; password: string }) => {
    return api.post('/auth/caregiver/login', data);
  },
  // Verify caregiver invitation token
  getCaregiverInvite: (token: string) => {
    return api.get('/auth/caregiver/invite', { params: { token } });
  },
  // Request / retrieve caregiver invitation link by email
  requestCaregiverInvite: (email: string) => {
    return api.post('/auth/caregiver/request-invite', { email });
  },
  // Caregiver sets password
  caregiverSetup: (data: { token: string; password: string }) => {
    return api.post('/auth/caregiver/setup', data);
  },
  // Logout
  logout: () => {
    return api.post('/auth/logout');
  },
  // Current user info
  me: () => {
    return api.get('/auth/me');
  },
};

// ── Users ──
export const userAPI = {
  get: (id: string) => {
    return api.get(`/users/${id}`);
  },
  update: (id: string, data: any) => {
    return api.put(`/users/${id}`, data);
  },
  updateSensitivity: (id: string, data: any) => {
    return api.put(`/users/${id}/sensitivity`, data);
  },
};

// ── Medications ──
export const medicationAPI = {
  scan: (imageBase64: string) => {
    return api.post('/medications/scan', { imageBase64 });
  },
  list: (userId: string) => {
    return api.get(`/medications/${userId}`);
  },
  create: (data: any) => {
    return api.post('/medications', data);
  },
  update: (id: string, data: any) => {
    return api.put(`/medications/${id}`, data);
  },
  delete: (id: string) => {
    return api.delete(`/medications/${id}`);
  },
};

// ── Adherence ──
export const adherenceAPI = {
  verify: (data: { videoBase64: string; medicationId: string; scheduledTime: string }) => {
    return api.post('/adherence/verify', data);
  },
  list: (userId: string, params?: Record<string, string>) => {
    return api.get(`/adherence/${userId}`, { params });
  },
  log: (data: { medicationId?: string; scheduledTime: string; status: string; verifiedByVision?: boolean }) => {
    return api.post('/adherence/log', data);
  },
};

// ── Alerts ──
export const alertAPI = {
  escalate: (data: { userId: string; eventType: string; metadata?: any }) => {
    return api.post('/alerts/escalate', data);
  },
  resolve: (id: string) => {
    return api.post(`/alerts/${id}/resolve`);
  },
  falseAlarm: (id: string) => {
    return api.post(`/alerts/${id}/false-alarm`);
  },
  list: (userId: string, params?: Record<string, string>) => {
    return api.get(`/alerts/${userId}`, { params });
  },
};

// ── Emergency (public, no auth) ──
export const emergencyAPI = {
  getContext: (token: string) => {
    return axios.get(`${API_BASE}/emergency/v1?token=${token}`);
  },
  acknowledge: (token: string) => {
    return axios.post(`${API_BASE}/emergency/v1/ack?token=${token}`);
  },
};

// ── Multilingual Voice Companion ──
export const voiceAPI = {
  process: (data: {
    text: string;
    patientName?: string;
    nextMedication?: string;
    currentTime?: string;
    currentLanguage?: string;
  }) => {
    return api.post('/voice/process', data);
  },
};
