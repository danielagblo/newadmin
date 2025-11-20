'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { reviewsApi } from '@/lib/api/reviews';
import { Review, PaginatedResponse } from '@/lib/types';
import { format } from 'date-fns';
import { Star } from 'lucide-react';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: currentPage };
      const data = await reviewsApi.list(params);
      console.log('Reviews fetched:', data);
      
      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        setReviews(data);
        setTotalItems(data.length);
        setTotalPages(1);
      } else {
        const paginatedData = data as PaginatedResponse<Review>;
        setReviews(paginatedData.results || []);
        setTotalItems(paginatedData.count || 0);
        setTotalPages(Math.ceil((paginatedData.count || 0) / 20));
      }
    } catch (error: any) {
      console.error('Error fetching reviews:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to fetch reviews';
      setError(errorMessage);
      setReviews([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDelete = async (review: Review) => {
    try {
      await reviewsApi.delete(review.id);
      fetchReviews();
    } catch (error) {
      console.error('Error deleting review:', error);
      window.alert('Failed to delete review');
    }
  };

  const columns = [
    { key: 'id', header: 'ID' },
    {
      key: 'user',
      header: 'User',
      render: (review: Review) => review.user?.name || '-',
    },
    {
      key: 'product',
      header: 'Product',
      render: (review: Review) => review.product?.name || '-',
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (review: Review) => (
        <div className="flex items-center">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
              }`}
            />
          ))}
          <span className="ml-2">{review.rating}</span>
        </div>
      ),
    },
    {
      key: 'comment',
      header: 'Comment',
      render: (review: Review) => review.comment || '-',
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (review: Review) => format(new Date(review.created_at), 'MMM dd, yyyy'),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Reviews</h1>
          <div className="text-sm text-gray-600">
            Total reviews: {totalItems} | Page {currentPage} of {totalPages}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Reviews</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={() => fetchReviews()}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <DataTable
            data={reviews}
            columns={columns}
            onDelete={handleDelete}
            isLoading={loading}
          />
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={20}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

