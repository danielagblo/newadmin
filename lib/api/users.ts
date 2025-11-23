import apiClient from './config';
import { User, CreateUserForm, UpdateUserForm, PaginatedResponse } from '../types';

export const usersApi = {
  list: async (search?: string): Promise<User[]> => {
    const params: any = {};
    if (search) {
      params.q = search;
      params.search = search; // Try both 'q' and 'search' parameters
    }
    
    // Use the correct endpoint from API docs: https://api.oysloe.com/api/docs/#/
    // Per API documentation, the endpoint is: GET /api-v1/admin/users/
    // Try /admin/users/ first, then fallback to /users/ if empty
    const endpoints = ['/admin/users/', '/users/'];
    let lastError: any = null;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying endpoint: ${endpoint} with params:`, params);
        console.log(`🔗 Full URL: ${apiClient.defaults.baseURL}${endpoint}`);
        const response = await apiClient.get<User[] | PaginatedResponse<User>>(endpoint, { params });
        console.log(`✅ Successfully fetched from ${endpoint}`);
        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Response data type:`, Array.isArray(response.data) ? 'Array' : typeof response.data);
        console.log(`📊 Response data:`, JSON.stringify(response.data, null, 2).substring(0, 500));
        
        const dataLength = Array.isArray(response.data) 
          ? response.data.length 
          : (!Array.isArray(response.data) && response.data && typeof response.data === 'object' && 'results' in response.data)
            ? (response.data as PaginatedResponse<User>).results?.length || 0
            : 'N/A';
        console.log(`📊 Response data length:`, dataLength);
      
      // Log sample of response to help debug
      if (Array.isArray(response.data) && response.data.length > 0) {
        console.log(`📊 Sample user from response:`, response.data[0]);
      } else if (!Array.isArray(response.data) && response.data && typeof response.data === 'object' && 'results' in response.data) {
        const paginatedData = response.data as PaginatedResponse<User>;
        if (Array.isArray(paginatedData.results) && paginatedData.results.length > 0) {
          console.log(`📊 Sample user from paginated response:`, paginatedData.results[0]);
        }
      }
      
        // Handle array response
        if (Array.isArray(response.data)) {
          console.log(`✅ Fetched ${response.data.length} users from ${endpoint} (array format)`);
          
          // If we get a successful response (even if empty), this endpoint works
          // Only try other endpoints if this one fails (error thrown)
          
          // If empty array, accept it as valid (endpoint exists, just no users)
          if (response.data.length === 0) {
            console.log(`✅ ${endpoint} returned empty array - endpoint exists but no users found`);
            return [];
          }
          
          // Validate user objects - be very lenient (accept any object)
          const validUsers = response.data.filter((user: any) => {
            // Accept any non-null object (very lenient validation)
            const isValid = user && typeof user === 'object';
            if (!isValid) {
              console.warn('Invalid user object found (null/undefined):', user);
            }
            return isValid;
          });
          console.log(`✅ Validated ${validUsers.length} valid users out of ${response.data.length}`);
          
          if (validUsers.length === 0 && response.data.length > 0) {
            console.error('❌ All users were filtered out! This should not happen. Sample user:', response.data[0]);
            // Return empty rather than continue, as this endpoint worked but has invalid data
            return [];
          }
          
          return validUsers;
        }
        
        // Handle paginated response
        const paginatedData = response.data as PaginatedResponse<User>;
        if (paginatedData.results && Array.isArray(paginatedData.results)) {
          let allUsers = [...paginatedData.results];
          console.log(`✅ Fetched ${allUsers.length} users from ${endpoint} page 1 (paginated format)`);
          
          // If empty results, try next endpoint
          if (allUsers.length === 0 && (!paginatedData.count || paginatedData.count === 0)) {
            console.log(`⚠️ ${endpoint} returned empty paginated results - trying next endpoint...`);
            continue;
          }
          
          // Validate users - be very lenient (accept any object)
          allUsers = allUsers.filter((user: any) => {
            // Accept any non-null object (very lenient validation)
            const isValid = user && typeof user === 'object';
            if (!isValid) {
              console.warn('Invalid user object found (null/undefined):', user);
            }
            return isValid;
          });
          
          if (allUsers.length === 0 && paginatedData.results && paginatedData.results.length > 0) {
            console.error('❌ All users were filtered out! This should not happen. Sample user:', paginatedData.results[0]);
            // Return empty rather than continue, as this endpoint worked but has invalid data
            return [];
          }
          
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
                  // Validate users from this page - be very lenient (accept any object)
                  const validPageUsers = pageData.results.filter((user: any) => {
                    const isValid = user && typeof user === 'object';
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
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const data = error.response?.data;
        
        console.error(`❌ ${endpoint} failed:`, {
          status,
          statusText,
          message: error.message,
          data: data ? (typeof data === 'string' ? data.substring(0, 100) : JSON.stringify(data).substring(0, 200)) : 'No data'
        });
        
        // Don't retry on auth errors - they'll fail on all endpoints
        if (status === 401) {
          console.error('💡 Authentication failed (401) - please log out and log in again');
          throw new Error('Authentication failed. Please log out and log in again.');
        } else if (status === 403) {
          console.error('💡 Access denied (403) - you may not have permission to view users');
          throw new Error('Access denied. You may not have permission to view users.');
        }
        
        // For 404 or other errors, try next endpoint
        lastError = error;
        continue;
      }
    }
    
    // If all endpoints failed or returned empty
    if (lastError) {
      const status = lastError.response?.status;
      if (status === 404) {
        console.error('💡 All endpoints returned 404');
        console.error('💡 Verify /api-v1/admin/users/ or /api-v1/users/ exists in API docs: https://api.oysloe.com/api/docs/#/');
        throw new Error(`Endpoints not found. Please verify the users endpoint exists in your Django backend. Check API docs: https://api.oysloe.com/api/docs/#/`);
      }
    }
    
    console.warn('⚠️ All endpoints returned empty data or failed');
    console.warn('💡 Users exist in Django admin but API returned no data');
    console.warn('💡 This might indicate:');
    console.warn('   1. Endpoint returns filtered results (only current user)');
    console.warn('   2. Permissions issue - endpoint exists but returns empty');
    console.warn('   3. Wrong endpoint path');
    return [];
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

