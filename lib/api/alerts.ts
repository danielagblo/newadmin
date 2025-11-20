import apiClient from './config';
import axios from 'axios';
import { Alert } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create a separate client for notifications endpoints (like devices)
// Notifications endpoints are at /notifications/ not /api-v1/notifications/
const notificationsClient = axios.create({
  baseURL: `${API_URL}/notifications`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to notifications client
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

export const alertsApi = {
  list: async (): Promise<Alert[]> => {
    // Try multiple possible endpoint paths based on Django backend structure
    // Pattern 1: /admin/alerts/ (admin panel endpoint under /api-v1/)
    // Pattern 2: /alerts/ (standard endpoint under /api-v1/)
    // Pattern 3: /notifications/alerts/ (if alerts are under notifications like devices)
    
    // Try api-v1 endpoints first
    const apiV1Endpoints = [
      '/admin/alerts/',
      '/alerts/',
    ];

    for (const endpoint of apiV1Endpoints) {
      try {
        console.log(`Trying alerts endpoint: ${apiClient.defaults.baseURL}${endpoint}`);
        const response = await apiClient.get<Alert[] | { results: Alert[] }>(endpoint);
        // Handle both array and paginated responses
        if (Array.isArray(response.data)) {
          console.log(`✅ Successfully fetched alerts from ${endpoint}`);
          return response.data;
        }
        const results = (response.data as any).results || [];
        console.log(`✅ Successfully fetched alerts from ${endpoint}`);
        return results;
      } catch (error: any) {
        console.log(`❌ Endpoint ${endpoint} failed:`, error.response?.status);
        // Continue to next endpoint if 404
        if (error.response?.status === 404) {
          continue;
        }
        // For other errors (401, 403, etc.), throw immediately
        throw error;
      }
    }

    // Try notifications endpoint (outside /api-v1/)
    try {
      console.log(`Trying alerts endpoint: ${notificationsClient.defaults.baseURL}/alerts/`);
      const response = await notificationsClient.get<Alert[] | { results: Alert[] }>('/alerts/');
      if (Array.isArray(response.data)) {
        console.log(`✅ Successfully fetched alerts from /notifications/alerts/`);
        return response.data;
      }
      const results = (response.data as any).results || [];
      console.log(`✅ Successfully fetched alerts from /notifications/alerts/`);
      return results;
    } catch (error: any) {
      console.log(`❌ Endpoint /notifications/alerts/ failed:`, error.response?.status);
      // If all endpoints failed, throw the error
      throw new Error(`Alerts endpoint not found. Tried: /admin/alerts/, /alerts/, and /notifications/alerts/. Last error: ${error.response?.status || error.message}`);
    }
  },

  get: async (id: number): Promise<Alert> => {
    // GET /api-v1/alerts/{id}/
    const response = await apiClient.get<Alert>(`/alerts/${id}/`);
    return response.data;
  },

  markAllRead: async (): Promise<{ status: string }> => {
    // POST /api-v1/alerts/mark-all-read/
    const response = await apiClient.post<{ status: string }>('/alerts/mark-all-read/');
    return response.data;
  },

  markRead: async (id: number): Promise<{ status: string }> => {
    // POST /api-v1/alerts/{id}/mark-read/
    const response = await apiClient.post<{ status: string }>(`/alerts/${id}/mark-read/`);
    return response.data;
  },

  delete: async (id: number): Promise<{ status: string }> => {
    // DELETE /api-v1/alerts/{id}/delete/
    const response = await apiClient.delete<{ status: string }>(`/alerts/${id}/delete/`);
    return response.data;
  },

  create: async (data: {
    title: string;
    body: string;
    kind?: string;
    user?: number; // Optional: if not provided, send to all users
  }): Promise<Alert> => {
    // Try multiple endpoints for creating alerts
    const endpoints = [
      '/admin/alerts/',
      '/alerts/',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.post<Alert>(endpoint, data);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 404) {
          continue;
        }
        throw error;
      }
    }

    // Try notifications endpoint
    try {
      const response = await notificationsClient.post<Alert>('/alerts/', data);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create alert. Tried multiple endpoints. Error: ${error.response?.status || error.message}`);
    }
  },
};

