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
      '/admin/terms/',
      '/terms/',
      '/admin/legal-content/?type=terms',
      '/legal-content/?type=terms',
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
    // Try multiple endpoint variations
    const endpoints = [
      { url: '/admin/terms/', method: 'PUT' as const },
      { url: '/admin/terms/', method: 'POST' as const },
      { url: '/terms/', method: 'PUT' as const },
      { url: '/terms/', method: 'POST' as const },
      { url: '/admin/legal-content/', method: 'PUT' as const, data: { type: 'terms', content } },
      { url: '/admin/legal-content/', method: 'POST' as const, data: { type: 'terms', content } },
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
};

