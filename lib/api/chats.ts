import apiClient from './config';
import { ChatRoom, Message, PaginatedResponse } from '../types';

export const chatRoomsApi = {
  list: async (params?: {
    ordering?: string;
    search?: string;
  }): Promise<ChatRoom[]> => {
    const response = await apiClient.get<ChatRoom[] | PaginatedResponse<ChatRoom>>('/chatrooms/', { params });
    
    // Handle array response
    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    // Handle paginated response
    const paginatedData = response.data as PaginatedResponse<ChatRoom>;
    if (paginatedData.results && Array.isArray(paginatedData.results)) {
      return paginatedData.results;
    }
    
    return [];
  },

  get: async (id: number): Promise<ChatRoom> => {
    const response = await apiClient.get<ChatRoom>(`/chatrooms/${id}/`);
    return response.data;
  },

  create: async (data: {
    name: string;
    is_group: boolean;
    members?: number[]; // Array of user IDs
  }): Promise<ChatRoom> => {
    const response = await apiClient.post<ChatRoom>('/chatrooms/', data);
    return response.data;
  },

  update: async (id: number, data: {
    name?: string;
    is_group?: boolean;
    members?: number[]; // Array of user IDs
  }): Promise<ChatRoom> => {
    const response = await apiClient.put<ChatRoom>(`/chatrooms/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/chatrooms/${id}/`);
  },

  getMessages: async (id: number): Promise<Message[]> => {
    const response = await apiClient.get<Message[]>(`/chatrooms/${id}/messages/`);
    return response.data;
  },

  sendMessage: async (id: number, content: string): Promise<Message> => {
    const response = await apiClient.post<Message>(`/chatrooms/${id}/send/`, {
      message: content,
    });
    return response.data;
  },

  markRead: async (id: number): Promise<{ status: string }> => {
    const response = await apiClient.post<{ status: string }>(`/chatrooms/${id}/mark-read/`);
    return response.data;
  },
};

export const messagesApi = {
  list: async (room?: number): Promise<Message[]> => {
    const params = room ? { room } : {};
    const response = await apiClient.get<Message[]>('/messages/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Message> => {
    const response = await apiClient.get<Message>(`/messages/${id}/`);
    return response.data;
  },
};

