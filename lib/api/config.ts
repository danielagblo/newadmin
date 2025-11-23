import axios, { AxiosError, AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api-v1';

// Log the API URL in development to help debug
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('API Configuration:', {
    API_URL,
    API_BASE,
    fullURL: `${API_URL}${API_BASE}`,
  });
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}${API_BASE}`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Token ${token}`;
      }
      
      // Log request in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔵 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
          params: config.params,
          hasAuth: !!token,
        });
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => {
    // Log successful response in development
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      const url = response.config.url || '';
      const method = response.config.method?.toUpperCase() || '';
      console.log(`🟢 API Response: ${method} ${url}`, {
        status: response.status,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 
                   (response.data?.results ? response.data.results.length : 'N/A'),
      });
    }
    return response;
  },
  (error: AxiosError) => {
    // Log error response in development
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        try {
          const url = typeof error.config?.url === 'string' ? error.config!.url : '';
          const method = typeof error.config?.method === 'string' ? error.config!.method.toUpperCase() : '';

          // Build a safe, serializable summary string instead of passing potentially
          // complex objects directly to console.error which can throw in some environments.
          let status: string | number | undefined = undefined;
          let statusText: string | undefined = undefined;
          let data: any = undefined;
          try {
            // Access nested properties in a guarded way — protect against getters that may throw
            status = error.response && typeof (error.response as any).status !== 'undefined' ? (error.response as any).status : undefined;
            statusText = error.response && typeof (error.response as any).statusText === 'string' ? (error.response as any).statusText : undefined;
            data = error.response && typeof (error.response as any).data !== 'undefined' ? (error.response as any).data : undefined;
          } catch (_) {
            // ignore any issues accessing nested properties
          }

          const safeStringify = (v: any) => {
            try {
              return JSON.stringify(v);
            } catch (_) {
              try {
                return String(v);
              } catch (__) {
                return '[unserializable]';
              }
            }
          };

          const parts = [`🔴 API Error: ${method} ${url}`];
          if (typeof status !== 'undefined') parts.push(`status=${status}`);
          if (typeof statusText !== 'undefined') parts.push(`statusText=${statusText}`);
          if (typeof data !== 'undefined') parts.push(`data=${safeStringify(data)}`);

          console.error(parts.join(' | '));
        } catch (logErr) {
          try {
            console.error('🔴 API Error (logging failed):', String(logErr));
          } catch (_) {}
        }
      }
    
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

