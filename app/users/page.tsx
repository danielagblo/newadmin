'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { usersApi } from '@/lib/api/users';
import { User } from '@/lib/types';
import { format } from 'date-fns';
import { Plus, Search } from 'lucide-react';
import Image from 'next/image';
import { getImageUrl } from '@/lib/utils';
import React, { useCallback, useEffect, useState } from 'react';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    name: '',
    address: '',
    password: '',
    is_superuser: false,
    is_staff: false,
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔄 Fetching users with search term:', searchTerm || 'none');
      console.log('🔍 API Configuration:', {
        API_URL: process.env.NEXT_PUBLIC_API_URL,
        API_BASE: process.env.NEXT_PUBLIC_API_BASE,
        hasAuthToken: typeof window !== 'undefined' ? !!localStorage.getItem('auth_token') : 'N/A'
      });

      const data = await usersApi.list(searchTerm || undefined);
      console.log('📦 Users fetched from API:', data);
      console.log('📊 Users data type:', typeof data);
      console.log('📊 Is array?', Array.isArray(data));
      console.log('📊 Data length:', Array.isArray(data) ? data.length : 'N/A');

      const usersArray = Array.isArray(data) ? data : [];
      console.log(`✅ Setting ${usersArray.length} users to state`);

      if (usersArray.length > 0) {
        console.log('👤 Sample user:', usersArray[0]);
        console.log('👤 Sample user keys:', Object.keys(usersArray[0]));
      } else {
        console.warn('⚠️ No users in response!');
        console.warn('💡 Check browser Network tab to see the actual API response');
        console.warn('💡 Check browser Console for endpoint errors');
      }

      setUsers(usersArray);

      if (usersArray.length === 0 && !searchTerm) {
        console.warn('⚠️ No users found. Check:');
        console.warn('  1. Browser Network tab - is the API call succeeding?');
        console.warn('  2. Browser Console - any endpoint errors?');
        console.warn('  3. Django admin - do users actually exist?');
        console.warn('  4. Authentication - is auth token valid?');
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
      console.error('Error response:', error?.response);
      console.error('Error status:', error?.response?.status);
      console.error('Error data:', error?.response?.data);

      let errorMessage = 'Failed to fetch users';
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
      setUsers([]);
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
      address: '',
      password: '',
      is_superuser: false,
      is_staff: false,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      phone: user.phone,
      name: user.name,
      address: user.address || '',
      password: '',
      is_superuser: user.is_superuser,
      is_staff: user.is_staff,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (user: User) => {
    try {
      await usersApi.delete(user.id);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      window.alert('Failed to delete user');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, formData);
      } else {
        await usersApi.create(formData as any);
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      window.alert(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await usersApi.toggleActive(user.id, !user.is_active);
      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  const handleVerify = async (user: User) => {
    try {
      await usersApi.verify(user.id, !user.admin_verified);
      fetchUsers();
    } catch (error) {
      console.error('Error verifying user:', error);
    }
  };

  const handleVerifyId = async (user: User) => {
    try {
      await usersApi.verifyId(user.id, !user.id_verified);
      fetchUsers();
    } catch (error) {
      console.error('Error verifying user ID:', error);
    }
  };

  const [isIdModalOpen, setIsIdModalOpen] = useState(false);
  const [selectedIdUser, setSelectedIdUser] = useState<User | null>(null);

  const handleViewId = (user: User) => {
    setSelectedIdUser(user);
    setIsIdModalOpen(true);
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
    },
    {
      key: 'name',
      header: 'Name',
    },
    {
      key: 'email',
      header: 'Email',
    },
    {
      key: 'phone',
      header: 'Phone',
    },
    {
      key: 'level',
      header: 'Level',
      render: (user: User) => (
        <span className={`px-2 py-1 rounded text-xs ${user.level === 'DIAMOND' ? 'bg-purple-100 text-purple-800' :
            user.level === 'GOLD' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
          }`}>
          {user.level}
        </span>
      ),
    },
    {
      key: 'admin_verified',
      header: 'Verified',
      render: (user: User) => (
        <span className={`px-2 py-1 rounded text-xs ${user.admin_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
          {user.admin_verified ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'id_verified',
      header: 'ID Verified',
      render: (user: User) => (
        <span className={`px-2 py-1 rounded text-xs ${user.id_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
          {user.id_verified ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (user: User) => (
        <span className={`px-2 py-1 rounded text-xs ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'is_superuser',
      header: 'Superuser',
      render: (user: User) => (
        <span className={`px-2 py-1 rounded text-xs ${user.is_superuser ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
          }`}>
          {user.is_superuser ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'is_staff',
      header: 'Staff',
      render: (user: User) => (
        <span className={`px-2 py-1 rounded text-xs ${user.is_staff ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
          }`}>
          {user.is_staff ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (user: User) => format(new Date(user.created_at), 'MMM dd, yyyy'),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Users</h3>
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
                placeholder="Search users by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <DataTable
            data={users}
            columns={columns}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={loading}
            actions={(user: User) => (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(user)}
                >
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerify(user)}
                >
                  {user.admin_verified ? 'Unverify' : 'Verify'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewId(user)}
                >
                  View ID
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerifyId(user)}
                >
                  {user.id_verified ? 'Unverify ID' : 'Verify ID'}
                </Button>
              </>
            )}
          />
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingUser ? 'Edit User' : 'Create User'}
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
            <Input
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
            <div className="space-y-2 pt-2">
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
                <span className="text-sm font-medium text-gray-700">Superuser</span>
              </label>
            </div>
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

        {/* ID Preview Modal */}
        <Modal
          isOpen={isIdModalOpen}
          onClose={() => { setIsIdModalOpen(false); setSelectedIdUser(null); }}
          title={selectedIdUser ? `ID for ${selectedIdUser.name}` : 'User ID'}
          size="lg"
        >
          {selectedIdUser ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded p-3">
                <p className="text-sm text-gray-500">National ID Number</p>
                <p className="text-lg font-medium mt-1">{selectedIdUser.id_number || 'Not provided'}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">ID Front</p>
                  {selectedIdUser.id_front_page ? (
                    <div className="relative w-full h-64 bg-gray-100 rounded overflow-hidden">
                      <Image
                        src={getImageUrl(selectedIdUser.id_front_page)}
                        alt={`${selectedIdUser.name} ID front`}
                        fill
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-gray-50 rounded flex items-center justify-center text-gray-400">No front image</div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">ID Back</p>
                  {selectedIdUser.id_back_page ? (
                    <div className="relative w-full h-64 bg-gray-100 rounded overflow-hidden">
                      <Image
                        src={getImageUrl(selectedIdUser.id_back_page)}
                        alt={`${selectedIdUser.name} ID back`}
                        fill
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-gray-50 rounded flex items-center justify-center text-gray-400">No back image</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => { setIsIdModalOpen(false); setSelectedIdUser(null); }}>Close</Button>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </Layout>
  );
}

