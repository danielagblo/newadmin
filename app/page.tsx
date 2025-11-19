'use client';

import { Layout } from '@/components/layout/Layout';
import { useAuthStore } from '@/lib/store/auth';
import { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api/users';
import { productsApi } from '@/lib/api/products';
import { User, Product } from '@/lib/types';
import { Users, Package, TrendingUp, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    activeProducts: 0,
    pendingProducts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string>('');

  useEffect(() => {
    // Get API URL from environment
    const apiUrlValue = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || '/api-v1';
    const fullApiUrl = `${apiUrlValue}${apiBase}`;
    setApiUrl(fullApiUrl);

    const fetchStats = async () => {
      try {
        setError(null);
        const [users, products] = await Promise.all([
          usersApi.list(),
          productsApi.list(),
        ]);

        const activeProducts = products.results?.filter(
          (p: Product) => p.status === 'ACTIVE' || p.status === 'VERIFIED'
        ).length || 0;

        const pendingProducts = products.results?.filter(
          (p: Product) => p.status === 'PENDING'
        ).length || 0;

        setStats({
          totalUsers: users.length,
          totalProducts: products.results?.length || 0,
          activeProducts,
          pendingProducts,
        });
      } catch (error: any) {
        console.error('Error fetching stats:', error);
        const errorMessage = error?.response?.status === 401
          ? 'Authentication failed. Please log out and log in again.'
          : error?.response?.status === 404
          ? `API endpoint not found. Check if API URL is correct: ${fullApiUrl}`
          : error?.message || 'Failed to fetch data from API';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'bg-green-500',
    },
    {
      title: 'Active Products',
      value: stats.activeProducts,
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
    {
      title: 'Pending Products',
      value: stats.pendingProducts,
      icon: AlertCircle,
      color: 'bg-yellow-500',
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Welcome back, {user?.name}!</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">API Connection Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <div className="mt-2 text-xs text-red-600">
                  <p>Current API URL: <code className="bg-red-100 px-1 rounded">{apiUrl}</code></p>
                  <p className="mt-1">If you&apos;re switching from localhost to production, please:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Clear your browser&apos;s localStorage (or log out and log in again)</li>
                    <li>Make sure environment variables are set in your deployment platform</li>
                    <li>Check the browser console for more details</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm">
              <p className="font-medium text-blue-800">Debug Info (Development Only)</p>
              <p className="mt-1 text-blue-700">
                API URL: <code className="bg-blue-100 px-1 rounded">{apiUrl}</code>
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <div
                key={stat.title}
                className="bg-white rounded-lg shadow p-6"
              >
                <div className="flex items-center">
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

