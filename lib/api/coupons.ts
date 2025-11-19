import apiClient from './config';
import { Coupon, CreateCouponForm, CouponRedemption } from '../types';

export const couponsApi = {
  list: async (params?: {
    code?: string;
    is_active?: boolean;
    discount_type?: string;
    search?: string;
  }): Promise<Coupon[]> => {
    const response = await apiClient.get<Coupon[]>('/coupons/', { params });
    return response.data;
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
};

