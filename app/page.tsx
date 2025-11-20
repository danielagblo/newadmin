'use client';

import { Layout } from '@/components/layout/Layout';
import { useAuthStore } from '@/lib/store/auth';
import { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api/users';
import { productsApi } from '@/lib/api/products';
import { chatRoomsApi } from '@/lib/api/chats';
import { alertsApi } from '@/lib/api/alerts';
import { categoriesApi } from '@/lib/api/categories';
import { subscriptionsApi } from '@/lib/api/subscriptions';
import { reviewsApi } from '@/lib/api/reviews';
import { feedbackApi } from '@/lib/api/feedback';
import { User, Product, ChatRoom, Alert } from '@/lib/types';
import { 
  Users, Package, TrendingUp, AlertCircle, MessageSquare, 
  Bell, Eye, UserCheck, Calendar, CreditCard, Star, MessageCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    appViewers: 0,
    newUsersToday: 0,
    newUsersThisWeek: 0,
    newUsersThisMonth: 0,
    totalProducts: 0,
    activeProducts: 0,
    pendingProducts: 0,
    totalChatRooms: 0,
    totalAlerts: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    totalReviews: 0,
    averageRating: 0,
    totalFeedback: 0,
    pendingFeedback: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string>('');
  
  // Chart data states
  const [userLevelData, setUserLevelData] = useState<any[]>([]);
  const [userVerificationData, setUserVerificationData] = useState<any[]>([]);
  const [productStatusData, setProductStatusData] = useState<any[]>([]);
  const [userGrowthData, setUserGrowthData] = useState<any[]>([]);
  const [chatroomTypeData, setChatroomTypeData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [userActivityData, setUserActivityData] = useState<any[]>([]);
  const [dailyActiveUsersData, setDailyActiveUsersData] = useState<any[]>([]);
  const [userRegistrationData, setUserRegistrationData] = useState<any[]>([]);

  useEffect(() => {
    const apiUrlValue = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || '/api-v1';
    const fullApiUrl = `${apiUrlValue}${apiBase}`;
    setApiUrl(fullApiUrl);

    const fetchStats = async () => {
      try {
        setError(null);
        // Fetch all data with error handling - won't break if endpoints don't exist
        const [users, productsResponse, chatRooms, alerts, categories, subscriptions, reviews, feedback] = await Promise.all([
          usersApi.list().catch((e) => { console.warn('Users API error:', e); return []; }),
          productsApi.list().catch((e) => { console.warn('Products API error:', e); return { results: [], count: 0 }; }),
          chatRoomsApi.list().catch((e) => { console.warn('ChatRooms API error:', e); return []; }),
          alertsApi.list().catch((e) => { console.warn('Alerts API error:', e); return []; }),
          categoriesApi.list().catch((e) => { console.warn('Categories API error:', e); return []; }),
          subscriptionsApi.list().catch((e) => { console.warn('Subscriptions API error:', e); return []; }),
          reviewsApi.list().catch((e) => { console.warn('Reviews API error:', e); return []; }),
          feedbackApi.list().catch((e) => { console.warn('Feedback API error:', e); return []; }),
        ]);

        const usersArray = Array.isArray(users) ? users : [];
        const chatRoomsArray = Array.isArray(chatRooms) ? chatRooms : [];
        const alertsArray = Array.isArray(alerts) ? alerts : [];
        const categoriesArray = Array.isArray(categories) ? categories : [];
        const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
        const reviewsArray = Array.isArray(reviews) ? reviews : [];
        const feedbackArray = Array.isArray(feedback) ? feedback : [];

        // Handle products - fetch all pages if paginated
        let productsArray: Product[] = [];
        let totalProductsCount = 0;
        
        if (Array.isArray(productsResponse)) {
          // If it's already an array, use it directly
          productsArray = productsResponse;
          totalProductsCount = productsResponse.length;
          console.log('Products: Array response, total:', totalProductsCount);
        } else {
          // It's a paginated response
          totalProductsCount = productsResponse.count || 0;
          productsArray = productsResponse.results || [];
          console.log('Products: Paginated response, total count:', totalProductsCount, 'first page:', productsArray.length);
          
          // Fetch all pages to get accurate counts for active/pending
          // Check if it has 'next' property (PaginatedResponse) before accessing
          if ('next' in productsResponse && productsResponse.next) {
            let currentPage = 2;
            let hasMore = true;
            const allProducts: Product[] = [...productsArray];
            
            while (hasMore && currentPage <= 50) { // Limit to 50 pages to avoid infinite loops
              try {
                const nextPage = await productsApi.list({ page: currentPage });
                if (nextPage.results && nextPage.results.length > 0) {
                  allProducts.push(...nextPage.results);
                  hasMore = !!nextPage.next;
                  currentPage++;
                } else {
                  hasMore = false;
                }
              } catch (error) {
                console.error(`Error fetching products page ${currentPage}:`, error);
                hasMore = false;
              }
            }
            productsArray = allProducts;
            console.log('Products: Fetched all pages, total products:', productsArray.length);
          }
        }

        // Calculate basic stats
        const activeProducts = productsArray.filter(
          (p: Product) => p.status === 'ACTIVE' || p.status === 'VERIFIED'
        ).length;

        const pendingProducts = productsArray.filter(
          (p: Product) => p.status === 'PENDING'
        ).length;

        // User statistics
        const activeUsers = usersArray.filter((u: User) => u.is_active).length;
        const appViewers = usersArray.filter((u: User) => u.created_from_app || u.is_active).length;
        
        // New users calculations
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        const newUsersToday = usersArray.filter((u: User) => {
          const userDate = new Date(u.created_at);
          return userDate >= today;
        }).length;

        const newUsersThisWeek = usersArray.filter((u: User) => {
          const userDate = new Date(u.created_at);
          return userDate >= weekAgo;
        }).length;

        const newUsersThisMonth = usersArray.filter((u: User) => {
          const userDate = new Date(u.created_at);
          return userDate >= monthAgo;
        }).length;

        // Subscription statistics
        const activeSubscriptions = subscriptionsArray.filter((s: any) => s.is_active).length;

        // Review statistics
        const averageRating = reviewsArray.length > 0
          ? reviewsArray.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviewsArray.length
          : 0;

        // Feedback statistics
        const pendingFeedback = feedbackArray.filter((f: any) => f.status === 'PENDING').length;

        setStats({
          totalUsers: usersArray.length,
          activeUsers,
          appViewers,
          newUsersToday,
          newUsersThisWeek,
          newUsersThisMonth,
          totalProducts: totalProductsCount || productsArray.length,
          activeProducts,
          pendingProducts,
          totalChatRooms: chatRoomsArray.length,
          totalAlerts: alertsArray.length,
          totalSubscriptions: subscriptionsArray.length,
          activeSubscriptions,
          totalReviews: reviewsArray.length,
          averageRating: Math.round(averageRating * 10) / 10,
          totalFeedback: feedbackArray.length,
          pendingFeedback,
        });

        // User Level Distribution
        const levelCounts = {
          DIAMOND: 0,
          GOLD: 0,
          SILVER: 0,
        };
        usersArray.forEach((u: User) => {
          if (levelCounts[u.level as keyof typeof levelCounts] !== undefined) {
            levelCounts[u.level as keyof typeof levelCounts]++;
          }
        });
        setUserLevelData([
          { name: 'Diamond', value: levelCounts.DIAMOND, color: '#8b5cf6' },
          { name: 'Gold', value: levelCounts.GOLD, color: '#f59e0b' },
          { name: 'Silver', value: levelCounts.SILVER, color: '#6b7280' },
        ]);

        // User Verification Status
        const verifiedCount = usersArray.filter((u: User) => u.admin_verified).length;
        const unverifiedCount = usersArray.length - verifiedCount;
        setUserVerificationData([
          { name: 'Verified', value: verifiedCount, color: '#10b981' },
          { name: 'Unverified', value: unverifiedCount, color: '#ef4444' },
        ]);

        // Product Status Distribution
        const statusCounts: Record<string, number> = {};
        productsArray.forEach((p: Product) => {
          statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
        });
        setProductStatusData(
          Object.entries(statusCounts).map(([name, value]) => ({
            name,
            value,
          }))
        );

        // User Growth Over Time (last 12 months)
        const monthsData = Array.from({ length: 12 }, (_, i) => {
          const date = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
          const monthName = date.toLocaleDateString('en-US', { month: 'short' });
          const usersInMonth = usersArray.filter((u: User) => {
            const userDate = new Date(u.created_at);
            return (
              userDate.getFullYear() === date.getFullYear() &&
              userDate.getMonth() === date.getMonth()
            );
          }).length;
          return { month: monthName, users: usersInMonth };
        });
        setUserGrowthData(monthsData);

        // Chatroom Type Distribution
        const groupChats = chatRoomsArray.filter((r: ChatRoom) => r.is_group).length;
        const directChats = chatRoomsArray.length - groupChats;
        setChatroomTypeData([
          { name: 'Group Chats', value: groupChats, color: '#3b82f6' },
          { name: 'Direct Chats', value: directChats, color: '#10b981' },
        ]);

        // Top Categories by Product Count
        const categoryCounts: Record<string, number> = {};
        productsArray.forEach((p: Product) => {
          if (p.category) {
            const catId = String(p.category);
            categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;
          }
        });
        const topCategories = Object.entries(categoryCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([id, count]) => {
            const category = categoriesArray.find((c: any) => c.id === parseInt(id));
            return {
              name: category?.name || `Category ${id}`,
              products: count,
            };
          });
        setCategoryData(topCategories);

        // User Activity (Active vs Inactive)
        const inactiveUsers = usersArray.length - activeUsers;
        setUserActivityData([
          { name: 'Active', value: activeUsers, color: '#10b981' },
          { name: 'Inactive', value: inactiveUsers, color: '#ef4444' },
        ]);

        // Daily Active Users (last 30 days) - estimated from user activity
        const currentDate = new Date();
        const dailyActiveData = Array.from({ length: 30 }, (_, i) => {
          const date = new Date(currentDate);
          date.setDate(date.getDate() - (29 - i));
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          // Estimate: users who were active around this date (created or updated)
          const activeOnDate = usersArray.filter((u: User) => {
            const created = new Date(u.created_at);
            const updated = u.updated_at ? new Date(u.updated_at) : created;
            const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            return (
              (created <= checkDate && u.is_active) ||
              (updated >= checkDate && updated <= new Date(checkDate.getTime() + 86400000))
            );
          }).length;
          
          return { date: dateStr, users: activeOnDate };
        });
        setDailyActiveUsersData(dailyActiveData);

        // User Registration by Day (last 30 days)
        const registrationData = Array.from({ length: 30 }, (_, i) => {
          const date = new Date(currentDate);
          date.setDate(date.getDate() - (29 - i));
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          const registeredOnDate = usersArray.filter((u: User) => {
            const created = new Date(u.created_at);
            return (
              created.getFullYear() === date.getFullYear() &&
              created.getMonth() === date.getMonth() &&
              created.getDate() === date.getDate()
            );
          }).length;
          
          return { date: dateStr, registrations: registeredOnDate };
        });
        setUserRegistrationData(registrationData);
      } catch (error: any) {
        console.error('Error fetching stats:', error);
        const apiUrlValue = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || '/api-v1';
        const fullApiUrl = `${apiUrlValue}${apiBase}`;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'Active Users',
      value: stats.activeUsers,
      icon: UserCheck,
      color: 'bg-green-500',
    },
    {
      title: 'App Viewers',
      value: stats.appViewers,
      icon: Eye,
      color: 'bg-teal-500',
    },
    {
      title: 'New Users (Today)',
      value: stats.newUsersToday,
      icon: Calendar,
      color: 'bg-cyan-500',
    },
    {
      title: 'New Users (This Week)',
      value: stats.newUsersThisWeek,
      icon: Calendar,
      color: 'bg-blue-400',
    },
    {
      title: 'New Users (This Month)',
      value: stats.newUsersThisMonth,
      icon: Calendar,
      color: 'bg-indigo-500',
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
    {
      title: 'Chat Rooms',
      value: stats.totalChatRooms,
      icon: MessageSquare,
      color: 'bg-indigo-500',
    },
    {
      title: 'Alerts',
      value: stats.totalAlerts,
      icon: Bell,
      color: 'bg-pink-500',
    },
    {
      title: 'Subscriptions',
      value: stats.totalSubscriptions,
      icon: CreditCard,
      color: 'bg-violet-500',
      subtitle: `${stats.activeSubscriptions} active`,
    },
    {
      title: 'Reviews',
      value: stats.totalReviews,
      icon: Star,
      color: 'bg-amber-500',
      subtitle: stats.averageRating > 0 ? `Avg: ${stats.averageRating}⭐` : '',
    },
    {
      title: 'Feedback',
      value: stats.totalFeedback,
      icon: MessageCircle,
      color: 'bg-orange-500',
      subtitle: stats.pendingFeedback > 0 ? `${stats.pendingFeedback} pending` : '',
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
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {statCards.map((stat) => (
                <div
                  key={stat.title}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex items-center">
                    <div className={`${stat.color} p-3 rounded-lg`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-600">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {stat.value}
                      </p>
                      {stat.subtitle && (
                        <p className="text-xs text-gray-500 mt-1">
                          {stat.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Growth Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth (Last 12 Months)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={userGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} name="New Users" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* User Level Distribution */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Level Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={userLevelData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {userLevelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* User Verification Status */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Verification Status</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={userVerificationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {userVerificationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Product Status Distribution */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Status Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productStatusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* User Activity */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Activity Status</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={userActivityData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {userActivityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Chatroom Type Distribution */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Chatroom Types</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chatroomTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chatroomTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Top Categories */}
              {categoryData.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories by Products</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="products" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Daily Active Users */}
              {dailyActiveUsersData.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Active Users (Last 30 Days)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyActiveUsersData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="users" stroke="#10b981" strokeWidth={2} name="Active Users" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* User Registration Trend */}
              {userRegistrationData.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">User Registration Trend (Last 30 Days)</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={userRegistrationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="registrations" fill="#3b82f6" name="New Registrations" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
