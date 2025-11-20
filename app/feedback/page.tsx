'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { feedbackApi } from '@/lib/api/feedback';
import { Feedback, User, FEEDBACK_CATEGORIES, FEEDBACK_STATUSES } from '@/lib/types';
import { format } from 'date-fns';
import { MessageSquare, Eye, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react';
import { usersApi } from '@/lib/api/users';

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [adminResponse, setAdminResponse] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [statusUpdate, setStatusUpdate] = useState<string>('');

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching feedback with filters:', { statusFilter, categoryFilter, searchTerm });
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (searchTerm) params.search = searchTerm;

      const data = await feedbackApi.list(params);
      console.log('Feedback fetched from API:', data);
      const feedbackArray = Array.isArray(data) ? data : [];
      setFeedback(feedbackArray);
      
      if (feedbackArray.length === 0) {
        console.warn('No feedback found. This might be normal if there are no feedback items yet.');
      }
    } catch (error: any) {
      console.error('Error fetching feedback:', error);
      console.error('Error response:', error?.response);
      console.error('Error status:', error?.response?.status);
      
      let errorMessage = 'Failed to fetch feedback';
      let errorDetails = '';
      
      if (error?.response?.status === 404) {
        errorMessage = 'Feedback endpoint not found (404)';
        errorDetails = `The feedback API endpoint does not exist on your Django backend yet.\n\n` +
          `Expected endpoints: /api-v1/admin/feedback/ or /api-v1/feedback/\n\n` +
          `Please create the feedback endpoints in your Django backend.`;
      } else if (error?.response?.status === 401) {
        errorMessage = 'Authentication failed (401)';
        errorDetails = 'Please log out and log in again.';
      } else if (error?.response?.status === 403) {
        errorMessage = 'Access denied (403)';
        errorDetails = 'You may not have permission to view feedback.';
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
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, searchTerm]);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await usersApi.list();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
    fetchUsers();
  }, [fetchFeedback, fetchUsers]);

  const handleView = (item: Feedback) => {
    setSelectedFeedback(item);
    setAdminResponse(item.admin_response || '');
    setAdminNotes(item.admin_notes || '');
    setStatusUpdate(item.status);
    setIsModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedFeedback) return;

    try {
      await feedbackApi.update(selectedFeedback.id, {
        status: statusUpdate as any,
        admin_response: adminResponse || undefined,
        admin_notes: adminNotes || undefined,
      });
      setIsModalOpen(false);
      fetchFeedback();
      setSelectedFeedback(null);
      setAdminResponse('');
      setAdminNotes('');
      setStatusUpdate('');
    } catch (error: any) {
      console.error('Error updating feedback:', error);
      window.alert(error.response?.data?.detail || 'Failed to update feedback');
    }
  };

  const handleDelete = async (item: Feedback) => {
    if (!window.confirm(`Are you sure you want to delete this feedback?`)) {
      return;
    }
    try {
      await feedbackApi.delete(item.id);
      fetchFeedback();
    } catch (error: any) {
      console.error('Error deleting feedback:', error);
      window.alert(error.response?.data?.detail || 'Failed to delete feedback');
    }
  };

  const getUserName = (userId: number | User | undefined): string => {
    if (!userId) return 'Unknown User';
    if (typeof userId === 'object') {
      return userId.name || userId.email || 'Unknown User';
    }
    const user = users.find(u => u.id === userId);
    return user ? (user.name || user.email || 'Unknown User') : `User ID: ${userId}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_REVIEW':
        return 'bg-blue-100 text-blue-800';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'BUG':
        return 'bg-red-100 text-red-800';
      case 'FEATURE':
        return 'bg-blue-100 text-blue-800';
      case 'IMPROVEMENT':
        return 'bg-green-100 text-green-800';
      case 'COMPLAINT':
        return 'bg-orange-100 text-orange-800';
      case 'OTHER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const columns = [
    { key: 'id', header: 'ID' },
    {
      key: 'user',
      header: 'User',
      render: (item: Feedback) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900">{getUserName(item.user)}</div>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (item: Feedback) => (
        <div className="text-sm font-medium text-gray-900 max-w-xs truncate" title={item.subject}>
          {item.subject}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (item: Feedback) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(item.category)}`}>
          {item.category}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Feedback) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
          {item.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (item: Feedback) => format(new Date(item.created_at), 'MMM dd, yyyy HH:mm'),
    },
  ];

  const filteredFeedback = feedback.filter((item) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        item.subject.toLowerCase().includes(searchLower) ||
        item.message.toLowerCase().includes(searchLower) ||
        getUserName(item.user).toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Feedback</h1>
            <p className="mt-2 text-gray-600">Manage user feedback and suggestions</p>
          </div>
        </div>

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800">Feedback Endpoint Not Available</h3>
                <p className="mt-1 text-sm text-yellow-700 whitespace-pre-line">{error}</p>
                <p className="mt-2 text-sm text-yellow-600">
                  The feedback feature is ready in the admin panel. You need to create the Django backend endpoints.
                  Check the Django model suggestion below.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search feedback by subject, message, or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="min-w-[150px]"
              >
                <option value="all">All Status</option>
                {FEEDBACK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </Select>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="min-w-[150px]"
              >
                <option value="all">All Categories</option>
                {FEEDBACK_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading feedback...</div>
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No feedback found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {error ? 'Feedback endpoints need to be created in Django backend.' : 'No feedback matches your filters.'}
              </p>
            </div>
          ) : (
            <DataTable
              data={filteredFeedback}
              columns={columns}
              actions={(item: Feedback) => (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(item)}
                    title="View and respond"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(item)}
                    title="Delete feedback"
                  >
                    Delete
                  </Button>
                </div>
              )}
            />
          )}
        </div>

        {/* View/Update Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedFeedback(null);
            setAdminResponse('');
            setAdminNotes('');
            setStatusUpdate('');
          }}
          title={selectedFeedback ? `Feedback #${selectedFeedback.id}` : 'Feedback Details'}
        >
          {selectedFeedback && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <div className="text-sm text-gray-900">{getUserName(selectedFeedback.user)}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <div className="text-sm text-gray-900">{selectedFeedback.subject}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(selectedFeedback.category)}`}>
                  {selectedFeedback.category}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded border max-h-40 overflow-y-auto">
                  {selectedFeedback.message}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <Select
                  value={statusUpdate}
                  onChange={(e) => setStatusUpdate(e.target.value)}
                >
                  {FEEDBACK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replace('_', ' ')}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Response (visible to user)
                </label>
                <Textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Enter your response to the user..."
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Notes (internal only)
                </label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes about this feedback..."
                  rows={3}
                />
              </div>

              <div className="text-xs text-gray-500">
                Created: {format(new Date(selectedFeedback.created_at), 'MMM dd, yyyy HH:mm')}
                {selectedFeedback.updated_at && (
                  <> • Updated: {format(new Date(selectedFeedback.updated_at), 'MMM dd, yyyy HH:mm')}</>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedFeedback(null);
                    setAdminResponse('');
                    setAdminNotes('');
                    setStatusUpdate('');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdate}>
                  Update Feedback
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  );
}

