import { ProductReport } from '../types';
import apiClient from './config';

export const reportsApi = {
  list: async (params?: any): Promise<ProductReport[] | { results: ProductReport[]; count?: number }> => {
    const response = await apiClient.get<ProductReport[] | { results: ProductReport[]; count?: number }>('/product-reports/', { params });
    // Return raw response data; caller handles array or paginated shape
    return response.data as any;
  },

  get: async (id: number): Promise<ProductReport> => {
    const response = await apiClient.get<ProductReport>(`/product-reports/${id}/`);
    return response.data;
  },
};

export default reportsApi;
