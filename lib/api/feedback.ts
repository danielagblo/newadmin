import apiClient from './config';
import { Feedback, CreateFeedbackForm, UpdateFeedbackForm, PaginatedResponse } from '../types';

export const feedbackApi = {
  list: async (params?: { status?: string; user?: number; ordering?: string; search?: string }): Promise<Feedback[]> => {
    // Use the correct endpoint from API docs: /api-v1/feedback/
    const endpoint = '/feedback/';
    
    try {
      const response = await apiClient.get<Feedback[] | PaginatedResponse<Feedback>>(endpoint, { params });
      
      // Handle array response
      if (Array.isArray(response.data)) {
        return response.data;
      }
      
      // Handle paginated response
      const paginatedData = response.data as PaginatedResponse<Feedback>;
      if (paginatedData.results && Array.isArray(paginatedData.results)) {
        let allFeedbacks = [...paginatedData.results];
        
        // Fetch all remaining pages if paginated
        if (paginatedData.next) {
          let currentPage = 2;
          let hasMore = true;
          
          while (hasMore) {
            try {
              const pageParams = { ...params, page: currentPage };
              const pageResponse = await apiClient.get<PaginatedResponse<Feedback>>(endpoint, { params: pageParams });
              const pageData = pageResponse.data;
              
              if (pageData.results && Array.isArray(pageData.results)) {
                allFeedbacks = [...allFeedbacks, ...pageData.results];
                
                if (pageData.next) {
                  currentPage++;
                } else {
                  hasMore = false;
                }
              } else {
                hasMore = false;
              }
            } catch (error) {
              console.error(`Error fetching feedback page ${currentPage}:`, error);
              hasMore = false;
            }
          }
        }
        
        return allFeedbacks;
      }
      
      return [];
    } catch (error: any) {
      console.error('Error fetching feedback:', error);
      throw error;
    }
  },

  get: async (id: number): Promise<Feedback> => {
    const response = await apiClient.get<Feedback>(`/feedback/${id}/`);
    return response.data;
  },

  create: async (data: CreateFeedbackForm): Promise<Feedback> => {
    const response = await apiClient.post<Feedback>('/feedback/', data);
    return response.data;
  },

  update: async (id: number, data: UpdateFeedbackForm): Promise<Feedback> => {
    const response = await apiClient.put<Feedback>(`/feedback/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/feedback/${id}/`);
  },
};

