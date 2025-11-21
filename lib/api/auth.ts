import apiClient from './config';
import { LoginForm, LoginResponse, User, ApiError } from '../types';

export const authApi = {
  login: async (data: LoginForm): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/login/', data);
    if (response.data.token && typeof window !== 'undefined') {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  adminLogin: async (data: LoginForm): Promise<LoginResponse> => {
    // Log request details in development
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || '/api-v1';
      console.log('Admin login request:', {
        url: `${apiUrl}${apiBase}/adminlogin/`,
        data: { email: data.email, password: '***' },
      });
    }
    
    const response = await apiClient.post<LoginResponse>('/adminlogin/', data);
    if (response.data.token && typeof window !== 'undefined') {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/logout/');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
  },

  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>('/userprofile/');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
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
    const response = await apiClient.put<User>('/userprofile/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  changePassword: async (oldPassword: string, newPassword: string, confirmPassword: string): Promise<void> => {
    await apiClient.post('/changepassword/', {
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
  },
};

