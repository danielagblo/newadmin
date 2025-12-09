import { PaginatedResponse, Product } from '../types';
import apiClient from './config';

type CreateProductForm = Record<string, any>;

export const productsApi = {
  list: async (params?: {
    page?: number;
    category?: number;
    pid?: string;
    search?: string;
    ordering?: string;
    status?: string;
    is_taken?: boolean;
  }): Promise<Product[] | PaginatedResponse<Product>> => {
    // Request owner expansion - try common API patterns
    const requestParams: any = { ...params };
    // Try multiple expansion patterns that different APIs might use
    requestParams.expand = 'owner';
    requestParams.include = 'owner';
    // Some APIs use fields parameter
    // requestParams.fields = '*,owner.*';
    
    const response = await apiClient.get<Product[] | PaginatedResponse<Product>>('/products/', { 
      params: requestParams 
    });
    
    // Handle array response
    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    // Handle paginated response - return as-is, let the caller handle pagination
    return response.data as PaginatedResponse<Product>;
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

  setStatus: async (id: number, status: string, suspension_note?: string): Promise<Product> => {
    const payload: any = { id, status };
    if (suspension_note !== undefined) payload.suspension_note = suspension_note;
    const response = await apiClient.put<Product>(`/products/${id}/set-status/`, payload);
    return response.data;
  },

  markAsTaken: async (id: number): Promise<Product> => {
    const response = await apiClient.post<Product>(`/products/${id}/mark-as-taken/`, {
      product: id,
    });
    return response.data;
  },
};

