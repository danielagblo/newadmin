import apiClient from './config';
import { Product, CreateProductForm, PaginatedResponse } from '../types';

export const productsApi = {
  list: async (params?: {
    page?: number;
    category?: number;
    pid?: string;
    search?: string;
    ordering?: string;
  }): Promise<PaginatedResponse<Product>> => {
    const response = await apiClient.get<PaginatedResponse<Product>>('/products/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Product> => {
    const response = await apiClient.get<Product>(`/products/${id}/`);
    return response.data;
  },

  create: async (data: CreateProductForm): Promise<Product> => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const val = value as any;
        if (val instanceof File) {
          formData.append(key, val);
        } else {
          formData.append(key, String(value));
        }
      }
    });
    const response = await apiClient.post<Product>('/products/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  update: async (id: number, data: Partial<CreateProductForm>): Promise<Product> => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const val = value as any;
        if (val instanceof File) {
          formData.append(key, val);
        } else {
          formData.append(key, String(value));
        }
      }
    });
    const response = await apiClient.put<Product>(`/products/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/products/${id}/`);
  },

  setStatus: async (id: number, status: string): Promise<Product> => {
    const response = await apiClient.put<Product>(`/products/${id}/set-status/`, {
      id,
      status,
    });
    return response.data;
  },

  markAsTaken: async (id: number): Promise<Product> => {
    const response = await apiClient.post<Product>(`/products/${id}/mark-as-taken/`, {
      product: id,
    });
    return response.data;
  },
};

