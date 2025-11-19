import apiClient from './config';
import { Category, SubCategory, Feature, CreateCategoryForm, CreateSubCategoryForm } from '../types';

export const categoriesApi = {
  list: async (): Promise<Category[]> => {
    const response = await apiClient.get<Category[]>('/admin/categories/');
    return response.data;
  },

  get: async (id: number): Promise<Category> => {
    const response = await apiClient.get<Category>(`/categories/${id}/`);
    return response.data;
  },

  create: async (data: CreateCategoryForm): Promise<Category> => {
    const response = await apiClient.post<Category>('/categories/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CreateCategoryForm>): Promise<Category> => {
    const response = await apiClient.put<Category>(`/categories/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/categories/${id}/`);
  },
};

export const subCategoriesApi = {
  list: async (category?: number): Promise<SubCategory[]> => {
    const params = category ? { category } : {};
    const response = await apiClient.get<SubCategory[]>('/subcategories/', { params });
    return response.data;
  },

  get: async (id: number): Promise<SubCategory> => {
    const response = await apiClient.get<SubCategory>(`/subcategories/${id}/`);
    return response.data;
  },

  create: async (data: CreateSubCategoryForm): Promise<SubCategory> => {
    const response = await apiClient.post<SubCategory>('/subcategories/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CreateSubCategoryForm>): Promise<SubCategory> => {
    const response = await apiClient.put<SubCategory>(`/subcategories/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/subcategories/${id}/`);
  },
};

export const featuresApi = {
  list: async (subcategory?: number): Promise<Feature[]> => {
    const params = subcategory ? { subcategory } : {};
    const response = await apiClient.get<Feature[]>('/features/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Feature> => {
    const response = await apiClient.get<Feature>(`/features/${id}/`);
    return response.data;
  },

  create: async (data: { subcategory: number; name: string; description: string }): Promise<Feature> => {
    const response = await apiClient.post<Feature>('/features/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Feature>): Promise<Feature> => {
    const response = await apiClient.put<Feature>(`/features/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/features/${id}/`);
  },
};

