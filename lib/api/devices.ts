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

  create: async (payload: { token: string; user?: number; user_id?: number }): Promise<FCMDevice> => {
    // Accept either `user` or `user_id` depending on backend expectations and forward as-is.
    const response = await notificationsClient.post<FCMDevice>('/devices/', payload);
    return response.data;
  },

  update: async (id: number, payload: Partial<FCMDevice>): Promise<FCMDevice> => {
    const response = await notificationsClient.put<FCMDevice>(`/devices/${id}/`, payload);
    return response.data;
  },

  partialUpdate: async (id: number, payload: Partial<FCMDevice>): Promise<FCMDevice> => {
    const response = await notificationsClient.patch<FCMDevice>(`/devices/${id}/`, payload);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await notificationsClient.delete(`/devices/${id}/`);
  },

  /**
   * Save FCM token endpoint used by client apps.
   * POST /notifications/save-fcm-token/
   */
  /**
   * Save FCM token endpoint used by client apps.
   * POST /notifications/save-fcm-token/
   * Accepts payload: { token: string, user_id?: number }
   */
  saveFcmToken: async (payload: { token: string; user_id: number }): Promise<any> => {
    // Require frontend to provide `user_id`. Do not fall back to localStorage.
    if (typeof payload.user_id === 'undefined' || payload.user_id === null) {
      const msg = 'saveFcmToken failed: payload.user_id is required. The frontend must provide the user id.';
      if (typeof window !== 'undefined') {
        console.error(msg);
      }
      return Promise.reject(new Error(msg));
    }

    try {
      const response = await notificationsClient.post('/save-fcm-token/', payload);
      return response.data;
    } catch (err: any) {
      // Log server response for debugging and rethrow
      console.error('saveFcmToken failed:', err.response?.status, err.response?.data || err.message);
      throw err;
    }
  },
};

