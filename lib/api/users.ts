import apiClient from './config';
import { User, CreateUserForm, UpdateUserForm, PaginatedResponse } from '../types';

export const usersApi = {
  list: async (search?: string): Promise<User[]> => {
    const params: any = {};
    if (search) {
      params.q = search;
      params.search = search; // Try both 'q' and 'search' parameters
    }
    
    // Try multiple endpoints
    const endpoints = [
      '/admin/users/',
      '/users/',
      '/admin/user/',
      '/user/',
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying users endpoint: ${endpoint} with params:`, params);
        const response = await apiClient.get<User[] | PaginatedResponse<User>>(endpoint, { params });
        console.log(`✅ Successfully fetched from ${endpoint}:`, response.data);
      
        // Handle array response
        if (Array.isArray(response.data)) {
          console.log(`✅ Fetched ${response.data.length} users from ${endpoint} (array format)`);
          // Validate user objects
          const validUsers = response.data.filter((user: any) => {
            const isValid = user && typeof user === 'object' && (user.id !== undefined || user.email !== undefined);
            if (!isValid) {
              console.warn('Invalid user object found:', user);
            }
            return isValid;
          });
          console.log(`✅ Validated ${validUsers.length} valid users out of ${response.data.length}`);
          return validUsers;
        }
        
        // Handle paginated response
        const paginatedData = response.data as PaginatedResponse<User>;
        if (paginatedData.results && Array.isArray(paginatedData.results)) {
          let allUsers = [...paginatedData.results];
          console.log(`✅ Fetched ${allUsers.length} users from ${endpoint} page 1 (paginated format)`);
          
          // Validate users
          allUsers = allUsers.filter((user: any) => {
            const isValid = user && typeof user === 'object' && (user.id !== undefined || user.email !== undefined);
            if (!isValid) {
              console.warn('Invalid user object found:', user);
            }
            return isValid;
          });
          
          // Fetch all remaining pages if paginated
          if (paginatedData.next) {
            let currentPage = 2;
            let hasMore = true;
            
            while (hasMore) {
              try {
                const pageParams = { ...params, page: currentPage };
                const pageResponse = await apiClient.get<PaginatedResponse<User>>(endpoint, { params: pageParams });
                const pageData = pageResponse.data;
                
                if (pageData.results && Array.isArray(pageData.results)) {
                  // Validate users from this page
                  const validPageUsers = pageData.results.filter((user: any) => {
                    const isValid = user && typeof user === 'object' && (user.id !== undefined || user.email !== undefined);
                    if (!isValid) {
                      console.warn('Invalid user object found on page', currentPage, ':', user);
                    }
                    return isValid;
                  });
                  
                  allUsers = [...allUsers, ...validPageUsers];
                  console.log(`✅ Fetched ${validPageUsers.length} valid users from ${endpoint} page ${currentPage} (${pageData.results.length} total)`);
                  
                  if (pageData.next) {
                    currentPage++;
                  } else {
                    hasMore = false;
                  }
                } else {
                  hasMore = false;
                }
              } catch (error) {
                console.error(`Error fetching ${endpoint} page ${currentPage}:`, error);
                hasMore = false;
              }
            }
          }
          
          console.log(`✅ Total users fetched and validated from ${endpoint}: ${allUsers.length}`);
          if (allUsers.length > 0) {
            console.log('Sample user structure:', {
              id: allUsers[0].id,
              email: allUsers[0].email,
              name: allUsers[0].name,
              is_staff: allUsers[0].is_staff,
              is_superuser: allUsers[0].is_superuser,
            });
          }
          return allUsers;
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
    
    // If all endpoints failed, throw the last error
    console.error('❌ All users endpoints failed');
    throw new Error('Failed to fetch users from all available endpoints');
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

