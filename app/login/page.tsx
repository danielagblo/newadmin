'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { authApi } from '@/lib/api/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoginForm } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuthStore();
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || '/api-v1';
      const fullUrl = `${apiUrl}${apiBase}/adminlogin/`;
      
      console.log('Attempting login to:', fullUrl);
      console.log('Email:', formData.email);
      
      const response = await authApi.adminLogin(formData);
      setAuth(response.user, response.token);
      router.push('/');
    } catch (err: any) {
      console.error('Login error:', err);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      let errorMessage = 'Invalid credentials. Please try again.';
      let errorDetails = '';
      
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || '/api-v1';
        errorMessage = `Cannot connect to API at ${apiUrl}${apiBase}`;
        errorDetails = `Please check:
- Is your Django backend running?
- Is the API URL correct in .env.local?
- Are there any CORS issues?
- Check browser console (F12) for more details`;
      } else if (err.response?.status === 404) {
        errorMessage = `API endpoint not found (404)`;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || '/api-v1';
        const fullUrl = `${apiUrl}${apiBase}/adminlogin/`;
        errorDetails = `The endpoint ${fullUrl} does not exist. Check if:
- The backend is running
- The endpoint path is correct
- The API base path matches your Django configuration`;
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication failed (401)';
        const responseData = err.response?.data;
        errorDetails = responseData?.error_message ||
          responseData?.detail ||
          responseData?.message ||
          responseData?.non_field_errors?.[0] ||
          'Invalid email or password. Please check your credentials.';
        
        // Show full response if available
        if (responseData && Object.keys(responseData).length > 0) {
          errorDetails += `\n\nResponse: ${JSON.stringify(responseData, null, 2)}`;
        }
      } else if (err.response?.status === 403) {
        errorMessage = 'Access denied (403)';
        errorDetails = 'Your account may not have admin privileges. Ensure your user has is_staff=True or is_superuser=True.';
      } else if (err.response?.status === 400) {
        errorMessage = 'Bad request (400)';
        const responseData = err.response?.data;
        errorDetails = responseData?.error_message ||
          responseData?.detail ||
          responseData?.message ||
          JSON.stringify(responseData, null, 2);
      } else if (err.response?.data) {
        errorMessage = `Error (${err.response?.status || 'Unknown'})`;
        const responseData = err.response.data;
        errorDetails = responseData.error_message ||
          responseData.detail ||
          responseData.message ||
          JSON.stringify(responseData, null, 2);
      } else if (err.message) {
        errorMessage = 'Login failed';
        errorDetails = err.message;
      }
      
      setError(`${errorMessage}${errorDetails ? '\n\n' + errorDetails : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Admin Panel
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Oysloe Marketplace Admin
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded whitespace-pre-line">
              <p className="font-semibold mb-2">Login Failed</p>
              <div className="text-sm space-y-1">
                {error.split('\n\n').map((part, idx) => (
                  <p key={idx} className={idx === 0 ? 'font-medium' : 'text-xs font-mono bg-red-100 p-2 rounded mt-2 overflow-auto max-h-40'}>{part}</p>
                ))}
              </div>
              <p className="text-xs mt-3 text-red-600">
                💡 Tip: Open browser console (F12) to see detailed error logs
              </p>
            </div>
          )}
          
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
              <p className="font-semibold mb-1">Debug Info</p>
              <p>API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}</p>
              <p>API Base: {process.env.NEXT_PUBLIC_API_BASE || '/api-v1'}</p>
              <p className="mt-2 text-xs">
                Full URL: {(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + (process.env.NEXT_PUBLIC_API_BASE || '/api-v1') + '/adminlogin/'}
              </p>
            </div>
          )}
          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
            <Input
              label="Password"
              type="password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
            disabled={isLoading}
          >
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}

