'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { alertsApi } from '@/lib/api/alerts';
import { usersApi } from '@/lib/api/users';
import { Alert, User } from '@/lib/types';
import { format } from 'date-fns';
import { Plus, Send, RefreshCw } from 'lucide-react';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [sending, setSending] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    body: '',
    kind: '',
    userIds: [] as number[], // Changed to array for multiple selection
    sendToAll: false,
  });

  useEffect(() => {
    fetchAlerts();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await alertsApi.list();
      console.log('Alerts fetched:', data);
      console.log('Number of alerts:', Array.isArray(data) ? data.length : 0);
      const alertsArray = Array.isArray(data) ? data : [];
      console.log('Alerts data structure:', alertsArray.length > 0 ? {
        firstAlert: alertsArray[0],
        userField: alertsArray[0]?.user,
        userType: typeof alertsArray[0]?.user,
      } : 'No alerts');
      
      setAlerts(alertsArray);
      
      if (alertsArray.length === 0) {
        console.warn('⚠️ No alerts found. If you added alerts in Django admin, they might not be showing because:');
        console.warn('1. The endpoint is returning filtered results (only current user\'s alerts)');
        console.warn('2. The endpoint path is incorrect');
        console.warn('3. The alerts need to be fetched from a different endpoint');
        console.warn('Check the browser console to see which endpoint was successfully used.');
      } else {
        console.log(`✅ Loaded ${alertsArray.length} alerts. Sample:`, alertsArray.slice(0, 3));
        console.log('If you see fewer alerts than in Django admin, the endpoint might be filtering by user.');
      }
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      console.error('Error response:', error?.response);
      console.error('Error status:', error?.response?.status);
      
      let errorMessage = 'Failed to fetch alerts';
      let errorDetails = '';
      
      if (error?.response?.status === 404) {
        errorMessage = 'Alerts endpoint not found (404)';
        errorDetails = `The alerts API endpoint does not exist on your Django backend.\n\n` +
          `Tried endpoints:\n` +
          `- /api-v1/admin/alerts/\n` +
          `- /api-v1/alerts/\n` +
          `- /notifications/alerts/\n\n` +
          `Possible solutions:\n` +
          `1. Check if the alerts endpoint exists in your Django backend\n` +
          `2. Verify the endpoint path in your Django URLs configuration\n` +
          `3. The endpoint might be named differently (e.g., /notifications/, /messages/)\n` +
          `4. Check your Django API documentation at https://api.oysloe.com/api/docs/`;
      } else if (error?.response?.status === 401) {
        errorMessage = 'Authentication failed (401)';
        errorDetails = 'Please log out and log in again.';
      } else if (error?.response?.status === 403) {
        errorMessage = 'Access denied (403)';
        errorDetails = 'You may not have permission to view alerts.';
      } else if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
        errorMessage = 'Network error';
        errorDetails = 'Cannot connect to the API. Please check your connection.';
      } else if (error?.response?.data) {
        errorMessage = 'API Error';
        errorDetails = error.response.data.detail || 
                      error.response.data.error_message || 
                      error.response.data.message ||
                      JSON.stringify(error.response.data);
      } else if (error?.message) {
        errorMessage = 'Error';
        errorDetails = error.message;
      }
      
      setError(`${errorMessage}\n\n${errorDetails}`);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (alert: Alert) => {
    try {
      await alertsApi.markRead(alert.id);
      fetchAlerts();
    } catch (error: any) {
      console.error('Error marking alert as read:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to mark alert as read';
      window.alert(errorMsg);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await alertsApi.markAllRead();
      fetchAlerts();
    } catch (error: any) {
      console.error('Error marking all alerts as read:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to mark all alerts as read';
      window.alert(errorMsg);
    }
  };

  const handleDelete = async (alert: Alert) => {
    try {
      await alertsApi.delete(alert.id);
      fetchAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
      window.alert('Failed to delete alert');
    }
  };

  const handleOpenSendModal = () => {
    setNotificationForm({
      title: '',
      body: '',
      kind: '',
      userIds: [],
      sendToAll: false,
    });
    setIsSendModalOpen(true);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const baseAlertData: any = {
        title: notificationForm.title,
        body: notificationForm.body,
      };

      if (notificationForm.kind) {
        baseAlertData.kind = notificationForm.kind;
      }

      // Send to all users or specific users
      if (notificationForm.sendToAll) {
        // Send to all users (no user field)
        await alertsApi.create(baseAlertData);
      } else if (notificationForm.userIds.length > 0) {
        // Send to multiple selected users
        const promises = notificationForm.userIds.map(userId => {
          return alertsApi.create({
            ...baseAlertData,
            user: userId,
          });
        });
        await Promise.all(promises);
      } else {
        window.alert('Please select at least one user or choose "All Users"');
        setSending(false);
        return;
      }

      setIsSendModalOpen(false);
      setNotificationForm({
        title: '',
        body: '',
        kind: '',
        userIds: [],
        sendToAll: false,
      });
      fetchAlerts();
      const userCount = notificationForm.sendToAll 
        ? 'all users' 
        : `${notificationForm.userIds.length} user(s)`;
      window.alert(`Push notification sent successfully to ${userCount}!`);
    } catch (error: any) {
      console.error('Error sending notification:', error);
      console.error('Error response:', error?.response);
      
      let errorMsg = 'Failed to send notification';
      let errorDetails = '';
      
      if (error?.response?.status === 405) {
        errorMsg = 'Method POST not allowed';
        const allowedMethods = error?.response?.headers?.['allow'];
        errorDetails = `The endpoint exists but doesn't accept POST requests.\n\n` +
          `Allowed methods: ${allowedMethods || 'Unknown'}\n\n` +
          `⚠️ The REST API endpoint for creating alerts may not exist in your Django backend.\n` +
          `Django admin uses /admin/notifications/alert/add/ which is the admin UI, not the REST API.\n\n` +
          `💡 Solution: You need to create a REST API endpoint in your Django backend for sending notifications.\n` +
          `   Suggested endpoint: POST /api-v1/admin/notifications/alert/ or POST /api-v1/alerts/\n\n` +
          `💡 For now, you can create notifications using Django admin, and they will appear in this panel.`;
      } else if (error?.response?.status === 404) {
        errorMsg = 'Notification endpoint not found (404)';
        errorDetails = 'Please check if the endpoint exists in your Django backend.';
      } else if (error?.response?.status === 401) {
        errorMsg = 'Authentication failed (401)';
        errorDetails = 'Please log out and log in again.';
      } else if (error?.response?.status === 403) {
        errorMsg = 'Access denied (403)';
        errorDetails = 'You may not have permission to send notifications.';
      } else if (error?.response?.data) {
        errorMsg = 'API Error';
        errorDetails = error.response.data.detail || 
                      error.response.data.error_message || 
                      error.response.data.message ||
                      JSON.stringify(error.response.data);
      } else if (error?.message) {
        errorMsg = 'Error';
        errorDetails = error.message;
      }
      
      // Show detailed error in alert
      const fullErrorMsg = errorDetails ? `${errorMsg}\n\n${errorDetails}` : errorMsg;
      window.alert(fullErrorMsg);
    } finally {
      setSending(false);
    }
  };

  const columns = [
    { key: 'id', header: 'ID' },
    {
      key: 'user',
      header: 'Recipient',
      render: (alert: Alert) => {
        // Handle user as object
        if (alert.user && typeof alert.user === 'object' && 'name' in alert.user) {
          const userObj = alert.user as User;
          return (
            <div className="text-sm">
              <div className="font-medium">{userObj.name || 'Unknown'}</div>
              <div className="text-gray-500 text-xs">{userObj.email || ''}</div>
            </div>
          );
        }
        // Handle user as ID (number)
        if (alert.user && typeof alert.user === 'number') {
          const userId = alert.user;
          const user = users.find(u => u.id === userId);
          if (user) {
            return (
              <div className="text-sm">
                <div className="font-medium">{user.name}</div>
                <div className="text-gray-500 text-xs">{user.email}</div>
              </div>
            );
          }
          return <span className="text-gray-500">User ID: {userId}</span>;
        }
        // No user specified = sent to all users
        return <span className="text-blue-600 font-medium">All Users</span>;
      },
    },
    { key: 'title', header: 'Title' },
    {
      key: 'body',
      header: 'Message',
      render: (alert: Alert) => (
        <div className="max-w-lg">
          <div className="line-clamp-2 text-sm">{alert.body}</div>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Kind',
      render: (alert: Alert) => alert.kind || '-',
    },
    {
      key: 'is_read',
      header: 'Status',
      render: (alert: Alert) => (
        <span className={`px-2 py-1 rounded text-xs ${
          alert.is_read ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {alert.is_read ? 'Read' : 'Unread'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (alert: Alert) => format(new Date(alert.created_at), 'MMM dd, yyyy HH:mm'),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Push Notifications</h1>
          <div className="flex gap-2">
            <Button onClick={handleOpenSendModal}>
              <Plus className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
            <Button onClick={fetchAlerts} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleMarkAllRead} variant="outline">
              Mark All Read
            </Button>
          </div>
        </div>

        {/* Info banner if alerts are loading successfully but create might not work */}
        {!error && alerts.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> If the &quot;Send Notification&quot; button doesn&apos;t work, 
                  the REST API endpoint for creating alerts may not exist. 
                  You can create notifications in Django admin and they will appear here.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Alerts</h3>
                <div className="mt-2 text-sm text-red-700 whitespace-pre-line space-y-2">
                  {error.split('\n\n').map((part, idx) => (
                    <div key={idx} className={idx === 0 ? 'font-semibold' : 'text-xs bg-red-100 p-3 rounded mt-2'}>
                      {part}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={fetchAlerts}
                    className="px-4 py-2 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 transition w-fit"
                  >
                    Try again
                  </button>
                  <div className="text-xs text-red-600 space-y-1">
                    <p>💡 <strong>Check browser console (F12)</strong> to see which endpoints were tried</p>
                    <p>📚 <strong>Check API docs:</strong> <a href="https://api.oysloe.com/api/docs/" target="_blank" rel="noopener noreferrer" className="underline">https://api.oysloe.com/api/docs/</a></p>
                    <p>⚠️ <strong>If endpoint doesn&apos;t exist:</strong> You may need to create the alerts endpoint in your Django backend</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          {!error && (
            <div className="mb-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Total alerts: {alerts.length} | Unread: {alerts.filter(a => !a.is_read).length}
              </div>
              {alerts.length === 0 && (
                <div className="text-xs text-gray-500">
                  💡 Check browser console (F12) to see which endpoint was used
                </div>
              )}
            </div>
          )}
          <DataTable
            data={alerts}
            columns={columns}
            onDelete={handleDelete}
            isLoading={loading}
            actions={(alert: Alert) => (
              !alert.is_read && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMarkRead(alert)}
                >
                  Mark Read
                </Button>
              )
            )}
          />
        </div>

        {/* Send Notification Modal */}
        <Modal
          isOpen={isSendModalOpen}
          onClose={() => setIsSendModalOpen(false)}
          title="Send Push Notification"
          size="lg"
        >
          <form onSubmit={handleSendNotification} className="space-y-4">
            <Input
              label="Title"
              required
              value={notificationForm.title}
              onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
              placeholder="Notification title"
            />

            <Textarea
              label="Message"
              required
              value={notificationForm.body}
              onChange={(e) => setNotificationForm({ ...notificationForm, body: e.target.value })}
              placeholder="Notification message/body"
              rows={4}
            />

            <Input
              label="Kind (Optional)"
              value={notificationForm.kind}
              onChange={(e) => setNotificationForm({ ...notificationForm, kind: e.target.value })}
              placeholder="e.g., info, warning, success, error"
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Send To
              </label>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={notificationForm.sendToAll}
                    onChange={(e) => {
                      setNotificationForm({
                        ...notificationForm,
                        sendToAll: e.target.checked,
                        userIds: e.target.checked ? [] : notificationForm.userIds,
                      });
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">All Users</span>
                </label>

                {!notificationForm.sendToAll && (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg p-4">
                    {(() => {
                      // Group users by verification status and new users
                      const now = new Date();
                      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      
                      // Verified users who have submitted ads (active_ads > 0 OR taken_ads > 0)
                      const verifiedWithAds = users.filter(u => 
                        u.admin_verified && 
                        new Date(u.created_at) <= thirtyDaysAgo &&
                        ((u.active_ads && u.active_ads > 0) || (u.taken_ads && u.taken_ads > 0))
                      );
                      
                      // Verified users who haven't submitted any ads
                      const verifiedNoAds = users.filter(u => 
                        u.admin_verified && 
                        new Date(u.created_at) <= thirtyDaysAgo &&
                        (!u.active_ads || u.active_ads === 0) &&
                        (!u.taken_ads || u.taken_ads === 0)
                      );
                      
                      const unverifiedUsers = users.filter(u => !u.admin_verified && new Date(u.created_at) <= thirtyDaysAgo);
                      const newUsers = users.filter(u => new Date(u.created_at) > thirtyDaysAgo);
                      const inactiveUsers = users.filter(u => !u.is_active);
                      
                      // User Level Groups
                      const diamondUsers = users.filter(u => u.level === 'DIAMOND' && u.is_active);
                      const goldUsers = users.filter(u => u.level === 'GOLD' && u.is_active);
                      const silverUsers = users.filter(u => u.level === 'SILVER' && u.is_active);
                      
                      // Business Users
                      const businessUsers = users.filter(u => u.business_name && u.business_name.trim() !== '' && u.is_active);
                      
                      // Phone/Email Verified
                      const phoneVerifiedUsers = users.filter(u => u.phone_verified && u.is_active);
                      const emailVerifiedUsers = users.filter(u => u.email_verified && u.is_active);
                      const fullyVerifiedUsers = users.filter(u => u.phone_verified && u.email_verified && u.is_active);
                      
                      // Staff/Admin Users
                      const staffUsers = users.filter(u => (u.is_staff || u.is_superuser) && u.is_active);
                      
                      // App Users
                      const appUsers = users.filter(u => u.created_from_app && u.is_active);
                      
                      // Users with Referral Activity
                      const usersWithReferrals = users.filter(u => u.referral_points > 0 && u.is_active);
                      
                      // Top 100 Users with Most Active Ads
                      const topActiveAdsUsers = users
                        .filter(u => u.is_active && u.active_ads && u.active_ads > 0)
                        .sort((a, b) => (b.active_ads || 0) - (a.active_ads || 0))
                        .slice(0, 100);
                      
                      const toggleGroup = (groupUserIds: number[]) => {
                        const allSelected = groupUserIds.every(id => notificationForm.userIds.includes(id));
                        if (allSelected) {
                          // Deselect all in group
                          setNotificationForm({
                            ...notificationForm,
                            userIds: notificationForm.userIds.filter(id => !groupUserIds.includes(id)),
                          });
                        } else {
                          // Select all in group
                          setNotificationForm({
                            ...notificationForm,
                            userIds: Array.from(new Set([...notificationForm.userIds, ...groupUserIds])),
                          });
                        }
                      };
                      
                      const toggleUser = (userId: number) => {
                        if (notificationForm.userIds.includes(userId)) {
                          setNotificationForm({
                            ...notificationForm,
                            userIds: notificationForm.userIds.filter(id => id !== userId),
                          });
                        } else {
                          setNotificationForm({
                            ...notificationForm,
                            userIds: [...notificationForm.userIds, userId],
                          });
                        }
                      };
                      
                      return (
                        <>
                          {/* Verified Users with Ads */}
                          {verifiedWithAds.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={verifiedWithAds.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(verifiedWithAds.map(u => u.id))}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm font-semibold text-blue-700">
                                    Verified Users with Ads ({verifiedWithAds.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {verifiedWithAds.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Verified Users without Ads */}
                          {verifiedNoAds.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={verifiedNoAds.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(verifiedNoAds.map(u => u.id))}
                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  />
                                  <span className="text-sm font-semibold text-purple-700">
                                    Verified Users (No Ads) ({verifiedNoAds.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {verifiedNoAds.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Unverified Users */}
                          {unverifiedUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={unverifiedUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(unverifiedUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm font-semibold text-gray-700">
                                    Unverified Users ({unverifiedUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {unverifiedUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* New Users */}
                          {newUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={newUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(newUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <span className="text-sm font-semibold text-green-700">
                                    New Users (Last 30 days) ({newUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {newUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                      {user.admin_verified && (
                                        <span className="ml-2 text-xs text-blue-600">✓ Verified</span>
                                      )}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Inactive Users */}
                          {inactiveUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={inactiveUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(inactiveUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                  />
                                  <span className="text-sm font-semibold text-red-700">
                                    Inactive Users ({inactiveUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {inactiveUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* User Level Groups */}
                          {diamondUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={diamondUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(diamondUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  />
                                  <span className="text-sm font-semibold text-purple-700">
                                    💎 Diamond Level Users ({diamondUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {diamondUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {goldUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={goldUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(goldUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                                  />
                                  <span className="text-sm font-semibold text-yellow-700">
                                    🥇 Gold Level Users ({goldUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {goldUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {silverUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={silverUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(silverUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                                  />
                                  <span className="text-sm font-semibold text-gray-700">
                                    🥈 Silver Level Users ({silverUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {silverUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Business Users */}
                          {businessUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={businessUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(businessUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-sm font-semibold text-indigo-700">
                                    🏢 Business Users ({businessUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {businessUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.business_name}) - {user.email}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Fully Verified Users */}
                          {fullyVerifiedUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={fullyVerifiedUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(fullyVerifiedUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <span className="text-sm font-semibold text-green-700">
                                    ✓ Fully Verified (Phone + Email) ({fullyVerifiedUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {fullyVerifiedUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Phone Verified Users */}
                          {phoneVerifiedUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={phoneVerifiedUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(phoneVerifiedUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                  />
                                  <span className="text-sm font-semibold text-teal-700">
                                    📱 Phone Verified Users ({phoneVerifiedUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {phoneVerifiedUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Email Verified Users */}
                          {emailVerifiedUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={emailVerifiedUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(emailVerifiedUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                  />
                                  <span className="text-sm font-semibold text-cyan-700">
                                    ✉️ Email Verified Users ({emailVerifiedUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {emailVerifiedUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Staff/Admin Users */}
                          {staffUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={staffUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(staffUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                  />
                                  <span className="text-sm font-semibold text-orange-700">
                                    👥 Staff/Admin Users ({staffUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {staffUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                      {user.is_superuser && <span className="ml-2 text-xs text-purple-600">Superuser</span>}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* App Users */}
                          {appUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={appUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(appUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                                  />
                                  <span className="text-sm font-semibold text-pink-700">
                                    📱 App Users ({appUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {appUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Users with Referrals */}
                          {usersWithReferrals.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={usersWithReferrals.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(usersWithReferrals.map(u => u.id))}
                                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="text-sm font-semibold text-amber-700">
                                    🎁 Users with Referral Activity ({usersWithReferrals.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {usersWithReferrals.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email}) - {user.referral_points} points
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Top 100 Users with Most Active Ads */}
                          {topActiveAdsUsers.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={topActiveAdsUsers.every(u => notificationForm.userIds.includes(u.id))}
                                    onChange={() => toggleGroup(topActiveAdsUsers.map(u => u.id))}
                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="text-sm font-semibold text-emerald-700">
                                    🏆 Top 100 Users with Most Active Ads ({topActiveAdsUsers.length})
                                  </span>
                                </label>
                              </div>
                              <div className="pl-6 space-y-1">
                                {topActiveAdsUsers.map((user) => (
                                  <label key={user.id} className="flex items-center space-x-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={notificationForm.userIds.includes(user.id)}
                                      onChange={() => toggleUser(user.id)}
                                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {user.name} ({user.email}) - {user.active_ads || 0} active ads
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {notificationForm.userIds.length > 0 && (
                            <div className="pt-2 border-t border-gray-200">
                              <p className="text-sm font-medium text-gray-700">
                                {notificationForm.userIds.length} user(s) selected
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSendModalOpen(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={sending} isLoading={sending}>
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}

