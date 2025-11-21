import axios from 'axios';
import { Alert } from '../types';
import apiClient from './config';

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
    // Based on Django admin: /admin/notifications/alert/add/
    // The list endpoint should be /api-v1/admin/notifications/alert/ (without /add/)
    // IMPORTANT: Use admin endpoint to get ALL alerts, not just current user's
    // Try multiple possible endpoint paths based on Django backend structure
    
    const endpoints = [
      '/alerts/'
    ];

    // Try api-v1 endpoints first
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying alerts list endpoint: ${apiClient.defaults.baseURL}${endpoint}`);
        const response = await apiClient.get<Alert[] | { results: Alert[]; count?: number; next?: string }>(endpoint);
        
        // Handle paginated responses - fetch all pages
        if (response.data && typeof response.data === 'object' && 'results' in response.data) {
          const paginatedData = response.data as { results: Alert[]; count?: number; next?: string };
          let allAlerts = [...paginatedData.results];
          
          // If there are more pages, fetch them all
          let nextUrl = paginatedData.next;
          while (nextUrl) {
            try {
              console.log(`Fetching next page: ${nextUrl}`);
              // Handle both relative and absolute URLs
              let endpoint = nextUrl;
              if (nextUrl.startsWith('http')) {
                // Absolute URL - extract the path
                const urlObj = new URL(nextUrl);
                endpoint = urlObj.pathname + urlObj.search;
              } else if (nextUrl.startsWith(apiClient.defaults.baseURL || '')) {
                // URL with base, extract path
                endpoint = nextUrl.replace(apiClient.defaults.baseURL || '', '');
              }
              const nextResponse = await apiClient.get<{ results: Alert[]; next?: string }>(endpoint);
              allAlerts = [...allAlerts, ...nextResponse.data.results];
              nextUrl = nextResponse.data.next;
            } catch (err) {
              console.warn('Error fetching next page:', err);
              break;
            }
          }
          
          console.log(`✅ Successfully fetched ${allAlerts.length} alerts from ${endpoint} (${paginatedData.count || allAlerts.length} total)`);
          return allAlerts;
        }
        
        // Handle array responses
        if (Array.isArray(response.data)) {
          console.log(`✅ Successfully fetched ${response.data.length} alerts from ${endpoint}`);
          return response.data;
        }
        
        // Fallback
        const results = (response.data as any).results || [];
        console.log(`✅ Successfully fetched ${results.length} alerts from ${endpoint}`);
        return results;
      } catch (error: any) {
        console.log(`❌ Endpoint ${endpoint} failed:`, error.response?.status, error.response?.statusText);
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
        console.log(`✅ Successfully fetched ${response.data.length} alerts from /notifications/alerts/`);
        return response.data;
      }
      const results = (response.data as any).results || [];
      console.log(`✅ Successfully fetched ${results.length} alerts from /notifications/alerts/`);
      return results;
    } catch (error: any) {
      console.log(`❌ Endpoint /notifications/alerts/ failed:`, error.response?.status);
      // If all endpoints failed, throw the error
      throw new Error(`Alerts endpoint not found. Tried multiple endpoints. Last error: ${error.response?.status || error.message}`);
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
    try {
      const response = await apiClient.post<{ status?: string }>(`/alerts/${id}/mark-read/`);

      // Some backends return 204 No Content for mark-read endpoints
      if (response.status === 204) {
        return { status: 'ok' };
      }

      // If the response contains a body, return it (best-effort)
      if (response.data && typeof response.data === 'object') {
        return response.data as { status: string };
      }

      // Fallback
      return { status: 'ok' };
    } catch (error: any) {
      console.error(`Failed to mark alert ${id} as read:`, error.response?.status, error.response?.data || error.message);
      const errMsg = error.response?.data?.detail || error.response?.data || error.message || 'Unknown error';
      throw new Error(`Could not mark alert ${id} as read: ${errMsg}`);
    }
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
    // Try to create an alert using POST to common endpoints.
    // Prefer the API client base (`/api-v1/...`) then fall back to `/notifications/alerts/`.
    const payload: any = {
      title: data.title,
      body: data.body,
    };
    if (data.kind) payload.kind = data.kind;
    if (typeof data.user !== 'undefined') payload.user = data.user;

    const tryEndpoints = async () => {
      // If the backend uses `/alerts/{id}/mark-read/` as the push endpoint,
      // try that first when a `user` (id) is provided.
      if (typeof data.user !== 'undefined') {
        const markReadEndpoint = `/alerts/${data.user}/mark-read/`;
        try {
          console.log(`Trying create via mark-read endpoint POST ${apiClient.defaults.baseURL}${markReadEndpoint}`, payload);
          const resp = await apiClient.post<Alert>(markReadEndpoint, payload);
          console.log(`✅ Created alert via ${markReadEndpoint}`);
          return resp.data;
        } catch (err: any) {
          console.warn(`Failed POST ${markReadEndpoint}:`, err.response?.status);
          // fall through to other attempts
        }
      }

      const endpoints = ['/alerts/', '/admin/notifications/alert/'];

      for (const endpoint of endpoints) {
        try {
          console.log(`Trying to create alert via POST ${apiClient.defaults.baseURL}${endpoint}`, payload);
          const resp = await apiClient.post<Alert>(endpoint, payload);
          console.log(`✅ Created alert via ${endpoint}`);
          return resp.data;
        } catch (err: any) {
          console.warn(`Failed POST ${endpoint}:`, err.response?.status);
          // continue to next endpoint for 404 or 405
          if (err.response && [404, 405].includes(err.response.status)) continue;
          throw err;
        }
      }

      // Fallback to notificationsClient (/notifications/alerts/)
      try {
        console.log(`Trying fallback notifications endpoint: ${notificationsClient.defaults.baseURL}/alerts/`, payload);
        const resp = await notificationsClient.post<Alert>('/alerts/', payload);
        console.log('✅ Created alert via /notifications/alerts/');
        return resp.data;
      } catch (err: any) {
        console.error('All create alert endpoints failed:', err.response?.status, err.response?.data || err.message);
        throw err;
      }
    };

    return await tryEndpoints();
  },
};

