import apiClient from './config';

export interface LegalContent {
  id?: number;
  content: string;
  type: 'terms' | 'privacy';
  updated_at?: string;
  created_at?: string;
}

export const legalApi = {
  getTerms: async (): Promise<string> => {
    // Try multiple endpoint variations
    const endpoints = [
      '/terms-and-conditions/'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.get<LegalContent | { content: string }>(endpoint);
        
        // Handle different response formats
        if (response.data) {
          if (typeof response.data === 'string') {
            return response.data;
          }
          if (typeof response.data === 'object') {
            // Check if it has a content property
            if ('content' in response.data && typeof response.data.content === 'string') {
              return response.data.content;
            }
            // If the response is an array, get the first item
            if (Array.isArray(response.data) && response.data.length > 0) {
              const firstItem = response.data[0] as any;
              return firstItem.content || firstItem.text || '';
            }
          }
        }
        
        // If we got a successful response but no content, try next endpoint
        if (response.status === 200) {
          continue;
        }
      } catch (error: any) {
        // If 404, try next endpoint
        if (error.response?.status === 404) {
          continue;
        }
        // For other errors, throw them
        throw error;
      }
    }
    
    // If all endpoints failed, return empty string
    console.warn('No terms and conditions endpoint found. Please check API documentation.');
    return '';
  },

  updateTerms: async (content: string): Promise<LegalContent> => {
    // Try to discover an existing resource ID (some APIs require PUT to /terms-and-conditions/{id}/)
    let existingId: number | string | undefined;
    const discoveryEndpoints = [
      '/terms-and-conditions/',
    ];

    for (const ep of discoveryEndpoints) {
      try {
        const resp = await apiClient.get<any>(ep);
        const d = resp.data;
        if (!d) continue;

        if (Array.isArray(d) && d.length > 0) {
          const first = d[0] as any;
          if (first && (first.id || first.pk)) {
            existingId = first.id ?? first.pk;
            break;
          }
        } else if (typeof d === 'object') {
          if (typeof (d as any).id !== 'undefined') {
            existingId = (d as any).id;
            break;
          }
          if (Array.isArray((d as any).results) && (d as any).results.length > 0) {
            const first = (d as any).results[0];
            if (first && (first.id || first.pk)) {
              existingId = first.id ?? first.pk;
              break;
            }
          }
        }
      } catch (e: any) {
        if (e.response?.status === 404) continue;
        // ignore discovery errors and try next endpoint
        continue;
      }
    }

    // Try multiple endpoint variations. If we discovered an ID, include the terms-and-conditions/{id}/ PUT.
    const endpoints: Array<{ url: string; method: 'PUT' | 'POST'; data?: any }> = [
      { url: '/terms-and-conditions/', method: 'PUT' },
      { url: '/terms-and-conditions/', method: 'POST' },
    ];

    // If we found an existing ID, try the specific resource endpoint first
    if (existingId) {
      endpoints.unshift({ url: `/terms-and-conditions/${existingId}/`, method: 'PUT' });
      endpoints.unshift({ url: `/terms-and-conditions/${existingId}/`, method: 'POST' });
    }

    for (const endpoint of endpoints) {
      try {
        const payload = endpoint.data || { content };
        const response = endpoint.method === 'PUT'
          ? await apiClient.put<LegalContent>(endpoint.url, payload)
          : await apiClient.post<LegalContent>(endpoint.url, payload);

        return response.data;
      } catch (error: any) {
        // If 404 or 405, try next endpoint
        if ([404, 405].includes(error.response?.status || 0)) {
          continue;
        }
        // For other errors, throw them
        throw error;
      }
    }

    throw new Error('No valid terms and conditions update endpoint found. Please check API documentation.');
  },

  getPrivacy: async (): Promise<string> => {
    // Try multiple endpoint variations
    const endpoints = [
      '/admin/privacy/',
      '/privacy/',
      '/admin/privacy-policy/',
      '/privacy-policy/',
      '/admin/legal-content/?type=privacy',
      '/legal-content/?type=privacy',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.get<LegalContent | { content: string }>(endpoint);
        
        // Handle different response formats
        if (response.data) {
          if (typeof response.data === 'string') {
            return response.data;
          }
          if (typeof response.data === 'object') {
            // Check if it has a content property
            if ('content' in response.data && typeof response.data.content === 'string') {
              return response.data.content;
            }
            // If the response is an array, get the first item
            if (Array.isArray(response.data) && response.data.length > 0) {
              const firstItem = response.data[0] as any;
              return firstItem.content || firstItem.text || '';
            }
          }
        }
        
        // If we got a successful response but no content, try next endpoint
        if (response.status === 200) {
          continue;
        }
      } catch (error: any) {
        // If 404, try next endpoint
        if (error.response?.status === 404) {
          continue;
        }
        // For other errors, throw them
        throw error;
      }
    }
    
    // If all endpoints failed, return empty string
    console.warn('No privacy policy endpoint found. Please check API documentation.');
    return '';
  },

  updatePrivacy: async (content: string): Promise<LegalContent> => {
    // Try multiple endpoint variations
    const endpoints = [
      { url: '/admin/privacy/', method: 'PUT' as const },
      { url: '/admin/privacy/', method: 'POST' as const },
      { url: '/privacy/', method: 'PUT' as const },
      { url: '/privacy/', method: 'POST' as const },
      { url: '/admin/privacy-policy/', method: 'PUT' as const },
      { url: '/admin/privacy-policy/', method: 'POST' as const },
      { url: '/admin/legal-content/', method: 'PUT' as const, data: { type: 'privacy', content } },
      { url: '/admin/legal-content/', method: 'POST' as const, data: { type: 'privacy', content } },
    ];

    for (const endpoint of endpoints) {
      try {
        const payload = endpoint.data || { content };
        const response = endpoint.method === 'PUT' 
          ? await apiClient.put<LegalContent>(endpoint.url, payload)
          : await apiClient.post<LegalContent>(endpoint.url, payload);
        
        return response.data;
      } catch (error: any) {
        // If 404 or 405, try next endpoint
        if ([404, 405].includes(error.response?.status || 0)) {
          continue;
        }
        // For other errors, throw them
        throw error;
      }
    }
    
    throw new Error('No valid privacy policy update endpoint found. Please check API documentation.');
  },

  // New: CRUD helpers for /terms-and-conditions/ resource
  listTerms: async (): Promise<LegalContent[]> => {
    try {
      const resp = await apiClient.get<LegalContent[]>('/terms-and-conditions/');
      if (Array.isArray(resp.data)) return resp.data;
      // If API returns paginated shape
      if (resp.data && (resp.data as any).results) return (resp.data as any).results as LegalContent[];
      return [];
    } catch (error: any) {
      if (error.response?.status === 404) return [];
      throw error;
    }
  },

  createTerm: async (payload: Partial<LegalContent>): Promise<LegalContent> => {
    const resp = await apiClient.post<LegalContent>('/terms-and-conditions/', payload);
    return resp.data;
  },

  getTermById: async (id: number | string): Promise<LegalContent> => {
    const resp = await apiClient.get<LegalContent>(`/terms-and-conditions/${id}/`);
    return resp.data;
  },

  updateTermById: async (id: number | string, payload: Partial<LegalContent>): Promise<LegalContent> => {
    const resp = await apiClient.put<LegalContent>(`/terms-and-conditions/${id}/`, payload);
    return resp.data;
  },

  patchTermById: async (id: number | string, payload: Partial<LegalContent>): Promise<LegalContent> => {
    const resp = await apiClient.patch<LegalContent>(`/terms-and-conditions/${id}/`, payload);
    return resp.data;
  },

  deleteTermById: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/terms-and-conditions/${id}/`);
  },
  // CRUD helpers for privacy policies (resource-style endpoints)
  listPrivacy: async (): Promise<LegalContent[]> => {
    const candidates = ['/privacy-policies/', '/privacy-policy/', '/privacy/'];
    for (const url of candidates) {
      try {
        const resp = await apiClient.get<any>(url);
        if (!resp.data) continue;
        if (Array.isArray(resp.data)) return resp.data as LegalContent[];
        if (resp.data.results && Array.isArray(resp.data.results)) return resp.data.results as LegalContent[];
        // if single object, wrap into array
        if (typeof resp.data === 'object') return [resp.data as LegalContent];
      } catch (e: any) {
        if (e.response?.status === 404) continue;
        throw e;
      }
    }
    return [];
  },

  createPrivacy: async (payload: Partial<LegalContent>): Promise<LegalContent> => {
    // prefer plural resource
    try {
      const resp = await apiClient.post<LegalContent>('/privacy-policies/', payload);
      return resp.data;
    } catch (e: any) {
      // fallback to singular
      const resp = await apiClient.post<LegalContent>('/privacy-policy/', payload);
      return resp.data;
    }
  },

  getPrivacyById: async (id: number | string): Promise<LegalContent> => {
    const resp = await apiClient.get<LegalContent>(`/privacy-policies/${id}/`);
    return resp.data;
  },

  updatePrivacyById: async (id: number | string, payload: Partial<LegalContent>): Promise<LegalContent> => {
    const resp = await apiClient.put<LegalContent>(`/privacy-policies/${id}/`, payload);
    return resp.data;
  },

  patchPrivacyById: async (id: number | string, payload: Partial<LegalContent>): Promise<LegalContent> => {
    const resp = await apiClient.patch<LegalContent>(`/privacy-policies/${id}/`, payload);
    return resp.data;
  },

  deletePrivacyById: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/privacy-policies/${id}/`);
  },
};

