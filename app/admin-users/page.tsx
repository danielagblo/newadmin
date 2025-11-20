'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { usersApi } from '@/lib/api/users';
import { User } from '@/lib/types';
import { format } from 'date-fns';
import { Plus, Search, Shield, UserCheck, UserX, Settings } from 'lucide-react';

interface AdminAccessLimits {
  can_manage_users: boolean;
  can_manage_products: boolean;
  can_manage_categories: boolean;
  can_manage_locations: boolean;
  can_manage_coupons: boolean;
  can_manage_subscriptions: boolean;
  can_manage_reviews: boolean;
  can_manage_chatrooms: boolean;
  can_manage_alerts: boolean;
  can_manage_devices: boolean;
  max_daily_operations?: number;
  max_users_per_day?: number;
  max_products_per_day?: number;
}

export default function AdminUsersPage() {
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    name: '',
    password: '',
    is_superuser: false,
    is_staff: false,
  });
  const [accessLimits, setAccessLimits] = useState<AdminAccessLimits>({
    can_manage_users: false,
    can_manage_products: false,
    can_manage_categories: false,
    can_manage_locations: false,
    can_manage_coupons: false,
    can_manage_subscriptions: false,
    can_manage_reviews: false,
    can_manage_chatrooms: false,
    can_manage_alerts: false,
    can_manage_devices: false,
    max_daily_operations: undefined,
    max_users_per_day: undefined,
    max_products_per_day: undefined,
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.list(searchTerm || undefined);
      console.log('Users fetched:', data);
      const usersArray = Array.isArray(data) ? data : [];
      setAllUsers(usersArray);
      // Filter to show only admin users (staff or superuser)
      const admins = usersArray.filter((u: User) => u.is_staff || u.is_superuser);
      setAdminUsers(admins);
      console.log(`Found ${admins.length} admin users out of ${usersArray.length} total users`);
    } catch (error: any) {
      console.error('Error fetching admin users:', error);
      console.error('Error response:', error?.response);
      console.error('Error status:', error?.response?.status);
      
      let errorMessage = 'Failed to fetch admin users';
      let errorDetails = '';
      
      if (error?.response?.status === 404) {
        errorMessage = 'Users endpoint not found (404)';
        errorDetails = `The users API endpoint does not exist on your Django backend.\n\n` +
          `Expected endpoint: /api-v1/admin/users/\n\n` +
          `Please check if the endpoint exists in your Django backend.`;
      } else if (error?.response?.status === 401) {
        errorMessage = 'Authentication failed (401)';
        errorDetails = 'Please log out and log in again.';
      } else if (error?.response?.status === 403) {
        errorMessage = 'Access denied (403)';
        errorDetails = 'You may not have permission to view users.';
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
      setAllUsers([]);
      setAdminUsers([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      phone: '',
      name: '',
      password: '',
      is_superuser: false,
      is_staff: false,
    });
    setAccessLimits({
      can_manage_users: false,
      can_manage_products: false,
      can_manage_categories: false,
      can_manage_locations: false,
      can_manage_coupons: false,
      can_manage_subscriptions: false,
      can_manage_reviews: false,
      can_manage_chatrooms: false,
      can_manage_alerts: false,
      can_manage_devices: false,
      max_daily_operations: undefined,
      max_users_per_day: undefined,
      max_products_per_day: undefined,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      phone: user.phone,
      name: user.name,
      password: '',
      is_superuser: user.is_superuser,
      is_staff: user.is_staff,
    });
    // In a real app, you'd fetch access limits from the backend
    // For now, we'll use defaults
    setAccessLimits({
      can_manage_users: true,
      can_manage_products: true,
      can_manage_categories: true,
      can_manage_locations: true,
      can_manage_coupons: true,
      can_manage_subscriptions: true,
      can_manage_reviews: true,
      can_manage_chatrooms: true,
      can_manage_alerts: true,
      can_manage_devices: true,
      max_daily_operations: undefined,
      max_users_per_day: undefined,
      max_products_per_day: undefined,
    });
    setIsModalOpen(true);
  };

  const handleToggleStaff = async (user: User) => {
    try {
      await usersApi.update(user.id, {
        is_staff: !user.is_staff,
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error toggling staff status:', error);
      window.alert(error?.response?.data?.detail || 'Failed to update staff status');
    }
  };

  const handleToggleSuperuser = async (user: User) => {
    try {
      await usersApi.update(user.id, {
        is_superuser: !user.is_superuser,
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error toggling superuser status:', error);
      window.alert(error?.response?.data?.detail || 'Failed to update superuser status');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userData: any = {
        ...formData,
        is_staff: true, // Admin users must be staff
      };
      
      if (editingUser) {
        await usersApi.update(editingUser.id, userData);
        // In a real app, you'd also update access limits via a separate API
        // await adminAccessApi.update(editingUser.id, accessLimits);
      } else {
        if (!formData.password) {
          window.alert('Password is required for new admin users');
          return;
        }
        await usersApi.create(userData as any);
        // In a real app, you'd also create access limits via a separate API
        // await adminAccessApi.create(newUser.id, accessLimits);
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving admin user:', error);
      window.alert(error?.response?.data?.detail || 'Failed to save admin user');
    }
  };

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    {
      key: 'is_superuser',
      header: 'Superuser',
      render: (user: User) => (
        <span className={`px-2 py-1 rounded text-xs ${
          user.is_superuser ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {user.is_superuser ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'is_staff',
      header: 'Staff',
      render: (user: User) => (
        <span className={`px-2 py-1 rounded text-xs ${
          user.is_staff ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {user.is_staff ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (user: User) => (
        <span className={`px-2 py-1 rounded text-xs ${
          user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (user: User) => format(new Date(user.created_at), 'MMM dd, yyyy'),
    },
  ];

  const accessSections = [
    { key: 'can_manage_users', label: 'Manage Users' },
    { key: 'can_manage_products', label: 'Manage Products' },
    { key: 'can_manage_categories', label: 'Manage Categories' },
    { key: 'can_manage_locations', label: 'Manage Locations' },
    { key: 'can_manage_coupons', label: 'Manage Coupons' },
    { key: 'can_manage_subscriptions', label: 'Manage Subscriptions' },
    { key: 'can_manage_reviews', label: 'Manage Reviews' },
    { key: 'can_manage_chatrooms', label: 'Manage Chat Rooms' },
    { key: 'can_manage_alerts', label: 'Manage Alerts' },
    { key: 'can_manage_devices', label: 'Manage Devices' },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin User Management</h1>
            <p className="mt-2 text-gray-600">Manage admin access and permissions</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Admin User
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Admin Users</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={() => fetchUsers()}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search admin users by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-600">
            Total admin users: {adminUsers.length} (showing staff and superusers only)
          </div>

          <DataTable
            data={adminUsers}
            columns={columns}
            onEdit={handleEdit}
            isLoading={loading}
            actions={(user: User) => (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleStaff(user)}
                  title={user.is_staff ? 'Remove Staff Access' : 'Grant Staff Access'}
                >
                  {user.is_staff ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleSuperuser(user)}
                  title={user.is_superuser ? 'Remove Superuser' : 'Grant Superuser'}
                >
                  <Shield className="h-4 w-4" />
                </Button>
              </>
            )}
          />
        </div>

        {/* Create/Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingUser ? 'Edit Admin User' : 'Create Admin User'}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="Phone"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            {!editingUser && (
              <Input
                label="Password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            )}
            {editingUser && (
              <Input
                label="New Password (leave blank to keep current)"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            )}

            <div className="space-y-2 pt-2 border-t">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_staff}
                  onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Staff Member</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_superuser}
                  onChange={(e) => setFormData({ ...formData, is_superuser: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700">Superuser (Full Access)</span>
              </label>
            </div>

            {/* Access Limits Section */}
            {!formData.is_superuser && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Access Limits
                </h3>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Section Access:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {accessSections.map((section) => (
                      <label key={section.key} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={accessLimits[section.key as keyof AdminAccessLimits] as boolean}
                          onChange={(e) => setAccessLimits({
                            ...accessLimits,
                            [section.key]: e.target.checked,
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{section.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2">
                  <Input
                    label="Max Daily Operations"
                    type="number"
                    value={accessLimits.max_daily_operations || ''}
                    onChange={(e) => setAccessLimits({
                      ...accessLimits,
                      max_daily_operations: e.target.value ? parseInt(e.target.value) : undefined,
                    })}
                    placeholder="Unlimited"
                  />
                  <Input
                    label="Max Users/Day"
                    type="number"
                    value={accessLimits.max_users_per_day || ''}
                    onChange={(e) => setAccessLimits({
                      ...accessLimits,
                      max_users_per_day: e.target.value ? parseInt(e.target.value) : undefined,
                    })}
                    placeholder="Unlimited"
                  />
                  <Input
                    label="Max Products/Day"
                    type="number"
                    value={accessLimits.max_products_per_day || ''}
                    onChange={(e) => setAccessLimits({
                      ...accessLimits,
                      max_products_per_day: e.target.value ? parseInt(e.target.value) : undefined,
                    })}
                    placeholder="Unlimited"
                  />
                </div>
              </div>
            )}

            {formData.is_superuser && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-800">
                  <strong>Note:</strong> Superusers have full access to all sections and no operation limits.
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}

