'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
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
    userId: '' as string | number,
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
        console.warn('No alerts found. If you added alerts in Django admin, check if the endpoint is correct.');
      } else {
        console.log(`✅ Loaded ${alertsArray.length} alerts. Sample:`, alertsArray.slice(0, 3));
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
      userId: '',
    });
    setIsSendModalOpen(true);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const alertData: any = {
        title: notificationForm.title,
        body: notificationForm.body,
      };

      if (notificationForm.kind) {
        alertData.kind = notificationForm.kind;
      }

      if (notificationForm.userId && notificationForm.userId !== 'all') {
        alertData.user = parseInt(notificationForm.userId as string);
      }

      await alertsApi.create(alertData);
      setIsSendModalOpen(false);
      setNotificationForm({
        title: '',
        body: '',
        kind: '',
        userId: '',
      });
      fetchAlerts();
      window.alert('Push notification sent successfully!');
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
          `💡 Tip: Check your browser console (F12) to see which endpoints were tried.\n` +
          `💡 Tip: Check Django admin network tab to see what endpoint it uses when sending notifications.`;
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
        if (alert.user && typeof alert.user === 'object') {
          return (
            <div className="text-sm">
              <div className="font-medium">{alert.user.name || 'Unknown'}</div>
              <div className="text-gray-500 text-xs">{alert.user.email || ''}</div>
            </div>
          );
        }
        // Handle user as ID (number)
        if (alert.user && typeof alert.user === 'number') {
          const user = users.find(u => u.id === alert.user);
          if (user) {
            return (
              <div className="text-sm">
                <div className="font-medium">{user.name}</div>
                <div className="text-gray-500 text-xs">{user.email}</div>
              </div>
            );
          }
          return <span className="text-gray-500">User ID: {alert.user}</span>;
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
            <div className="mb-4 text-sm text-gray-600">
              Total alerts: {alerts.length} | Unread: {alerts.filter(a => !a.is_read).length}
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

            <Select
              label="Send To"
              value={notificationForm.userId}
              onChange={(e) => setNotificationForm({ ...notificationForm, userId: e.target.value })}
              options={[
                { value: 'all', label: 'All Users' },
                ...users.map((user) => ({
                  value: user.id.toString(),
                  label: `${user.name} (${user.email})`,
                })),
              ]}
            />

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

