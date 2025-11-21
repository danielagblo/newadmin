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
import { Plus, Search, X, MoreVertical, Eye, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
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
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null); // null = all, or specific status
  const [formData, setFormData] = useState<{
    name: string;
    category: string;
    location: string;
    type: 'SALE' | 'PAYLATER' | 'RENT';
    status: 'ACTIVE' | 'SUSPENDED' | 'DRAFT' | 'PENDING' | 'REJECTED' | 'TAKEN';
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
      // Fetch all products first, then filter client-side for accuracy
      const params: any = { page: currentPage };
      if (searchTerm) params.search = searchTerm;
      // Don't send status/is_taken filters to backend - we'll filter client-side
      
      const data = await productsApi.list(params);
      console.log('Products fetched:', data);
      console.log('Current filters - statusFilter:', statusFilter);
      
      let allProducts: Product[] = [];
      if (Array.isArray(data)) {
        allProducts = data;
      } else {
        allProducts = data.results || [];
      }
      
      console.log('All products before filtering:', allProducts.length);
      
      // STRICT Client-side filtering - filter to show ONLY matching products
      let filteredProducts = allProducts;
      
      if (statusFilter) {
        if (statusFilter === 'TAKEN') {
          // "TAKEN" status tab: Show products with TAKEN status OR is_taken=true
          filteredProducts = allProducts.filter(p => p.status === 'TAKEN' || p.is_taken === true);
        } else {
          // Other status tabs: Show ONLY products with EXACT status match AND not taken
          filteredProducts = allProducts.filter(p => {
            const statusMatch = p.status === statusFilter;
            const notTaken = p.is_taken === false;
            return statusMatch && notTaken;
          });
        }
      }
      // "All" tab: No filtering, shows everything
      
      setProducts(filteredProducts);
      setTotalItems(filteredProducts.length);
      setTotalPages(Math.ceil(filteredProducts.length / 20));
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
  }, [currentPage, searchTerm, statusFilter]);

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
    // Handle owner - could be User object or number (ID)
    let ownerId = '';
    if (product.owner) {
      if (typeof product.owner === 'number') {
        ownerId = product.owner.toString();
      } else if (typeof product.owner === 'object' && 'id' in product.owner) {
        ownerId = product.owner.id.toString();
      }
    }
    
    // Convert VERIFIED status to ACTIVE since VERIFIED is no longer a valid status option
    // If product is taken but status is not TAKEN, set status to TAKEN
    let status = product.status === 'VERIFIED' ? 'ACTIVE' : product.status;
    if (product.is_taken && status !== 'TAKEN') {
      status = 'TAKEN';
    }
    
    setFormData({
      name: product.name,
      category: product.category?.toString() || '',
      location: product.location?.id?.toString() || '',
      type: product.type,
      status: status as 'ACTIVE' | 'SUSPENDED' | 'DRAFT' | 'PENDING' | 'REJECTED' | 'TAKEN',
      description: product.description,
      price: product.price,
      duration: product.duration,
      owner: ownerId,
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

      let updatedProduct: Product;
      if (editingProduct) {
        updatedProduct = await productsApi.update(editingProduct.id, submitData);
        // If status is TAKEN, also mark as taken
        if (formData.status === 'TAKEN') {
          await productsApi.markAsTaken(editingProduct.id);
          // Refetch to get updated product
          updatedProduct = await productsApi.get(editingProduct.id);
        }
      } else {
        updatedProduct = await productsApi.create(submitData);
        // If status is TAKEN, also mark as taken
        if (formData.status === 'TAKEN') {
          await productsApi.markAsTaken(updatedProduct.id);
          // Refetch to get updated product
          updatedProduct = await productsApi.get(updatedProduct.id);
        }
      }
      setIsModalOpen(false);
      
      // Switch to appropriate tab based on product state
      // If product status is TAKEN or is_taken is true, show in TAKEN status tab
      // Otherwise, show in the status tab that matches the product's status
      if (updatedProduct.status === 'TAKEN' || updatedProduct.is_taken) {
        setStatusFilter('TAKEN');
        setCurrentPage(1);
      } else {
        setStatusFilter(updatedProduct.status);
        setCurrentPage(1);
      }
    } catch (error: any) {
      console.error('Error saving product:', error);
      window.alert(error.response?.data?.detail || 'Failed to save product');
    }
  };

  const handleSetStatus = async (product: Product, status: string) => {
    try {
      // If setting status to TAKEN, also mark as taken
      // If setting status to something else and product was taken, mark as not taken
      if (status === 'TAKEN') {
        // First mark as taken, then set status
        await productsApi.markAsTaken(product.id);
        await productsApi.setStatus(product.id, status);
      } else if (product.is_taken && status !== 'TAKEN') {
        // If product was taken and we're changing to a different status, we need to handle this
        // The API might need a way to unmark as taken, or we just set the status
        await productsApi.setStatus(product.id, status);
      } else {
        await productsApi.setStatus(product.id, status);
      }
      
      const updatedProduct = await productsApi.get(product.id);
      
      // Switch to the appropriate tab based on status
      if (status === 'TAKEN' || updatedProduct.is_taken) {
        setStatusFilter('TAKEN');
      } else {
        // Switch to the status tab that matches the updated status
        setStatusFilter(status);
      }
      setCurrentPage(1);
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
      header: 'Owner',
      render: (product: Product) => {
        if (!product.owner) {
          return <span className="text-xs text-gray-400">No owner</span>;
        }
        
        // Handle case where owner is just an ID (number)
        let ownerUser: User | null = null;
        if (typeof product.owner === 'number') {
          // Look up the owner from the users list
          ownerUser = users.find(u => u.id === product.owner) || null;
          if (!ownerUser) {
            return <span className="text-xs text-gray-400">Owner ID: {product.owner}</span>;
          }
        } else {
          // Owner is already a User object
          ownerUser = product.owner;
        }
        
        // Check if ownerUser has the expected properties
        if (!ownerUser || typeof ownerUser !== 'object' || !('name' in ownerUser)) {
          return <span className="text-xs text-gray-400">Invalid owner data</span>;
        }
        
        return (
          <div className="flex items-center gap-2">
            {ownerUser.avatar && (
              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-300 flex-shrink-0">
                <Image
                  src={getImageUrl(ownerUser.avatar)}
                  alt={ownerUser.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <span className="text-xs font-medium text-gray-900">{ownerUser.name}</span>
          </div>
        );
      },
    },
    {
      key: 'owner_verification',
      header: 'Owner Verification',
      render: (product: Product) => {
        if (!product.owner) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        
        // Always get the latest user data from the users list to ensure verification status is up-to-date
        let ownerUser: User | null = null;
        let ownerId: number | null = null;
        
        // Get the owner ID
        if (typeof product.owner === 'number') {
          ownerId = product.owner;
        } else if (typeof product.owner === 'object' && 'id' in product.owner) {
          ownerId = product.owner.id;
        }
        
        if (!ownerId) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        
        // Always look up from the users list to get the latest verification status
        // This ensures the verification status matches what's shown in the users page
        ownerUser = users.find(u => u.id === ownerId) || null;
        
        // Fallback to product.owner if not found in users list (shouldn't happen, but just in case)
        if (!ownerUser && typeof product.owner === 'object' && 'admin_verified' in product.owner) {
          ownerUser = product.owner as User;
        }
        
        if (!ownerUser || typeof ownerUser !== 'object' || !('admin_verified' in ownerUser)) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        
        // Use the admin_verified status from the users list (source of truth)
        const isVerified = ownerUser.admin_verified;
        
        return (
          <span className={`text-xs px-2 py-1 rounded inline-block ${
            isVerified
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isVerified ? 'Verified' : 'Unverified'}
          </span>
        );
      },
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
              {statusFilter && (
                <span className="inline-block mr-2">
                  Showing: <span className="font-medium">{statusFilter} Products</span>
                  {statusFilter !== 'TAKEN' && <span className="text-gray-500"> (excluding taken)</span>}
                </span>
              )}
              {!statusFilter && (
                <span className="inline-block mr-2">Showing: <span className="font-medium">All Products</span></span>
              )}
              | Total: {totalItems} | Page {currentPage} of {totalPages}
            </div>
          )}
          
          {/* Filter Tabs */}
          <div className="mb-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              <button
                onClick={() => {
                  setStatusFilter(null);
                  setCurrentPage(1);
                }}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  statusFilter === null
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All
              </button>
              {PRODUCT_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setCurrentPage(1);
                  }}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    statusFilter === status
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </nav>
          </div>

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
            isLoading={loading}
            actions={(product: Product) => (
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === product.id ? null : product.id)}
                  className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                  aria-label="Actions"
                >
                  <MoreVertical className="h-4 w-4 text-gray-600" />
                </button>
                {openDropdown === product.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenDropdown(null)}
                    />
                    <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            window.location.href = `/products/${product.id}`;
                            setOpenDropdown(null);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </button>
                        <button
                          onClick={() => {
                            handleEdit(product);
                            setOpenDropdown(null);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <div className="px-4 py-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Status
                          </label>
                          <Select
                            value={product.status}
                            onChange={(e) => {
                              handleSetStatus(product, e.target.value);
                              setOpenDropdown(null);
                            }}
                            options={PRODUCT_STATUSES.map(s => ({ value: s, label: s }))}
                            className="w-full text-sm"
                          />
                        </div>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this product?')) {
                              handleDelete(product);
                            }
                            setOpenDropdown(null);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
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
            {editingProduct && editingProduct.owner && (() => {
              // Handle owner - could be User object or number (ID)
              let ownerUser: User | null = null;
              if (typeof editingProduct.owner === 'number') {
                ownerUser = users.find(u => u.id === editingProduct.owner) || null;
              } else if (typeof editingProduct.owner === 'object' && 'name' in editingProduct.owner) {
                ownerUser = editingProduct.owner as User;
              }
              
              if (!ownerUser) {
                return (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Owner Information
                    </label>
                    <p className="text-sm text-gray-600">
                      {typeof editingProduct.owner === 'number' 
                        ? `Owner ID: ${editingProduct.owner}` 
                        : 'Owner information not available'}
                    </p>
                  </div>
                );
              }
              
              return (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Owner Information
                  </label>
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

