'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Pagination } from '@/components/ui/Pagination';
import { productsApi } from '@/lib/api/products';
import { categoriesApi } from '@/lib/api/categories';
import { locationsApi } from '@/lib/api/locations';
import { usersApi } from '@/lib/api/users';
import { Product, Category, Location, User, PRODUCT_TYPES, PRODUCT_STATUSES } from '@/lib/types';
import { format } from 'date-fns';
import { Plus, Search, X } from 'lucide-react';
import Image from 'next/image';
import { getImageUrl } from '@/lib/utils';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [formData, setFormData] = useState<{
    name: string;
    category: string;
    location: string;
    type: 'SALE' | 'PAYLATER' | 'RENT';
    status: 'VERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'DRAFT' | 'PENDING' | 'REJECTED';
    description: string;
    price: string;
    duration: string;
    owner: string;
    image: File | null;
  }>({
    name: '',
    category: '',
    location: '',
    type: 'SALE',
    status: 'PENDING',
    description: '',
    price: '',
    duration: 'One Time Payment',
    owner: '',
    image: null,
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: currentPage };
      if (searchTerm) params.search = searchTerm;
      const data = await productsApi.list(params);
      console.log('Products fetched:', data);
      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        setProducts(data);
        setTotalItems(data.length);
        setTotalPages(1);
      } else {
        setProducts(data.results || []);
        setTotalItems(data.count || 0);
        setTotalPages(Math.ceil((data.count || 0) / 20));
      }
    } catch (error: any) {
      console.error('Error fetching products:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to fetch products';
      setError(errorMessage);
      setProducts([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoriesApi.list();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await locationsApi.list();
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchLocations();
    fetchUsers();
  }, [fetchProducts, fetchCategories, fetchLocations, fetchUsers]);

  const handleCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category: '',
      location: '',
      type: 'SALE',
      status: 'PENDING',
      description: '',
      price: '',
      duration: 'One Time Payment',
      owner: '',
      image: null,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category?.toString() || '',
      location: product.location?.id?.toString() || '',
      type: product.type,
      status: product.status,
      description: product.description,
      price: product.price,
      duration: product.duration,
      owner: product.owner?.id?.toString() || '',
      image: null,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (product: Product) => {
    try {
      await productsApi.delete(product.id);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      window.alert('Failed to delete product');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData: any = {
        ...formData,
        category: formData.category ? parseInt(formData.category) : undefined,
        location: formData.location ? parseInt(formData.location) : undefined,
        owner: formData.owner ? parseInt(formData.owner) : undefined,
      };
      delete submitData.image;

      if (editingProduct) {
        await productsApi.update(editingProduct.id, submitData);
      } else {
        await productsApi.create(submitData);
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      window.alert(error.response?.data?.detail || 'Failed to save product');
    }
  };

  const handleSetStatus = async (product: Product, status: string) => {
    try {
      await productsApi.setStatus(product.id, status);
      fetchProducts();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
    },
    {
      key: 'name',
      header: 'Name',
    },
    {
      key: 'price',
      header: 'Price',
      render: (product: Product) => `GHS ${product.price}`,
    },
    {
      key: 'type',
      header: 'Type',
      render: (product: Product) => (
        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
          {product.type}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (product: Product) => (
        <span className={`px-2 py-1 rounded text-xs ${
          product.status === 'ACTIVE' || product.status === 'VERIFIED' ? 'bg-green-100 text-green-800' :
          product.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
          product.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {product.status}
        </span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner Verification',
      render: (product: Product) => {
        if (!product.owner) {
          return <span className="text-xs text-gray-400">No owner</span>;
        }
        return (
          <div className="flex items-center gap-2">
            {product.owner.avatar && (
              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-300 flex-shrink-0">
                <Image
                  src={getImageUrl(product.owner.avatar)}
                  alt={product.owner.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-900">{product.owner.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded inline-block w-fit mt-0.5 ${
                product.owner.admin_verified
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {product.owner.admin_verified ? 'Verified' : 'Unverified'}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'is_taken',
      header: 'Taken',
      render: (product: Product) => (
        <span className={`px-2 py-1 rounded text-xs ${
          product.is_taken ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
        }`}>
          {product.is_taken ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (product: Product) => format(new Date(product.created_at), 'MMM dd, yyyy'),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Products</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={() => fetchProducts()}
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
              Total products: {totalItems} | Page {currentPage} of {totalPages}
            </div>
          )}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>

          <DataTable
            data={products}
            columns={columns}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={loading}
            actions={(product: Product) => (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = `/products/${product.id}`}
                >
                  View
                </Button>
                <Select
                  value={product.status}
                  onChange={(e) => handleSetStatus(product, e.target.value)}
                  options={PRODUCT_STATUSES.map(s => ({ value: s, label: s }))}
                  className="w-32"
                />
                {!product.is_taken && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => productsApi.markAsTaken(product.id).then(() => fetchProducts())}
                  >
                    Mark Taken
                  </Button>
                )}
              </>
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
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingProduct ? 'Edit Product' : 'Create Product'}
          size="xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                options={[
                  { value: '', label: 'Select Category' },
                  ...categories.map(c => ({ value: c.id.toString(), label: c.name })),
                ]}
              />
              <Select
                label="Location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                options={[
                  { value: '', label: 'Select Location' },
                  ...locations.map(l => ({ value: l.id.toString(), label: l.name })),
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Type"
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                options={PRODUCT_TYPES.map(t => ({ value: t, label: t }))}
              />
              <Select
                label="Status"
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                options={PRODUCT_STATUSES.map(s => ({ value: s, label: s }))}
              />
            </div>
            <Textarea
              label="Description"
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Price"
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
              <Input
                label="Duration"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              />
            </div>
            <Select
              label="Owner"
              value={formData.owner}
              onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
              options={[
                { value: '', label: 'Select Owner' },
                ...users.map(u => ({ value: u.id.toString(), label: u.name })),
              ]}
            />
            {/* Show existing image if editing */}
            {editingProduct && editingProduct.image && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Image
                </label>
                <div className="grid grid-cols-4 gap-4">
                  <div className="relative group">
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200">
                      <Image
                        src={getImageUrl(editingProduct.image)}
                        alt={editingProduct.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-center">Main Image</p>
                  </div>
                </div>
              </div>
            )}

            {/* Owner Information */}
            {editingProduct && editingProduct.owner && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Owner Information
                </label>
                <div className="flex items-start gap-4">
                  {editingProduct.owner.avatar && (
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-300 flex-shrink-0">
                      <Image
                        src={getImageUrl(editingProduct.owner.avatar)}
                        alt={editingProduct.owner.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{editingProduct.owner.name}</h4>
                      {editingProduct.owner.level && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          editingProduct.owner.level === 'DIAMOND' ? 'bg-purple-100 text-purple-800' :
                          editingProduct.owner.level === 'GOLD' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {editingProduct.owner.level}
                        </span>
                      )}
                      {editingProduct.owner.admin_verified && (
                        <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{editingProduct.owner.email}</p>
                    {editingProduct.owner.phone && (
                      <p className="text-sm text-gray-600">{editingProduct.owner.phone}</p>
                    )}
                    {editingProduct.owner.business_name && (
                      <p className="text-sm text-gray-600 mt-1">
                        Business: {editingProduct.owner.business_name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        editingProduct.owner.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {editingProduct.owner.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Input
              label="Image"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setFormData({ ...formData, image: file });
              }}
            />
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}

