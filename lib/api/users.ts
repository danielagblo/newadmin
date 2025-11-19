import apiClient from './config';
import { User, CreateUserForm, UpdateUserForm, PaginatedResponse } from '../types';

export const usersApi = {
  list: async (search?: string): Promise<User[]> => {
    const params = search ? { q: search } : {};
    const response = await apiClient.get<User[]>('/admin/users/', { params });
    return response.data;
  },

  get: async (id: number): Promise<User> => {
    // Get user from list and filter by id, or use userprofile if it's the current user
    const users = await usersApi.list();
    const user = users.find(u => u.id === id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  },

  create: async (data: CreateUserForm): Promise<User> => {
    // Use register endpoint for user creation
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
    const response = await apiClient.post<{ user: User; token: string }>('/register/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.user;
  },

  update: async (id: number, data: Partial<UpdateUserForm>): Promise<User> => {
    // Note: The backend uses /userprofile/ for updates, but it updates the current user
    // For admin updates, we might need to use Django admin or create a dedicated endpoint
    // This is a workaround - update via userprofile if it's the current user, otherwise use register
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
    // For now, we'll use userprofile endpoint - you may need to create an admin update endpoint
    const response = await apiClient.put<User>('/userprofile/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    // Delete uses /userprofile/ DELETE with id in body
    await apiClient.delete('/userprofile/', {
      data: { id },
    });
  },

  toggleActive: async (id: number, isActive: boolean): Promise<User> => {
    const response = await apiClient.post<User>('/userprofile/', {
      id,
      is_active: isActive,
    });
    return response.data;
  },

  verify: async (id: number, adminVerified: boolean = true): Promise<User> => {
    const response = await apiClient.post<User>('/admin/verifyuser/', {
      id,
      admin_verified: adminVerified,
    });
    return response.data;
  },
};

