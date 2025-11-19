import apiClient from './config';
import { Alert } from '../types';

export const alertsApi = {
  list: async (): Promise<Alert[]> => {
    // Use admin endpoint to get all alerts (not just current user's)
    const response = await apiClient.get<Alert[] | { results: Alert[] }>('/admin/alerts/');
    // Handle both array and paginated responses
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return (response.data as any).results || [];
  },

  get: async (id: number): Promise<Alert> => {
    const response = await apiClient.get<Alert>(`/alerts/${id}/`);
    return response.data;
  },

  markAllRead: async (): Promise<{ status: string }> => {
    const response = await apiClient.post<{ status: string }>('/alerts/mark-all-read/');
    return response.data;
  },

  markRead: async (id: number): Promise<{ status: string }> => {
    const response = await apiClient.post<{ status: string }>(`/alerts/${id}/mark-read/`);
    return response.data;
  },

  delete: async (id: number): Promise<{ status: string }> => {
    const response = await apiClient.delete<{ status: string }>(`/alerts/${id}/delete/`);
    return response.data;
  },
};

