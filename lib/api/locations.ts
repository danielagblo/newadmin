import apiClient from './config';
import { Location, CreateLocationForm } from '../types';

export const locationsApi = {
  list: async (params?: { region?: string; name?: string; search?: string }): Promise<Location[]> => {
    try {
      console.log('=== LOCATIONS API CALL START ===');
      console.log('API Base URL:', apiClient.defaults.baseURL);
      console.log('Request params:', params);
      console.log('Auth token present:', typeof window !== 'undefined' ? !!localStorage.getItem('auth_token') : 'N/A');
      
      const response = await apiClient.get<Location[] | { results: Location[]; count?: number; next?: string; previous?: string }>('/locations/', { 
        params: params || {},
        paramsSerializer: {
          indexes: null, // Don't use array notation
        }
      });
      
      console.log('=== LOCATIONS API RESPONSE ===');
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data type:', Array.isArray(response.data) ? 'Array' : 'Object');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
      // Handle both array and paginated responses
      if (Array.isArray(response.data)) {
        console.log(`✓ Fetched ${response.data.length} locations (array response)`);
        response.data.forEach((loc, idx) => {
          console.log(`  [${idx + 1}] ID: ${loc.id}, Name: ${loc.name}, Region: ${loc.region}, Active: ${loc.is_active}`);
        });
        return response.data;
      }
      
      // Handle paginated response
      const paginatedData = response.data as any;
      let allLocations: Location[] = paginatedData.results || [];
      console.log(`✓ Fetched ${allLocations.length} locations from first page (paginated response)`);
      console.log(`Total count: ${paginatedData.count || 'unknown'}`);
      console.log(`Has next page: ${!!paginatedData.next}`);
      
      if (allLocations.length > 0) {
        allLocations.forEach((loc, idx) => {
          console.log(`  [${idx + 1}] ID: ${loc.id}, Name: ${loc.name}, Region: ${loc.region}, Active: ${loc.is_active}`);
        });
      }
      
      // If there are more pages, fetch them all
      if (paginatedData.next) {
        let nextUrl = paginatedData.next;
        let pageNum = 2;
        while (nextUrl) {
          try {
            console.log(`Fetching page ${pageNum}...`);
            // Extract the path from the full URL
            const url = new URL(nextUrl);
            const path = url.pathname + url.search;
            console.log(`Next page URL: ${path}`);
            const nextResponse = await apiClient.get<{ results: Location[]; next?: string }>(path);
            const nextData = nextResponse.data as any;
            if (nextData.results && Array.isArray(nextData.results)) {
              allLocations = [...allLocations, ...nextData.results];
              console.log(`✓ Fetched ${nextData.results.length} more locations from page ${pageNum}. Total: ${allLocations.length}`);
              nextData.results.forEach((loc: Location, idx: number) => {
                console.log(`  [${allLocations.length - nextData.results.length + idx + 1}] ID: ${loc.id}, Name: ${loc.name}, Region: ${loc.region}, Active: ${loc.is_active}`);
              });
            }
            nextUrl = nextData.next || null;
            pageNum++;
          } catch (error: any) {
            console.error(`Error fetching page ${pageNum} of locations:`, error);
            console.error('Error details:', error.response?.data || error.message);
            break;
          }
        }
      }
      
      console.log(`=== TOTAL LOCATIONS FETCHED: ${allLocations.length} ===`);
      return allLocations;
    } catch (error: any) {
      console.error('=== LOCATIONS API ERROR ===');
      console.error('Error object:', error);
      console.error('Error response:', error?.response);
      console.error('Error status:', error?.response?.status);
      console.error('Error data:', error?.response?.data);
      console.error('Error message:', error?.message);
      throw error;
    }
  },

  get: async (id: number): Promise<Location> => {
    const response = await apiClient.get<Location>(`/locations/${id}/`);
    return response.data;
  },

  create: async (data: CreateLocationForm): Promise<Location> => {
    const response = await apiClient.post<Location>('/locations/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<CreateLocationForm>): Promise<Location> => {
    const response = await apiClient.put<Location>(`/locations/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/locations/${id}/`);
  },
};

