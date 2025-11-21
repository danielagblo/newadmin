'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { productsApi } from '@/lib/api/products';
import { Product } from '@/lib/types';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { getImageUrl } from '@/lib/utils';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProduct = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    try {
      const data = await productsApi.get(Number(params.id));
      setProduct(data);
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner size="lg" className="py-12" />
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Product not found</p>
          <Button onClick={() => router.push('/products')} className="mt-4">
            Back to Products
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <Button
          variant="outline"
          onClick={() => router.push('/products')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {product.image && (
                <div className="relative w-full h-96 rounded-lg overflow-hidden">
                  <Image
                    src={getImageUrl(product.image)}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              {((product as any).images as { image: string }[])?.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {((product as any).images as { image: string }[]).map((img, idx) => (
                    <div key={idx} className="relative w-full h-24 rounded overflow-hidden">
                      <Image
                        src={getImageUrl(img.image)}
                        alt={`${product.name} ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
                <p className="text-2xl font-semibold text-primary-600 mt-2">
                  GHS {product.price}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs mt-1 ${
                    product.status === 'ACTIVE' || product.status === 'VERIFIED'
                      ? 'bg-green-100 text-green-800'
                      : product.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {product.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <span className="inline-block px-2 py-1 rounded text-xs mt-1 bg-blue-100 text-blue-800">
                    {product.type}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Taken</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs mt-1 ${
                    product.is_taken ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {product.is_taken ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="text-sm font-medium mt-1">{product.duration}</p>
                </div>
              </div>

              {product.owner && (() => {
                // Handle owner - could be User object or number (ID)
                if (typeof product.owner === 'number') {
                  return (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <p className="text-sm font-medium text-gray-700 mb-3">Owner Information</p>
                      <p className="text-sm text-gray-600">Owner ID: {product.owner}</p>
                    </div>
                  );
                }
                
                // Owner is a User object
                const ownerUser = product.owner as any;
                if (!ownerUser || typeof ownerUser !== 'object' || !('name' in ownerUser)) {
                  return (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <p className="text-sm font-medium text-gray-700 mb-3">Owner Information</p>
                      <p className="text-sm text-gray-600">Owner information not available</p>
                    </div>
                  );
                }
                
                return (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <p className="text-sm font-medium text-gray-700 mb-3">Owner Information</p>
                    <div className="flex items-start gap-4">
                      {ownerUser.avatar && (
                        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-300 flex-shrink-0">
                          <Image
                            src={getImageUrl(ownerUser.avatar)}
                            alt={ownerUser.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{ownerUser.name}</h4>
                          {ownerUser.level && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              ownerUser.level === 'DIAMOND' ? 'bg-purple-100 text-purple-800' :
                              ownerUser.level === 'GOLD' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {ownerUser.level}
                            </span>
                          )}
                          {ownerUser.admin_verified && (
                            <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{ownerUser.email}</p>
                        {ownerUser.phone && (
                          <p className="text-sm text-gray-600">{ownerUser.phone}</p>
                        )}
                        {ownerUser.business_name && (
                          <p className="text-sm text-gray-600 mt-1">
                            Business: {ownerUser.business_name}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            ownerUser.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {ownerUser.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {product.location && (
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="text-sm font-medium mt-1">
                    {product.location.name}, {product.location.region}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm font-medium mt-1">
                  {format(new Date(product.created_at), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h2 className="text-lg font-semibold mb-2">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
          </div>

          {((product as any).product_features && (product as any).product_features.length > 0) && (
            <div className="mt-6 pt-6 border-t">
              <h2 className="text-lg font-semibold mb-4">Features</h2>
              <div className="grid grid-cols-2 gap-4">
                {((product as any).product_features as { feature: { name: string }; value: string }[]).map((pf, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <p className="text-sm font-medium text-gray-700">{pf.feature.name}</p>
                    <p className="text-sm text-gray-600 mt-1">{pf.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

