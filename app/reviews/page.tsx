'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { reviewsApi } from '@/lib/api/reviews';
import { Review } from '@/lib/types';
import { format } from 'date-fns';
import { Star } from 'lucide-react';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await reviewsApi.list();
      setReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

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
        <h1 className="text-3xl font-bold text-gray-900">Reviews</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <DataTable
            data={reviews}
            columns={columns}
            onDelete={handleDelete}
            isLoading={loading}
          />
        </div>
      </div>
    </Layout>
  );
}

