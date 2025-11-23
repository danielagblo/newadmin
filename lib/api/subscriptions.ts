import apiClient from './config';
import { Subscription, CreateSubscriptionForm, PaginatedResponse } from '../types';

export const subscriptionsApi = {
  list: async (params?: {
    duration_days?: number;
    is_active?: boolean;
    max_products?: number;
    price?: number;
    ordering?: string;
    search?: string;
  }): Promise<Subscription[]> => {
    const response = await apiClient.get<Subscription[] | PaginatedResponse<Subscription>>('/subscriptions/', { params });
    
    // Handle array response
    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    // Handle paginated response
    const paginatedData = response.data as PaginatedResponse<Subscription>;
    if (paginatedData.results && Array.isArray(paginatedData.results)) {
      return paginatedData.results;
    }
    
    return [];
  },

  get: async (id: number): Promise<Subscription> => {
    const response = await apiClient.get<Subscription>(`/subscriptions/${id}/`);
    return response.data;
  },

  create: async (data: CreateSubscriptionForm): Promise<Subscription> => {
    const response = await apiClient.post<Subscription>('/subscriptions/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CreateSubscriptionForm>): Promise<Subscription> => {
    const response = await apiClient.put<Subscription>(`/subscriptions/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/subscriptions/${id}/`);
  },
};

