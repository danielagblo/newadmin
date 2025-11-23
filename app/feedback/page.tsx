'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { feedbackApi } from '@/lib/api/feedback';
import { Feedback } from '@/lib/types';
import { format } from 'date-fns';
import { Archive, CheckCircle, Eye, MessageSquare, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [adminResponse, setAdminResponse] = useState('');

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        ordering: '-created_at', // Order by newest first
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (searchTerm) {
        params.search = searchTerm;
      }

      const data = await feedbackApi.list(params);
      const feedbacksArray = Array.isArray(data) ? data : [];
      setFeedbacks(feedbacksArray);
    } catch (error: any) {
      console.error('Error fetching feedbacks:', error);

      let errorMessage = 'Failed to fetch feedbacks';
      let errorDetails = '';

      if (error?.response?.status === 404) {
        errorMessage = 'Feedbacks endpoint not found (404)';
        errorDetails = `The feedbacks API endpoint does not exist on your Django backend.\n\n` +
          `Expected endpoint: /api-v1/feedback/\n\n` +
          `Please check if the endpoint exists in your Django backend.`;
      } else if (error?.response?.status === 401) {
        errorMessage = 'Authentication failed (401)';
        errorDetails = 'Please log out and log in again.';
      } else if (error?.response?.status === 403) {
        errorMessage = 'Access denied (403)';
        errorDetails = 'You may not have permission to view feedbacks.';
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
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleView = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setIsViewModalOpen(true);
  };

  const handleRespond = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setAdminResponse(feedback.admin_response || '');
    setIsResponseModalOpen(true);
  };

  const handleUpdateStatus = async (feedback: Feedback, newStatus: Feedback['status']) => {
    try {
      await feedbackApi.update(feedback.id, { status: newStatus });
      fetchFeedbacks();
    } catch (error: any) {
      console.error('Error updating feedback status:', error);
      window.alert(error.response?.data?.detail || 'Failed to update feedback status');
    }
  };

  const handleSubmitResponse = async () => {
    if (!selectedFeedback) return;

    try {
      await feedbackApi.update(selectedFeedback.id, {
        admin_response: adminResponse,
        status: 'RESOLVED',
      });
      setIsResponseModalOpen(false);
      setAdminResponse('');
      fetchFeedbacks();
    } catch (error: any) {
      console.error('Error submitting response:', error);
      window.alert(error.response?.data?.detail || 'Failed to submit response');
    }
  };

  const handleDelete = async (feedback: Feedback) => {
    if (!window.confirm(`Are you sure you want to delete this feedback?`)) {
      return;
    }

    try {
      await feedbackApi.delete(feedback.id);
      fetchFeedbacks();
    } catch (error: any) {
      console.error('Error deleting feedback:', error);
      window.alert(error.response?.data?.detail || 'Failed to delete feedback');
    }
  };

  const getStatusBadge = (status?: string) => {
    const statusColors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      READ: 'bg-blue-100 text-blue-800',
      RESOLVED: 'bg-green-100 text-green-800',
      ARCHIVED: 'bg-gray-100 text-gray-800',
    };

    const color = statusColors[status || 'PENDING'] || 'bg-gray-100 text-gray-800';

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
        {status || 'PENDING'}
      </span>
    );
  };

  const getUserName = (feedback: Feedback) => {
    if (typeof feedback.user === 'object' && feedback.user) {
      return feedback.user.name || feedback.user.email || 'Unknown User';
    }
    return 'Unknown User';
  };

  const getUserEmail = (feedback: Feedback) => {
    if (typeof feedback.user === 'object' && feedback.user) {
      return feedback.user.email || '';
    }
    return '';
  };

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (feedback: Feedback) => (
        <div className="text-sm">
          <div className="font-medium">{getUserName(feedback)}</div>
          {getUserEmail(feedback) && (
            <div className="text-gray-500 text-xs">{getUserEmail(feedback)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      render: (feedback: Feedback) => (
        <div className="max-w-md truncate text-sm">
          {feedback.message}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (feedback: Feedback) => getStatusBadge(feedback.status),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (feedback: Feedback) => feedback.created_at ? format(new Date(feedback.created_at), 'MMM dd, yyyy HH:mm') : '-',
    },
    {
      key: 'response',
      header: 'Response',
      render: (feedback: Feedback) => feedback.admin_response ? (
        <div className="text-sm whitespace-pre-wrap max-w-md">{feedback.admin_response}</div>
      ) : (
        <div className="text-sm text-gray-500">-</div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">User Feedback</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Feedbacks</h3>
                <p className="mt-1 text-sm text-red-700 whitespace-pre-line">{error}</p>
                <button
                  onClick={() => fetchFeedbacks()}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4 flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search feedbacks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-48"
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'READ', label: 'Read' },
                { value: 'RESOLVED', label: 'Resolved' },
                { value: 'ARCHIVED', label: 'Archived' },
              ]}
            />
            <div className="text-sm text-gray-600">
              Total: {feedbacks.length} feedback{feedbacks.length !== 1 ? 's' : ''}
            </div>
          </div>

          <DataTable
            data={feedbacks}
            columns={columns}
            onDelete={handleDelete}
            isLoading={loading}
            actions={(feedback: Feedback) => (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleView(feedback)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="View feedback"
                >
                  <Eye className="h-4 w-4" />
                </button>
                {feedback.status !== 'RESOLVED' && (
                  <button
                    onClick={() => handleRespond(feedback)}
                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                    title="Respond"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleUpdateStatus(feedback, feedback.status === 'ARCHIVED' ? 'READ' : 'ARCHIVED')}
                  className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded"
                  title={feedback.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
                >
                  <Archive className="h-4 w-4" />
                </button>
              </div>
            )}
          />
        </div>

        {/* View Feedback Modal */}
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title="Feedback Details"
        >
          {selectedFeedback && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <div className="text-sm text-gray-900">
                  {getUserName(selectedFeedback)}
                  {getUserEmail(selectedFeedback) && (
                    <div className="text-gray-500">{getUserEmail(selectedFeedback)}</div>
                  )}
                </div>
              </div>

              {selectedFeedback.subject && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <div className="text-sm text-gray-900">{selectedFeedback.subject}</div>
                </div>
              )}

              {selectedFeedback.category && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <div className="text-sm text-gray-900">{selectedFeedback.category}</div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div>{getStatusBadge(selectedFeedback.status)}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                  {selectedFeedback.message}
                </div>
              </div>

              {selectedFeedback.admin_response && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Response</label>
                  <div className="text-sm text-gray-900 whitespace-pre-wrap bg-blue-50 p-3 rounded">
                    {selectedFeedback.admin_response}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                <div className="text-sm text-gray-900">
                  {format(new Date(selectedFeedback.created_at), 'MMM dd, yyyy HH:mm:ss')}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    handleRespond(selectedFeedback);
                  }}
                  variant="primary"
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {selectedFeedback.admin_response ? 'Update Response' : 'Respond'}
                </Button>
                <Button
                  onClick={() => setIsViewModalOpen(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Respond Modal */}
        <Modal
          isOpen={isResponseModalOpen}
          onClose={() => setIsResponseModalOpen(false)}
          title="Respond to Feedback"
        >
          {selectedFeedback && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <div className="text-sm text-gray-900">{getUserName(selectedFeedback)}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Original Message</label>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                  {selectedFeedback.message}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Admin Response</label>
                <Textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Enter your response..."
                  rows={6}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSubmitResponse}
                  variant="primary"
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Response
                </Button>
                <Button
                  onClick={() => {
                    setIsResponseModalOpen(false);
                    setAdminResponse('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  );
}

