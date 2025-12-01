import { Category, CreateCategoryForm, CreateSubCategoryForm, Feature, SubCategory } from '../types';
import apiClient from './config';

export const categoriesApi = {
  list: async (): Promise<Category[]> => {
    // Try admin endpoint first (includes subcategories), fallback to regular endpoint
    try {
      console.log('Trying categories endpoint: /admin/categories/');
      const response = await apiClient.get<Category[] | { results: Category[]; next?: string; count?: number }>('/admin/categories/');
      console.log('Categories API response:', response.data);
      
      // Handle array response
      if (Array.isArray(response.data)) {
        console.log(`✅ Fetched ${response.data.length} categories from /admin/categories/ (array format)`);
        return response.data;
      }
      
      // Handle paginated response
      const paginatedData = response.data as any;
      if (paginatedData.results && Array.isArray(paginatedData.results)) {
        let allCategories = [...paginatedData.results];
        console.log(`✅ Fetched ${allCategories.length} categories from page 1 (paginated format)`);
        
        // Fetch all remaining pages if paginated
        if (paginatedData.next) {
          let currentPage = 2;
          let hasMore = true;
          
          while (hasMore) {
            try {
              const pageResponse = await apiClient.get<{ results: Category[]; next?: string }>('/admin/categories/', { 
                params: { page: currentPage } 
              });
              const pageData = pageResponse.data;
              
              if (pageData.results && Array.isArray(pageData.results)) {
                allCategories = [...allCategories, ...pageData.results];
                console.log(`✅ Fetched ${pageData.results.length} categories from page ${currentPage}`);
                
                if (pageData.next) {
                  currentPage++;
                } else {
                  hasMore = false;
                }
              } else {
                hasMore = false;
              }
            } catch (error) {
              console.error(`Error fetching categories page ${currentPage}:`, error);
              hasMore = false;
            }
          }
        }
        
        console.log(`✅ Total categories fetched: ${allCategories.length}`);
        return allCategories;
      }
      
      // If response format is unexpected, try fallback
      console.warn('⚠️ Unexpected response format from /admin/categories/, trying fallback');
      throw new Error('Unexpected response format');
    } catch (error: any) {
      console.log('❌ /admin/categories/ failed:', error.response?.status || error.message);
      // Fallback to regular categories endpoint
      try {
        console.log('Trying categories endpoint: /categories/');
        const response = await apiClient.get<Category[] | { results: Category[]; next?: string }>('/categories/');
        console.log('Categories API response (fallback):', response.data);
        
        // Handle array response
        if (Array.isArray(response.data)) {
          console.log(`✅ Fetched ${response.data.length} categories from /categories/ (array format)`);
          return response.data;
        }
        
        // Handle paginated response
        const paginatedData = response.data as any;
        if (paginatedData.results && Array.isArray(paginatedData.results)) {
          let allCategories = [...paginatedData.results];
          console.log(`✅ Fetched ${allCategories.length} categories from page 1 (paginated format)`);
          
          // Fetch all remaining pages if paginated
          if (paginatedData.next) {
            let currentPage = 2;
            let hasMore = true;
            
            while (hasMore) {
              try {
                const pageResponse = await apiClient.get<{ results: Category[]; next?: string }>('/categories/', { 
                  params: { page: currentPage } 
                });
                const pageData = pageResponse.data;
                
                if (pageData.results && Array.isArray(pageData.results)) {
                  allCategories = [...allCategories, ...pageData.results];
                  console.log(`✅ Fetched ${pageData.results.length} categories from page ${currentPage}`);
                  
                  if (pageData.next) {
                    currentPage++;
                  } else {
                    hasMore = false;
                  }
                } else {
                  hasMore = false;
                }
              } catch (error) {
                console.error(`Error fetching categories page ${currentPage}:`, error);
                hasMore = false;
              }
            }
          }
          
          console.log(`✅ Total categories fetched: ${allCategories.length}`);
          return allCategories;
        }
        
        console.warn('⚠️ Unexpected response format from /categories/');
        return [];
      } catch (fallbackError: any) {
        console.log('❌ /categories/ also failed:', fallbackError.response?.status || fallbackError.message);
        throw fallbackError; // Throw the last error
      }
    }
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
    const params: any = category ? { category } : {};
    console.log('Fetching subcategories with params:', params);
    
    try {
      const response = await apiClient.get<SubCategory[] | { results: SubCategory[]; next?: string }>('/subcategories/', { params });
      console.log('Subcategories API response:', response.data);
      
      // Handle array response
      if (Array.isArray(response.data)) {
        console.log(`✅ Fetched ${response.data.length} subcategories (array format)`);
        return response.data;
      }
      
      // Handle paginated response
      const paginatedData = response.data as any;
      if (paginatedData.results && Array.isArray(paginatedData.results)) {
        let allSubCategories = [...paginatedData.results];
        console.log(`✅ Fetched ${allSubCategories.length} subcategories from page 1 (paginated format)`);
        
        // Fetch all remaining pages if paginated
        if (paginatedData.next) {
          let currentPage = 2;
          let hasMore = true;
          
          while (hasMore) {
            try {
              const pageParams = { ...params, page: currentPage };
              const pageResponse = await apiClient.get<{ results: SubCategory[]; next?: string }>('/subcategories/', { 
                params: pageParams 
              });
              const pageData = pageResponse.data;
              
              if (pageData.results && Array.isArray(pageData.results)) {
                allSubCategories = [...allSubCategories, ...pageData.results];
                console.log(`✅ Fetched ${pageData.results.length} subcategories from page ${currentPage}`);
                
                if (pageData.next) {
                  currentPage++;
                } else {
                  hasMore = false;
                }
              } else {
                hasMore = false;
              }
            } catch (error) {
              console.error(`Error fetching subcategories page ${currentPage}:`, error);
              hasMore = false;
            }
          }
        }
        
        console.log(`✅ Total subcategories fetched: ${allSubCategories.length}`);
        return allSubCategories;
      }
      
      console.warn('⚠️ Unexpected subcategories response format:', response.data);
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching subcategories:', error);
      throw error;
    }
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
    const params: any = subcategory ? { subcategory } : {};
    console.log('Fetching features with params:', params);
    
    try {
      const response = await apiClient.get<Feature[] | { results: Feature[]; next?: string }>('/features/', { params });
      console.log('Features API response:', response.data);
      
      // Handle array response
      if (Array.isArray(response.data)) {
        console.log(`✅ Fetched ${response.data.length} features (array format)`);
        return response.data;
      }
      
      // Handle paginated response
      const paginatedData = response.data as any;
      if (paginatedData.results && Array.isArray(paginatedData.results)) {
        let allFeatures = [...paginatedData.results];
        console.log(`✅ Fetched ${allFeatures.length} features from page 1 (paginated format)`);
        
        // Fetch all remaining pages if paginated
        if (paginatedData.next) {
          let currentPage = 2;
          let hasMore = true;
          
          while (hasMore) {
            try {
              const pageParams = { ...params, page: currentPage };
              const pageResponse = await apiClient.get<{ results: Feature[]; next?: string }>('/features/', { 
                params: pageParams 
              });
              const pageData = pageResponse.data;
              
              if (pageData.results && Array.isArray(pageData.results)) {
                allFeatures = [...allFeatures, ...pageData.results];
                console.log(`✅ Fetched ${pageData.results.length} features from page ${currentPage}`);
                
                if (pageData.next) {
                  currentPage++;
                } else {
                  hasMore = false;
                }
              } else {
                hasMore = false;
              }
            } catch (error) {
              console.error(`Error fetching features page ${currentPage}:`, error);
              hasMore = false;
            }
          }
        }
        
        console.log(`✅ Total features fetched: ${allFeatures.length}`);
        return allFeatures;
      }
      
      console.warn('⚠️ Unexpected features response format:', response.data);
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching features:', error);
      throw error;
    }
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
  // Possible feature values endpoints
  listPossibleValues: async (feature?: number): Promise<any[]> => {
    const params: any = feature ? { feature } : {};
    const response = await apiClient.get<any[] | { results: any[]; next?: string }>('/possible-feature-values/', { params });
    const data = response.data as any;
    return Array.isArray(data) ? data : (data.results || []);
  },

  createPossibleValue: async (data: { feature: number; value: string }): Promise<any> => {
    const response = await apiClient.post('/possible-feature-values/', data);
    return response.data;
  },
};

