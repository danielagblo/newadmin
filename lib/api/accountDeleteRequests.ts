import { AccountDeleteRequest } from '../types';
import { apiClient } from './config';

export const accountDeleteRequestsApi = {
  list: async (params?: { search?: string; status?: string; ordering?: string }): Promise<AccountDeleteRequest[]> => {
    const resp = await apiClient.get<AccountDeleteRequest[]>('/account-delete-requests/', { params });
    // API may return array or paginated object; handle both
    if (Array.isArray(resp.data)) return resp.data;
    // try paginated shape
    if (resp.data && typeof resp.data === 'object' && 'results' in (resp.data as any)) {
      return (resp.data as any).results as AccountDeleteRequest[];
    }
    return resp.data as AccountDeleteRequest[];
  },

  // Admin actions: approve/reject endpoints (POST)
  approve: async (id: number, payload?: { reason?: string | null }): Promise<AccountDeleteRequest> => {
    const resp = await apiClient.post<AccountDeleteRequest>(`/account-delete-requests/${id}/approve/`, payload || {});
    return resp.data;
  },

  reject: async (id: number, payload?: { reason?: string | null }): Promise<AccountDeleteRequest> => {
    const resp = await apiClient.post<AccountDeleteRequest>(`/account-delete-requests/${id}/reject/`, payload || {});
    return resp.data;
  },
};

export default accountDeleteRequestsApi;
