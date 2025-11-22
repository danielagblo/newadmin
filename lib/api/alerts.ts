import axios from 'axios';
import { Alert } from '../types';
import apiClient from './config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Notifications endpoints are at /notifications/ (some Django setups expose alerts there)
const notificationsClient = axios.create({
  baseURL: `${API_URL}/notifications`,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to notifications client (same behavior as other clients)
notificationsClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) (config.headers as any).Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const alertsApi = {
  list: async (): Promise<Alert[]> => {
    const endpoints = ['/alerts/'];

    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.get<Alert[] | { results: Alert[]; next?: string }>(endpoint);

        // handle paginated response
        if (response.data && typeof response.data === 'object' && 'results' in response.data) {
          const paginated = response.data as { results: Alert[]; next?: string };
          let all = [...paginated.results];
          let nextUrl = paginated.next;
          while (nextUrl) {
            try {
              let path = nextUrl;
              if (nextUrl.startsWith('http')) {
                const u = new URL(nextUrl);
                path = u.pathname + u.search;
              } else if (nextUrl.startsWith(apiClient.defaults.baseURL || '')) {
                path = nextUrl.replace(apiClient.defaults.baseURL || '', '');
              }
              const pageResp = await apiClient.get<{ results: Alert[]; next?: string }>(path);
              all = [...all, ...pageResp.data.results];
              nextUrl = pageResp.data.next as any;
            } catch (e) {
              break;
            }
          }
          return all;
        }

        if (Array.isArray(response.data)) return response.data;
        return (response.data as any).results || [];
      } catch (err: any) {
        if (err.response?.status === 404) continue;
        throw err;
      }
    }
    // Ensure the function always returns an Alert[] (avoid undefined)
    return [];
  },

  get: async (id: number): Promise<Alert> => {
    const resp = await apiClient.get<Alert>(`/alerts/${id}/`);
    return resp.data;
  },

  markAllRead: async (): Promise<{ status: string }> => {
    const resp = await apiClient.post<{ status: string }>('/alerts/mark-all-read/');
    return resp.data;
  },

  markRead: async (id: number): Promise<{ status: string }> => {
    try {
      const resp = await apiClient.post<{ status?: string }>(`/alerts/${id}/mark-read/`);
      if (resp.status === 204) return { status: 'ok' };
      if (resp.data && typeof resp.data === 'object') return resp.data as { status: string };
      return { status: 'ok' };
    } catch (err: any) {
      const msg = err.response?.data || err.message || 'Unknown error';
      throw new Error(`Could not mark alert ${id} as read: ${JSON.stringify(msg)}`);
    }
  },

  delete: async (id: number): Promise<{ status: string }> => {
    const resp = await apiClient.delete<{ status: string }>(`/alerts/${id}/delete/`);
    return resp.data;
  },

  create: async (data: { title: string; body: string; kind?: string; is_read?: boolean; user?: number }): Promise<Alert> => {
    const payload: any = { title: data.title, body: data.body };
    if (data.kind) payload.kind = data.kind;
    if (typeof data.is_read !== 'undefined') payload.is_read = !!data.is_read;
    if (typeof data.user !== 'undefined') payload.user = data.user;

    const endpoints = ['/alerts/'];

    for (const endpoint of endpoints) {
      try {
        const resp = await apiClient.post<Alert>(endpoint, payload);
        return resp.data;
      } catch (err: any) {
        if (err.response && [404, 405].includes(err.response.status)) continue;
        if (err.response && err.response.data) throw new Error(`Create alert failed: ${JSON.stringify(err.response.data)}`);
        throw err;
      }
    }

    try {
      const resp = await notificationsClient.post<Alert>('/alerts/', payload);
      return resp.data;
    } catch (err: any) {
      throw new Error(`Could not create alert. Last error: ${err.response?.status || err.message}`);
    }
  },
};



