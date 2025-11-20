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
import { Plus, MessageSquare, RefreshCw } from 'lucide-react';

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
  const [formData, setFormData] = useState({
    name: '',
    is_group: false,
    members: [] as number[],
  });

  useEffect(() => {
    fetchChatRooms();
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

  const fetchChatRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await chatRoomsApi.list();
      console.log('Chat rooms fetched:', data);
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
            <div className="mb-4 text-sm text-gray-600">
              Total chat rooms: {chatRooms.length}
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
              <select
                multiple
                value={formData.members.map(String)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                  setFormData({ ...formData, members: selected });
                }}
                className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[120px]"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
              {formData.members.length > 0 && (
                <p className="text-xs text-gray-500">
                  {formData.members.length} member(s) selected: {formData.members.map(id => {
                    const user = users.find(u => u.id === id);
                    return user?.name || `User ${id}`;
                  }).join(', ')}
                </p>
              )}
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
