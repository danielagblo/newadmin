import apiClient from './config';
import { Review } from '../types';

export const reviewsApi = {
  list: async (params?: { product?: number; user?: number }): Promise<Review[]> => {
    const response = await apiClient.get<Review[]>('/reviews/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Review> => {
    const response = await apiClient.get<Review>(`/reviews/${id}/`);
    return response.data;
  },

  create: async (data: { product: number; rating: number; comment?: string }): Promise<Review> => {
    const response = await apiClient.post<Review>('/reviews/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Review>): Promise<Review> => {
    const response = await apiClient.put<Review>(`/reviews/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/reviews/${id}/`);
  },
};

