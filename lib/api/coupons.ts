import { Coupon, CreateCouponForm } from '../types';
import apiClient from './config';

export const couponsApi = {
  list: async (params?: {
    code?: string;
    is_active?: boolean;
    discount_type?: string;
    search?: string;
  }): Promise<Coupon[] | { results: Coupon[]; count?: number; next?: string | null }> => {
    const response = await apiClient.get<Coupon[] | { results: Coupon[]; count?: number; next?: string | null }>('/coupons/', { params });
    
    // Handle array response
    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    // Handle paginated response
    return response.data as { results: Coupon[]; count?: number; next?: string | null };
  },

  get: async (id: number): Promise<Coupon> => {
    const response = await apiClient.get<Coupon>(`/coupons/${id}/`);
    return response.data;
  },

  create: async (data: CreateCouponForm): Promise<Coupon> => {
    const response = await apiClient.post<Coupon>('/coupons/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CreateCouponForm>): Promise<Coupon> => {
    const response = await apiClient.put<Coupon>(`/coupons/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/coupons/${id}/`);
  },

  expire: async (id: number): Promise<{ status: string }> => {
    const response = await apiClient.post<{ status: string }>(`/coupons/${id}/expire/`);
    return response.data;
  },

  broadcast: async (id: number, user_ids: number[]): Promise<any> => {
    const payload = { user_ids };
    const response = await apiClient.post(`/coupons/${id}/broadcast/`, payload);
    return response.data;
  },
};

