import apiClient from './config';
import { Feedback, CreateFeedbackForm, UpdateFeedbackForm, PaginatedResponse } from '../types';

export const feedbackApi = {
  list: async (params?: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
  }): Promise<Feedback[]> => {
    // Try multiple endpoints
    const endpoints = [
      '/admin/feedback/',
      '/feedback/',
      '/admin/feedbacks/',
      '/feedbacks/',
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying feedback endpoint: ${endpoint} with params:`, params);
        const response = await apiClient.get<Feedback[] | PaginatedResponse<Feedback>>(endpoint, { params });
        console.log(`✅ Successfully fetched from ${endpoint}:`, response.data);
        
        // Handle array response
        if (Array.isArray(response.data)) {
          console.log(`✅ Fetched ${response.data.length} feedback items (array format)`);
          return response.data;
        }
        
        // Handle paginated response
        const paginatedData = response.data as PaginatedResponse<Feedback>;
        if (paginatedData.results && Array.isArray(paginatedData.results)) {
          let allFeedback = [...paginatedData.results];
          console.log(`✅ Fetched ${allFeedback.length} feedback items from page 1 (paginated format)`);
          
          // Fetch all remaining pages if paginated
          if (paginatedData.next) {
            let currentPage = 2;
            let hasMore = true;
            
            while (hasMore) {
              try {
                const pageParams = { ...params, page: currentPage };
                const pageResponse = await apiClient.get<PaginatedResponse<Feedback>>(endpoint, { 
                  params: pageParams 
                });
                const pageData = pageResponse.data;
                
                if (pageData.results && Array.isArray(pageData.results)) {
                  allFeedback = [...allFeedback, ...pageData.results];
                  console.log(`✅ Fetched ${pageData.results.length} feedback items from page ${currentPage}`);
                  
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
          
          console.log(`✅ Total feedback items fetched: ${allFeedback.length}`);
          return allFeedback;
        }
        
        // If response format is unexpected, try next endpoint
        console.warn(`⚠️ Unexpected response format from ${endpoint}:`, response.data);
        continue;
      } catch (error: any) {
        console.log(`❌ ${endpoint} failed:`, error.response?.status || error.message);
        // Try next endpoint
        continue;
      }
    }
    
    // If all endpoints failed, return empty array (endpoints don't exist yet)
    console.warn('⚠️ All feedback endpoints failed - endpoints may not exist yet');
    return [];
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

