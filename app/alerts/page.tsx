'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { alertsApi } from '@/lib/api/alerts';
import { Alert } from '@/lib/types';
import { format } from 'date-fns';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await alertsApi.list();
      console.log('Alerts fetched:', data);
      setAlerts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to fetch alerts';
      setError(errorMessage);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (alert: Alert) => {
    try {
      await alertsApi.markRead(alert.id);
      fetchAlerts();
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await alertsApi.markAllRead();
      fetchAlerts();
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
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

  const columns = [
    { key: 'id', header: 'ID' },
    {
      key: 'user',
      header: 'User',
      render: (alert: Alert) => alert.user ? `${alert.user.name} (${alert.user.email})` : '-',
    },
    { key: 'title', header: 'Title' },
    {
      key: 'body',
      header: 'Body',
      render: (alert: Alert) => (
        <div className="max-w-md truncate">{alert.body}</div>
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
          <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
          <Button onClick={handleMarkAllRead}>
            Mark All Read
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Alerts</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={fetchAlerts}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
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
      </div>
    </Layout>
  );
}

