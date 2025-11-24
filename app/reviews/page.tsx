'use client';

import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { reviewsApi } from '@/lib/api/reviews';
import { PaginatedResponse, Review } from '@/lib/types';
import { format } from 'date-fns';
import { Star, Eye } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  // keep the raw fetched reviews; we'll apply a client-side owner-name filter as a fallback
  const [rawReviews, setRawReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [ownerSearch, setOwnerSearch] = useState<string>('');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: currentPage };
      const data = await reviewsApi.list(params);
      console.log('Reviews fetched:', data);

      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        setRawReviews(data);
        setReviews(data);
        setTotalItems(data.length);
        setTotalPages(1);
      } else {
        const paginatedData = data as PaginatedResponse<Review>;
        setRawReviews(paginatedData.results || []);
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

  // Apply combined client-side filters (rating + owner) to rawReviews
  useEffect(() => {
    // reset to first page when filters change
    setCurrentPage(1);

    let filtered = rawReviews.slice();

    if (ratingFilter && ratingFilter !== 'all') {
      const r = Number(ratingFilter);
      filtered = filtered.filter((rev) => Number(rev.rating) === r);
    }

    if (ownerSearch) {
      const q = ownerSearch.toLowerCase();
      filtered = filtered.filter((rev) => (rev.product?.owner?.name || '').toLowerCase().includes(q));
    }

    setReviews(filtered);
    setTotalItems(filtered.length);
    setTotalPages(Math.max(1, Math.ceil(filtered.length / 20)));
  }, [rawReviews, ratingFilter, ownerSearch]);

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

  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const handleView = (review: Review) => {
    setSelectedReview(review);
    setIsViewModalOpen(true);
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
      key: 'owner',
      header: 'Owner',
      render: (review: Review) => review.product?.owner?.name || '-',
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (review: Review) => (
        <div className="flex items-center">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
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

        <div className="mb-4 flex items-center gap-4 flex-wrap">
          <div className="relative w-64">
            <Input
              placeholder="Search owner..."
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
            />
          </div>
          <Select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="w-48"
            options={[
              { value: 'all', label: 'All Ratings' },
              { value: '5', label: '5' },
              { value: '4', label: '4' },
              { value: '3', label: '3' },
              { value: '2', label: '2' },
              { value: '1', label: '1' },
            ]}
          />
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
            actions={(review: Review) => (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleView(review)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="View"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            )}
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
          <Modal
            isOpen={isViewModalOpen}
            onClose={() => setIsViewModalOpen(false)}
            title={selectedReview ? `Review #${selectedReview.id}` : 'Review'}
            size="lg"
          >
            {selectedReview && (
              <div className="space-y-4">
                <div className="flex gap-6">
                  <div className="w-1/3">
                    {selectedReview.product?.image ? (
                      <div className="relative w-full h-48 rounded overflow-hidden">
                        <Image
                          src={selectedReview.product.image}
                          alt={selectedReview.product?.name || 'Product image'}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{selectedReview.product?.name}</h3>
                    <div className="text-sm text-gray-600">Owner: {selectedReview.product?.owner?.name || '-'}</div>
                    {selectedReview.product?.price && (
                      <div className="mt-2 text-sm">Price: {selectedReview.product.price}</div>
                    )}
                    {selectedReview.product?.location && (
                      <div className="mt-1 text-sm">Location: {selectedReview.product.location.name || '-'}</div>
                    )}
                    <div className="mt-4">
                      <div className="text-sm font-medium">Review</div>
                      <div className="flex items-center mt-2">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < (selectedReview.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                          />
                        ))}
                        <span className="ml-2 text-sm">{selectedReview.rating}</span>
                      </div>
                      <div className="mt-2 text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded">{selectedReview.comment}</div>
                      <div className="mt-2 text-xs text-gray-500">By: {selectedReview.user?.name || 'Unknown'} — {format(new Date(selectedReview.created_at), 'MMM dd, yyyy')}</div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setIsViewModalOpen(false)} variant="outline">Close</Button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      </div>
    </Layout>
  );
}

