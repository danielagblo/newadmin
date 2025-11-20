import apiClient from './config';
import { Feedback, CreateFeedbackForm, UpdateFeedbackForm, PaginatedResponse } from '../types';

export const feedbackApi = {
  list: async (params?: { status?: string; user?: number }): Promise<Feedback[]> => {
    // Try multiple endpoints
    const endpoints = [
      '/feedback/',
      '/feedbacks/',
      '/admin/feedback/',
      '/admin/feedbacks/',
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying feedback endpoint: ${endpoint} with params:`, params);
        const response = await apiClient.get<Feedback[] | PaginatedResponse<Feedback>>(endpoint, { params });
        console.log(`✅ Successfully fetched from ${endpoint}:`, response.data);
        
        // Handle array response
        if (Array.isArray(response.data)) {
          console.log(`✅ Fetched ${response.data.length} feedbacks (array format)`);
          return response.data;
        }
        
        // Handle paginated response
        const paginatedData = response.data as PaginatedResponse<Feedback>;
        if (paginatedData.results && Array.isArray(paginatedData.results)) {
          let allFeedbacks = [...paginatedData.results];
          console.log(`✅ Fetched ${allFeedbacks.length} feedbacks from page 1 (paginated format)`);
          
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
                  console.log(`✅ Fetched ${pageData.results.length} feedbacks from page ${currentPage}`);
                  
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
          
          console.log(`✅ Total feedbacks fetched: ${allFeedbacks.length}`);
          return allFeedbacks;
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
    
    // If all endpoints failed, throw error
    console.error('❌ All feedback endpoints failed');
    throw new Error('Failed to fetch feedbacks from all available endpoints');
  },

  get: async (id: number): Promise<Feedback> => {
    const endpoints = ['/feedback/', '/feedbacks/', '/admin/feedback/', '/admin/feedbacks/'];
    
    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.get<Feedback>(`${endpoint}${id}/`);
        return response.data;
      } catch (error: any) {
        if (error.response?.status !== 404) {
          throw error;
        }
        continue;
      }
    }
    
    throw new Error('Feedback not found');
  },

  create: async (data: CreateFeedbackForm): Promise<Feedback> => {
    const endpoints = ['/feedback/', '/feedbacks/'];
    
    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.post<Feedback>(endpoint, data);
        return response.data;
      } catch (error: any) {
        if (error.response?.status !== 404) {
          throw error;
        }
        continue;
      }
    }
    
    throw new Error('Failed to create feedback');
  },

  update: async (id: number, data: UpdateFeedbackForm): Promise<Feedback> => {
    const endpoints = ['/feedback/', '/feedbacks/', '/admin/feedback/', '/admin/feedbacks/'];
    
    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.put<Feedback>(`${endpoint}${id}/`, data);
        return response.data;
      } catch (error: any) {
        if (error.response?.status !== 404) {
          throw error;
        }
        continue;
      }
    }
    
    throw new Error('Failed to update feedback');
  },

  delete: async (id: number): Promise<void> => {
    const endpoints = ['/feedback/', '/feedbacks/', '/admin/feedback/', '/admin/feedbacks/'];
    
    for (const endpoint of endpoints) {
      try {
        await apiClient.delete(`${endpoint}${id}/`);
        return;
      } catch (error: any) {
        if (error.response?.status !== 404) {
          throw error;
        }
        continue;
      }
    }
    
    throw new Error('Failed to delete feedback');
  },
};

