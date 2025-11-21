'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { chatRoomsApi } from '@/lib/api/chats';
import { usersApi } from '@/lib/api/users';
import { ChatRoom, Message, User } from '@/lib/types';
import { format } from 'date-fns';
import { Plus, MessageSquare, RefreshCw, Search } from 'lucide-react';

export default function ChatRoomsPage() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMessagesModalOpen, setIsMessagesModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ChatRoom | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    is_group: false,
    members: [] as number[],
  });

  useEffect(() => {
    fetchChatRooms();
    fetchUsers();
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchChatRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        ordering: '-created_at', // Order by newest first
      };
      
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      const data = await chatRoomsApi.list(params);
      setChatRooms(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error fetching chat rooms:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to fetch chat rooms';
      setError(errorMessage);
      setChatRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (roomId: number) => {
    setLoadingMessages(true);
    try {
      const data = await chatRoomsApi.getMessages(roomId);
      setMessages(data);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleCreate = () => {
    setEditingRoom(null);
    setFormData({
      name: '',
      is_group: false,
      members: [],
    });
    setIsModalOpen(true);
  };

  const handleEdit = (room: ChatRoom) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      is_group: room.is_group,
      members: room.members?.map(m => typeof m === 'object' ? m.id : m) || [],
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (room: ChatRoom) => {
    if (!window.confirm(`Are you sure you want to delete chat room "${room.name}"?`)) {
      return;
    }
    try {
      await chatRoomsApi.delete(room.id);
      fetchChatRooms();
    } catch (error: any) {
      console.error('Error deleting chat room:', error);
      window.alert(error.response?.data?.detail || 'Failed to delete chat room');
    }
  };

  const handleViewMessages = async (room: ChatRoom) => {
    setSelectedRoom(room);
    setIsMessagesModalOpen(true);
    await fetchMessages(room.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await chatRoomsApi.update(editingRoom.id, formData);
      } else {
        await chatRoomsApi.create(formData);
      }
      setIsModalOpen(false);
      fetchChatRooms();
    } catch (error: any) {
      console.error('Error saving chat room:', error);
      window.alert(error.response?.data?.detail || 'Failed to save chat room');
    }
  };

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { key: 'room_id', header: 'Room ID' },
    {
      key: 'is_group',
      header: 'Type',
      render: (room: ChatRoom) => (
        <span className={`px-2 py-1 rounded text-xs ${
          room.is_group ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {room.is_group ? 'Group' : 'Direct'}
        </span>
      ),
    },
    {
      key: 'members',
      header: 'Members',
      render: (room: ChatRoom) => {
        if (!room.members || room.members.length === 0) {
          return <span className="text-gray-500 text-sm">No members</span>;
        }
        const memberList = room.members.slice(0, 3).map((m: User | number) => {
          if (typeof m === 'object') {
            return m.name || m.email || 'Unknown';
          }
          const user = users.find(u => u.id === m);
          return user?.name || user?.email || `User ${m}`;
        });
        const remaining = room.members.length - 3;
        return (
          <div className="text-sm">
            <div>{memberList.join(', ')}</div>
            {remaining > 0 && (
              <div className="text-gray-500 text-xs">+{remaining} more</div>
            )}
          </div>
        );
      },
    },
    {
      key: 'total_unread',
      header: 'Unread',
      render: (room: ChatRoom) => (
        <span className={`px-2 py-1 rounded text-xs ${
          (room.total_unread || 0) > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {room.total_unread || 0}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (room: ChatRoom) => format(new Date(room.created_at), 'MMM dd, yyyy'),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Chat Rooms</h1>
          <div className="flex gap-2">
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Chat Room
            </Button>
            <Button onClick={fetchChatRooms} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Chat Rooms</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={fetchChatRooms}
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
            <div className="mb-4 flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search chat rooms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-gray-600">
                Total: {chatRooms.length} chat room{chatRooms.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
          <DataTable
            data={chatRooms}
            columns={columns}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={loading}
            actions={(room: ChatRoom) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewMessages(room)}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                View Messages
              </Button>
            )}
          />
        </div>

        {/* Create/Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingRoom ? 'Edit Chat Room' : 'Create Chat Room'}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Chat room name"
            />

            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_group}
                  onChange={(e) => setFormData({ ...formData, is_group: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Group Chat</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Members {formData.is_group ? '(Select multiple)' : '(Select 2 for direct chat)'}
              </label>
              <div className="space-y-4 max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg p-4">
                {(() => {
                  // Group users by verification status and other criteria
                  const now = new Date();
                  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  
                  // Verified users who have submitted ads
                  const verifiedWithAds = users.filter(u => 
                    u.admin_verified && 
                    new Date(u.created_at) <= thirtyDaysAgo &&
                    u.is_active &&
                    ((u.active_ads && u.active_ads > 0) || (u.taken_ads && u.taken_ads > 0))
                  );
                  
                  // Verified users who haven't submitted any ads
                  const verifiedNoAds = users.filter(u => 
                    u.admin_verified && 
                    new Date(u.created_at) <= thirtyDaysAgo &&
                    u.is_active &&
                    (!u.active_ads || u.active_ads === 0) &&
                    (!u.taken_ads || u.taken_ads === 0)
                  );
                  
                  const unverifiedUsers = users.filter(u => !u.admin_verified && new Date(u.created_at) <= thirtyDaysAgo && u.is_active);
                  const newUsers = users.filter(u => new Date(u.created_at) > thirtyDaysAgo && u.is_active);
                  
                  // User Level Groups
                  const diamondUsers = users.filter(u => u.level === 'DIAMOND' && u.is_active);
                  const goldUsers = users.filter(u => u.level === 'GOLD' && u.is_active);
                  const silverUsers = users.filter(u => u.level === 'SILVER' && u.is_active);
                  
                  // Business Users
                  const businessUsers = users.filter(u => u.business_name && u.business_name.trim() !== '' && u.is_active);
                  
                  // Fully Verified
                  const fullyVerifiedUsers = users.filter(u => u.phone_verified && u.email_verified && u.is_active);
                  
                  // Staff/Admin Users
                  const staffUsers = users.filter(u => (u.is_staff || u.is_superuser) && u.is_active);
                  
                  // Top 100 Users with Most Active Ads
                  const topActiveAdsUsers = users
                    .filter(u => u.is_active && u.active_ads && u.active_ads > 0)
                    .sort((a, b) => (b.active_ads || 0) - (a.active_ads || 0))
                    .slice(0, 100);
                  
                  const toggleGroup = (groupUserIds: number[]) => {
                    const allSelected = groupUserIds.every(id => formData.members.includes(id));
                    if (allSelected) {
                      setFormData({
                        ...formData,
                        members: formData.members.filter(id => !groupUserIds.includes(id)),
                      });
                    } else {
                      setFormData({
                        ...formData,
                        members: Array.from(new Set([...formData.members, ...groupUserIds])),
                      });
                    }
                  };
                  
                  const toggleUser = (userId: number) => {
                    if (formData.members.includes(userId)) {
                      setFormData({
                        ...formData,
                        members: formData.members.filter(id => id !== userId),
                      });
                    } else {
                      setFormData({
                        ...formData,
                        members: [...formData.members, userId],
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
                                checked={verifiedWithAds.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                                checked={verifiedNoAds.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                                checked={unverifiedUsers.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                                checked={newUsers.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                      
                      {/* Diamond Level Users */}
                      {diamondUsers.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={diamondUsers.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                      
                      {/* Gold Level Users */}
                      {goldUsers.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={goldUsers.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                      
                      {/* Silver Level Users */}
                      {silverUsers.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={silverUsers.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                                checked={businessUsers.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                                checked={fullyVerifiedUsers.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                      
                      {/* Staff/Admin Users */}
                      {staffUsers.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={staffUsers.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                      
                      {/* Top 100 Users with Most Active Ads */}
                      {topActiveAdsUsers.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={topActiveAdsUsers.every(u => formData.members.includes(u.id))}
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
                                  checked={formData.members.includes(user.id)}
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
                      
                      {formData.members.length > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-sm font-medium text-gray-700">
                            {formData.members.length} member(s) selected
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingRoom ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Messages Modal */}
        <Modal
          isOpen={isMessagesModalOpen}
          onClose={() => {
            setIsMessagesModalOpen(false);
            setSelectedRoom(null);
            setMessages([]);
          }}
          title={`Messages - ${selectedRoom?.name || 'Chat Room'}`}
          size="lg"
        >
          <div className="space-y-4">
            {loadingMessages ? (
              <div className="text-center py-8 text-gray-500">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No messages in this chat room</div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {messages.map((message) => (
                  <div key={message.id} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-sm">
                          {typeof message.sender === 'object' 
                            ? (message.sender.name || message.sender.email || 'Unknown')
                            : `User ${message.sender}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(message.created_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                      {message.is_read ? (
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          Read
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                          Unread
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      </div>
    </Layout>
  );
}
