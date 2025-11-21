import axios, { AxiosInstance, AxiosError } from 'axios';

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
      const url = error.config?.url || '';
      const method = error.config?.method?.toUpperCase() || '';
      console.error(`🔴 API Error: ${method} ${url}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
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

