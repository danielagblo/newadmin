import { Payment } from '../types';
import apiClient from './config';

export const paymentsApi = {
  list: async (params?: {
    ordering?: string;
    provider?: string;
    search?: string;
    status?: string;
    subscription?: number;
    page?: number;
  }): Promise<Payment[] | { results: Payment[]; count?: number; next?: string | null } > => {
    const response = await apiClient.get<Payment[] | { results: Payment[]; count?: number; next?: string | null }>('/payments/', { params });
    return response.data as any;
  },

  get: async (id: number): Promise<Payment> => {
    const response = await apiClient.get<Payment>(`/payments/${id}/`);
    return response.data;
  },
};
