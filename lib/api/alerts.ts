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
    // Based on Django admin: /admin/notifications/alert/add/
    // The list endpoint should be /api-v1/admin/notifications/alert/ (without /add/)
    // IMPORTANT: Use admin endpoint to get ALL alerts, not just current user's
    // Try multiple possible endpoint paths based on Django backend structure
    
    const endpoints = [
      // Admin endpoints first (to get ALL alerts, not filtered by user)
      '/admin/notifications/alert/',
      '/admin/notifications/alerts/',
      '/admin/alerts/',
      '/admin/notifications/',
      // Standard endpoints (might be filtered by user)
      '/alerts/',
      '/notifications/alert/',
      '/notifications/alerts/',
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
    // Django admin uses /admin/notifications/alert/add/ but that's the admin UI
    // The REST API might use a different endpoint or format
    // Try both JSON and FormData formats
    
    const endpoints = [
      // Try notifications endpoints first (most likely for push notifications)
      { client: notificationsClient, path: '/send/', useFormData: false },
      { client: notificationsClient, path: '/alert/', useFormData: false },
      { client: notificationsClient, path: '/alerts/', useFormData: false },
      { client: notificationsClient, path: '/create/', useFormData: false },
      // Try API endpoints
      { client: apiClient, path: '/admin/notifications/send/', useFormData: false },
      { client: apiClient, path: '/admin/notifications/alert/', useFormData: false },
      { client: apiClient, path: '/admin/notifications/alerts/', useFormData: false },
      { client: apiClient, path: '/admin/alerts/send/', useFormData: false },
      { client: apiClient, path: '/admin/alerts/', useFormData: false },
      { client: apiClient, path: '/notifications/send/', useFormData: false },
      { client: apiClient, path: '/notifications/alert/', useFormData: false },
      { client: apiClient, path: '/notifications/alerts/', useFormData: false },
      { client: apiClient, path: '/alerts/send/', useFormData: false },
      { client: apiClient, path: '/alerts/', useFormData: false },
      // Try with FormData (like products API)
      { client: notificationsClient, path: '/send/', useFormData: true },
      { client: apiClient, path: '/admin/notifications/alert/', useFormData: true },
      { client: apiClient, path: '/admin/alerts/', useFormData: true },
      { client: apiClient, path: '/alerts/', useFormData: true },
    ];

    let lastError: any = null;
    const triedEndpoints: string[] = [];

    for (const { client, path, useFormData } of endpoints) {
      const fullUrl = `${client.defaults.baseURL}${path}`;
      triedEndpoints.push(`${fullUrl} (${useFormData ? 'FormData' : 'JSON'})`);
      
      try {
        console.log(`Trying to create notification at: ${fullUrl} (${useFormData ? 'FormData' : 'JSON'})`);
        console.log('Request data:', data);
        
        let requestData: any;
        let headers: any = {};
        
        if (useFormData) {
          const formData = new FormData();
          formData.append('title', data.title);
          formData.append('body', data.body);
          if (data.kind) formData.append('kind', data.kind);
          if (data.user) formData.append('user', data.user.toString());
          requestData = formData;
          headers['Content-Type'] = 'multipart/form-data';
        } else {
          requestData = data;
        }
        
        const response = await client.post<Alert>(path, requestData, { headers });
        console.log(`✅ Successfully created notification at ${fullUrl}`);
        return response.data;
      } catch (error: any) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const errorDetail = error.response?.data?.detail || error.response?.data?.error_message;
        const allowedMethods = error.response?.headers?.['allow'];
        
        console.log(`❌ Endpoint ${fullUrl} failed:`, {
          status,
          statusText,
          errorDetail,
          allowedMethods,
        });
        
        lastError = error;
        
        // If 405 (Method Not Allowed), try next endpoint
        if (status === 405 || status === 404) {
          continue;
        }
        // For other errors (401, 403, etc.), throw immediately
        throw error;
      }
    }

    // If all endpoints failed, throw a helpful error with all tried endpoints
    const errorMsg = lastError?.response?.data?.detail || 
                    lastError?.response?.data?.error_message || 
                    lastError?.message || 
                    'Failed to create notification';
    
    const allowedMethods = lastError?.response?.headers?.['allow'];
    const triedList = triedEndpoints.join('\n- ');
    
    throw new Error(
      `Failed to create notification. Tried ${triedEndpoints.length} endpoint variations:\n- ${triedList}\n\n` +
      `Last error: ${errorMsg}\n` +
      (allowedMethods ? `Allowed methods: ${allowedMethods}\n` : '') +
      `\n💡 Note: The REST API endpoint for creating alerts may not exist. ` +
      `Django admin uses /admin/notifications/alert/add/ which is the admin UI, not the REST API. ` +
      `You may need to create a REST API endpoint in your Django backend for sending notifications.`
    );
  },
};

