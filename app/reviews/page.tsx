'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { reviewsApi } from '@/lib/api/reviews';
import { productsApi } from '@/lib/api/products';
import { Review, Product, User } from '@/lib/types';
import { format } from 'date-fns';
import { Star, Eye, X, Package, User as UserIcon, Mail, Phone, MapPin } from 'lucide-react';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [productDetails, setProductDetails] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

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

  const handleViewDetails = async (review: Review) => {
    setSelectedReview(review);
    setIsModalOpen(true);
    setProductDetails(null);
    
    // Fetch product details if product ID is available
    const productId = typeof review.product === 'object' ? review.product.id : review.product;
    if (productId) {
      setLoadingProduct(true);
      try {
        const product = await productsApi.get(productId);
        setProductDetails(product);
      } catch (error) {
        console.error('Error fetching product details:', error);
      } finally {
        setLoadingProduct(false);
      }
    }
  };

  const handleDelete = async (review: Review) => {
    if (!window.confirm('Are you sure you want to delete this review?')) {
      return;
    }
    try {
      await reviewsApi.delete(review.id);
      fetchReviews();
    } catch (error) {
      console.error('Error deleting review:', error);
      window.alert('Failed to delete review');
    }
  };

  const getOwnerInfo = (owner: string | User | undefined): User | null => {
    if (!owner) return null;
    if (typeof owner === 'object') return owner;
    return null; // If owner is just an ID string, we can't get details without fetching
  };

  const getProductName = (product: number | Product | undefined): string => {
    if (!product) return 'Unknown Product';
    if (typeof product === 'object') return product.name;
    return `Product ID: ${product}`;
  };

  const getProductImage = (product: Product | null): string | null => {
    if (!product || !product.image) return null;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    if (product.image.startsWith('http')) return product.image;
    return `${apiUrl}${product.image}`;
  };

  const columns = [
    { key: 'id', header: 'ID' },
    {
      key: 'user',
      header: 'User',
      render: (review: Review) => {
        const user = typeof review.user === 'object' ? review.user : null;
        return user ? (user.name || user.email || 'Unknown') : 'Unknown User';
      },
    },
    {
      key: 'product',
      header: 'Product',
      render: (review: Review) => getProductName(review.product),
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
      render: (review: Review) => (
        <div className="max-w-xs truncate" title={review.comment || ''}>
          {review.comment || '-'}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (review: Review) => format(new Date(review.created_at), 'MMM dd, yyyy'),
    },
  ];

  const owner = productDetails ? getOwnerInfo(productDetails.owner) : null;

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Reviews</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <DataTable
            data={reviews}
            columns={columns}
            actions={(review: Review) => (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(review)}
                  title="View product details"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View Details
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(review)}
                  title="Delete review"
                >
                  Delete
                </Button>
              </div>
            )}
            isLoading={loading}
          />
        </div>

        {/* Product Details Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedReview(null);
            setProductDetails(null);
          }}
          title={selectedReview ? `Review #${selectedReview.id} - Product Details` : 'Product Details'}
        >
          {selectedReview && (
            <div className="space-y-6">
              {/* Review Information */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Review Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            i < selectedReview.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-gray-900">{selectedReview.rating}/5</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer</label>
                    <div className="text-sm text-gray-900">
                      {typeof selectedReview.user === 'object' 
                        ? (selectedReview.user.name || selectedReview.user.email || 'Unknown')
                        : 'Unknown User'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                    <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                      {selectedReview.comment || 'No comment provided'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <div className="text-sm text-gray-900">
                      {format(new Date(selectedReview.created_at), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Details */}
              {loadingProduct ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  <span className="ml-3 text-gray-600">Loading product details...</span>
                </div>
              ) : productDetails ? (
                <>
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <Package className="h-5 w-5 mr-2" />
                      Product Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Product Image */}
                      {getProductImage(productDetails) && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
                          <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={getProductImage(productDetails) || ''}
                              alt={productDetails.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                        <div className="text-sm text-gray-900 font-medium">{productDetails.name}</div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                        <div className="text-sm text-gray-900">{productDetails.pid || productDetails.id}</div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                        <div className="text-sm text-gray-900 font-semibold">{productDetails.price}</div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          productDetails.type === 'SALE' ? 'bg-green-100 text-green-800' :
                          productDetails.type === 'RENT' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {productDetails.type}
                        </span>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          productDetails.status === 'ACTIVE' || productDetails.status === 'VERIFIED' 
                            ? 'bg-green-100 text-green-800' :
                          productDetails.status === 'PENDING' 
                            ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {productDetails.status}
                        </span>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Is Taken</label>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          productDetails.is_taken 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {productDetails.is_taken ? 'Yes' : 'No'}
                        </span>
                      </div>

                      {productDetails.location && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            Location
                          </label>
                          <div className="text-sm text-gray-900">
                            {typeof productDetails.location === 'object' 
                              ? productDetails.location.name 
                              : 'Unknown Location'}
                          </div>
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                          {productDetails.description || 'No description available'}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                        <div className="text-sm text-gray-900">
                          {format(new Date(productDetails.created_at), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Owner Information */}
                  {owner && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <UserIcon className="h-5 w-5 mr-2" />
                        Owner Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                          <div className="text-sm text-gray-900 font-medium">{owner.name || 'N/A'}</div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            <Mail className="h-4 w-4 mr-1" />
                            Email
                          </label>
                          <div className="text-sm text-gray-900">{owner.email || 'N/A'}</div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            <Phone className="h-4 w-4 mr-1" />
                            Phone
                          </label>
                          <div className="text-sm text-gray-900">{owner.phone || 'N/A'}</div>
                        </div>

                        {owner.business_name && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                            <div className="text-sm text-gray-900">{owner.business_name}</div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            owner.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {owner.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Verified</label>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            owner.admin_verified 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {owner.admin_verified ? 'Verified' : 'Not Verified'}
                          </span>
                        </div>

                        {owner.address && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                            <div className="text-sm text-gray-900">{owner.address}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!owner && productDetails.owner && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        Owner information is not available. Owner ID: {typeof productDetails.owner === 'string' ? productDetails.owner : 'N/A'}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Product details could not be loaded. The product may have been deleted or the endpoint is not available.
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  );
}

