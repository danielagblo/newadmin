import axios from 'axios';
import { FCMDevice } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Notifications endpoints are at /notifications/ not /api-v1/notifications/
const notificationsClient = axios.create({
  baseURL: `${API_URL}/notifications`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
notificationsClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Token ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const devicesApi = {
  list: async (): Promise<FCMDevice[]> => {
    const response = await notificationsClient.get<FCMDevice[]>('/devices/');
    return response.data;
  },

  get: async (id: number): Promise<FCMDevice> => {
    const response = await notificationsClient.get<FCMDevice>(`/devices/${id}/`);
    return response.data;
  },

  create: async (token: string): Promise<FCMDevice> => {
    const response = await notificationsClient.post<FCMDevice>('/devices/', { token });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await notificationsClient.delete(`/devices/${id}/`);
  },
};

