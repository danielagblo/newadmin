'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { devicesApi } from '@/lib/api/devices';
import { usersApi } from '@/lib/api/users';
import { FCMDevice } from '@/lib/types';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

export default function DevicesPage() {
  const [devices, setDevices] = useState<FCMDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [newToken, setNewToken] = useState('');
  const [adding, setAdding] = useState(false);
  const [users, setUsers] = useState<{ id: number; email?: string; name?: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | ''>('');

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

  const handleAdd = async () => {
    if (!newToken.trim()) {
      window.alert('Please enter a token');
      return;
    }

    setAdding(true);
    try {
      const payload: { token: string; user_id?: number } = { token: newToken.trim() };
      if (selectedUser !== '') payload.user_id = selectedUser as number;
      console.log('Creating device payload (user_id):', payload);
      const created = await devicesApi.create(payload as any);
      console.log('Created device response:', created);
      // If backend returned a different user than selected, surface a clear error so admin can act.
      if (payload.user_id !== undefined && created.user !== payload.user_id) {
        const msg = `Device was created with user=${created.user} but you requested user=${payload.user_id}. This likely means the backend ignored the provided user id or your token lacks admin permissions.`;
        console.error(msg, { requested: payload.user_id, created: created.user, createdResponse: created });
        // Show a visible alert so the admin notices immediately
        window.alert(msg);
      }
      setNewToken('');
      fetchDevices();
    } catch (error) {
      console.error('Error adding device:', error);
      window.alert('Failed to add device');
    } finally {
      setAdding(false);
    }
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const u = await usersApi.list();
        setUsers(u.map((x) => ({ id: x.id, email: x.email, name: x.name })));
      } catch (err) {
        console.error('Error fetching users for select:', err);
      }
    };

    loadUsers();
  }, []);

  const columns = [
    { key: 'id', header: 'ID' },
    {
      key: 'user',
      header: 'User',
      render: (device: FCMDevice) => {
        const uid = (device as any).user ?? (device as any).user_id ?? null;
        if (!uid) return '-';
        const u = users.find((x) => x.id === uid);
        return u ? `${u.name || u.email || u.id}` : String(uid);
      },
    },
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
          <div className="mb-4">
            <div className="flex gap-3 items-start">
              <div className="w-1/3">
                <Select
                  label="User"
                  options={users.map((u) => ({ value: u.id, label: u.name || u.email || String(u.id) }))}
                  value={selectedUser === '' ? '' : String(selectedUser)}
                  onChange={(e) => setSelectedUser(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
              <div className="flex-1">
                <Input
                  label="FCM Token"
                  placeholder="Enter FCM token"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                />
              </div>
              <div className="pt-6">
                <Button onClick={handleAdd} isLoading={adding} disabled={adding}>
                  Add Device
                </Button>
              </div>
            </div>
          </div>
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

