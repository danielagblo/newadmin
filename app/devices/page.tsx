'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { devicesApi } from '@/lib/api/devices';
import { FCMDevice } from '@/lib/types';
import { format } from 'date-fns';

export default function DevicesPage() {
  const [devices, setDevices] = useState<FCMDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await devicesApi.list();
      setDevices(data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (device: FCMDevice) => {
    try {
      await devicesApi.delete(device.id);
      fetchDevices();
    } catch (error) {
      console.error('Error deleting device:', error);
      window.alert('Failed to delete device');
    }
  };

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'user', header: 'User ID' },
    {
      key: 'token',
      header: 'Token',
      render: (device: FCMDevice) => (
        <div className="max-w-md truncate font-mono text-xs">{device.token}</div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (device: FCMDevice) => format(new Date(device.created_at), 'MMM dd, yyyy HH:mm'),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">FCM Devices</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <DataTable
            data={devices}
            columns={columns}
            onDelete={handleDelete}
            isLoading={loading}
          />
        </div>
      </div>
    </Layout>
  );
}

