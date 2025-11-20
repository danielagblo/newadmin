import apiClient from './config';
import { Subscription, CreateSubscriptionForm } from '../types';

export const subscriptionsApi = {
  list: async (): Promise<Subscription[]> => {
    const response = await apiClient.get<Subscription[]>('/subscriptions/');
    return response.data;
  },

  get: async (id: number): Promise<Subscription> => {
    const response = await apiClient.get<Subscription>(`/subscriptions/${id}/`);
    return response.data;
  },

  create: async (data: CreateSubscriptionForm): Promise<Subscription> => {
    const response = await apiClient.post<Subscription>('/subscriptions/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CreateSubscriptionForm>): Promise<Subscription> => {
    const response = await apiClient.put<Subscription>(`/subscriptions/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/subscriptions/${id}/`);
  },
};

