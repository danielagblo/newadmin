'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { chatRoomsApi } from '@/lib/api/chats';
import { ChatRoom } from '@/lib/types';
import { format } from 'date-fns';

export default function ChatRoomsPage() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChatRooms();
  }, []);

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
      render: (room: ChatRoom) => room.members?.length || 0,
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
        <h1 className="text-3xl font-bold text-gray-900">Chat Rooms</h1>

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
            isLoading={loading}
          />
        </div>
      </div>
    </Layout>
  );
}

