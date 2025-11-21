'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { subscriptionsApi } from '@/lib/api/subscriptions';
import { Subscription, SUBSCRIPTION_TIERS } from '@/lib/types';
import { format } from 'date-fns';
import { Briefcase, Check, Crown, Plus, Sparkles, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [formData, setFormData] = useState<{
    name: string;
    tier: 'BASIC' | 'BUSINESS' | 'PLATINUM';
    price: string;
    original_price: string;
    multiplier: string;
    discount_percentage: string;
    duration_days: number;
    description: string;
    features: string;
    max_products: number;
    is_active: boolean;
  }>({
    name: '',
    tier: 'BASIC',
    price: '',
    original_price: '',
    multiplier: '',
    discount_percentage: '',
    duration_days: 30,
    description: '',
    features: '',
    max_products: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchSubscriptions();
  }, [searchTerm, tierFilter, activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSubscriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        ordering: 'tier,price', // Order by tier then price
      };
      
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      if (activeFilter !== 'all') {
        params.is_active = activeFilter === 'active';
      }
      
      const data = await subscriptionsApi.list(params);
      const subscriptionsArray = Array.isArray(data) ? data : [];
      
      // Client-side filtering for tier if needed (since API might not support it)
      let filteredSubscriptions = subscriptionsArray;
      if (tierFilter !== 'all') {
        filteredSubscriptions = subscriptionsArray.filter(s => s.tier === tierFilter);
      }
      
      setSubscriptions(filteredSubscriptions);
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error);

      let errorMessage = 'Failed to fetch subscriptions';
      let errorDetails = '';

      if (error?.response?.status === 404) {
        errorMessage = 'Subscriptions endpoint not found (404)';
        errorDetails = `The subscriptions API endpoint does not exist on your Django backend.\n\n` +
          `Expected endpoint: /api-v1/subscriptions/\n\n` +
          `Please create the subscriptions endpoint in your Django backend.`;
      } else if (error?.response?.status === 401) {
        errorMessage = 'Authentication failed (401)';
        errorDetails = 'Please log out and log in again.';
      } else if (error?.response?.status === 403) {
        errorMessage = 'Access denied (403)';
        errorDetails = 'You may not have permission to view subscriptions.';
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
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSubscription(null);
    setFormData({
      name: '',
      tier: 'BASIC',
      price: '',
      original_price: '',
      multiplier: '',
      discount_percentage: '',
      duration_days: 30,
      description: '',
      features: '',
      max_products: 0,
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      name: subscription.name,
      tier: subscription.tier,
      price: subscription.price,
      original_price: subscription.original_price || '',
      multiplier: subscription.multiplier || '',
      discount_percentage: subscription.discount_percentage || '',
      duration_days: subscription.duration_days,
      description: subscription.description || '',
      features: subscription.features || (subscription.features_list ? subscription.features_list.join(', ') : ''),
      max_products: subscription.max_products || 0,
      is_active: subscription.is_active,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (subscription: Subscription) => {
    if (!window.confirm(`Are you sure you want to delete subscription "${subscription.name}"?`)) {
      return;
    }
    try {
      await subscriptionsApi.delete(subscription.id);
      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error deleting subscription:', error);
      window.alert(error?.response?.data?.detail || 'Failed to delete subscription');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData: any = {
        name: formData.name,
        tier: formData.tier,
        price: formData.price,
        original_price: formData.original_price || null,
        multiplier: formData.multiplier || null,
        discount_percentage: formData.discount_percentage || null,
        duration_days: formData.duration_days,
        description: formData.description || null,
        features: formData.features || null,
        max_products: formData.max_products || 0,
        is_active: formData.is_active,
      };
      if (editingSubscription) {
        await subscriptionsApi.update(editingSubscription.id, submitData);
      } else {
        await subscriptionsApi.create(submitData);
      }
      setIsModalOpen(false);
      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error saving subscription:', error);
      window.alert(error?.response?.data?.detail || 'Failed to save subscription');
    }
  };

  // Group subscriptions by tier
  const basicSubscriptions = subscriptions.filter(s => s.tier === 'BASIC');
  const businessSubscriptions = subscriptions.filter(s => s.tier === 'BUSINESS');
  const platinumSubscriptions = subscriptions.filter(s => s.tier === 'PLATINUM');

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    {
      key: 'tier',
      header: 'Tier',
      render: (sub: Subscription) => {
        const tierConfig = {
          BASIC: { color: 'bg-gray-100 text-gray-800', icon: Sparkles },
          BUSINESS: { color: 'bg-blue-100 text-blue-800', icon: Briefcase },
          PLATINUM: { color: 'bg-purple-100 text-purple-800', icon: Crown },
        };
        const config = tierConfig[sub.tier];
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${config.color}`}>
              <Icon className="h-3 w-3" />
              {sub.tier}
            </span>
            {sub.multiplier && (
              <span className="text-xs text-gray-500">{sub.multiplier}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'price',
      header: 'Price',
      render: (sub: Subscription) => (
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">₵{parseFloat(sub.price).toLocaleString()}</span>
          {sub.original_price && (
            <span className="text-xs text-gray-400 line-through">₵{parseFloat(sub.original_price).toLocaleString()}</span>
          )}
          {sub.discount_percentage && (
            <span className="text-xs text-green-600 font-semibold">{parseFloat(sub.discount_percentage).toFixed(0)}% off</span>
          )}
          {sub.effective_price && sub.effective_price !== sub.price && (
            <span className="text-xs text-blue-600">(Effective: ₵{parseFloat(sub.effective_price).toLocaleString()})</span>
          )}
        </div>
      ),
    },
    {
      key: 'duration_days',
      header: 'Duration',
      render: (sub: Subscription) => `${sub.duration_days} days`,
    },
    {
      key: 'max_products',
      header: 'Max Products',
      render: (sub: Subscription) => sub.max_products || 'Unlimited',
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (sub: Subscription) => (
        <span className={`px-2 py-1 rounded text-xs ${sub.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
          {sub.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (sub: Subscription) => format(new Date(sub.created_at), 'MMM dd, yyyy'),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Subscriptions</h1>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Subscription
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Subscriptions</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={fetchSubscriptions}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Three Tiers Display - Matching Mobile App Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Basic Tier */}
          <div className="bg-white rounded-lg shadow-lg border-2 border-gray-300 p-6 relative">
            {basicSubscriptions.some(s => s.discount_percentage && parseFloat(s.discount_percentage) > 0) && (
              <div className="absolute top-2 right-2 bg-gray-800 text-white px-2 py-1 text-xs font-semibold rounded">
                For you {basicSubscriptions.find(s => s.discount_percentage && parseFloat(s.discount_percentage) > 0)?.discount_percentage}% off
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-gray-600" />
                <h3 className="text-xl font-bold text-gray-900">Basic</h3>
              </div>
            </div>
            <div className="space-y-4 mb-4">
              {basicSubscriptions.length > 0 ? (
                basicSubscriptions.map((sub) => {
                  const features = sub.features_list || 
                    (typeof sub.features === 'string'
                      ? sub.features.split(',').map((f: string) => f.trim()).filter(f => f)
                      : []);
                  return (
                    <div key={sub.id} className="border-b border-gray-200 pb-4 last:border-0">
                      <div className="font-semibold text-gray-900 mb-2">{sub.name}</div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-bold text-gray-900">₵{parseFloat(sub.price).toLocaleString()}</span>
                        {sub.original_price && (
                          <span className="text-sm text-gray-400 line-through">₵{parseFloat(sub.original_price).toLocaleString()}</span>
                        )}
                        {sub.discount_percentage && (
                          <span className="text-xs text-green-600 font-semibold">{parseFloat(sub.discount_percentage).toFixed(0)}% off</span>
                        )}
                        {sub.effective_price && sub.effective_price !== sub.price && (
                          <span className="text-xs text-blue-600">(Effective: ₵{parseFloat(sub.effective_price).toLocaleString()})</span>
                        )}
                      </div>
                      {features.length > 0 && (
                        <div className="space-y-1 mt-3">
                          {features.map((feature: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No Basic subscriptions</p>
              )}
            </div>
          </div>

          {/* Business Tier */}
          <div className="bg-white rounded-lg shadow-lg border-2 border-blue-500 p-6 relative">
            <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg">
              POPULAR
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">Business</h3>
              </div>
            </div>
            <div className="space-y-4 mb-4">
              {businessSubscriptions.length > 0 ? (
                businessSubscriptions.map((sub) => {
                  const features = sub.features_list || 
                    (typeof sub.features === 'string'
                      ? sub.features.split(',').map((f: string) => f.trim()).filter(f => f)
                      : []);
                  return (
                    <div key={sub.id} className="border-b border-gray-200 pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-gray-900">{sub.name}</div>
                        {sub.multiplier && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {sub.multiplier}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-bold text-gray-900">₵{parseFloat(sub.price).toLocaleString()}</span>
                        {sub.original_price && (
                          <span className="text-sm text-gray-400 line-through">₵{parseFloat(sub.original_price).toLocaleString()}</span>
                        )}
                        {sub.discount_percentage && (
                          <span className="text-xs text-green-600 font-semibold">{parseFloat(sub.discount_percentage).toFixed(0)}% off</span>
                        )}
                        {sub.effective_price && sub.effective_price !== sub.price && (
                          <span className="text-xs text-blue-600">(Effective: ₵{parseFloat(sub.effective_price).toLocaleString()})</span>
                        )}
                      </div>
                      {features.length > 0 && (
                        <div className="space-y-1 mt-3">
                          {features.map((feature: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No Business subscriptions</p>
              )}
            </div>
          </div>

          {/* Platinum Tier */}
          <div className="bg-white rounded-lg shadow-lg border-2 border-purple-500 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-purple-600" />
                <h3 className="text-xl font-bold text-gray-900">Platinum</h3>
              </div>
            </div>
            <div className="space-y-4 mb-4">
              {platinumSubscriptions.length > 0 ? (
                platinumSubscriptions.map((sub) => {
                  const features = sub.features_list || 
                    (typeof sub.features === 'string'
                      ? sub.features.split(',').map((f: string) => f.trim()).filter(f => f)
                      : []);
                  return (
                    <div key={sub.id} className="border-b border-gray-200 pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-gray-900">{sub.name}</div>
                        {sub.multiplier && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {sub.multiplier}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-bold text-gray-900">₵{parseFloat(sub.price).toLocaleString()}</span>
                        {sub.original_price && (
                          <span className="text-sm text-gray-400 line-through">₵{parseFloat(sub.original_price).toLocaleString()}</span>
                        )}
                        {sub.discount_percentage && (
                          <span className="text-xs text-green-600 font-semibold">{parseFloat(sub.discount_percentage).toFixed(0)}% off</span>
                        )}
                        {sub.effective_price && sub.effective_price !== sub.price && (
                          <span className="text-xs text-blue-600">(Effective: ₵{parseFloat(sub.effective_price).toLocaleString()})</span>
                        )}
                      </div>
                      {features.length > 0 && (
                        <div className="space-y-1 mt-3">
                          {features.map((feature: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No Platinum subscriptions</p>
              )}
            </div>
          </div>
        </div>

        {/* All Subscriptions Table */}
        <div className="bg-white rounded-lg shadow p-6">
          {!error && (
            <div className="mb-4 flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search subscriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="w-40"
                options={[
                  { value: 'all', label: 'All Tiers' },
                  { value: 'BASIC', label: 'Basic' },
                  { value: 'BUSINESS', label: 'Business' },
                  { value: 'PLATINUM', label: 'Platinum' },
                ]}
              />
              <Select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="w-40"
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
              <div className="text-sm text-gray-600">
                Total: {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
          <DataTable
            data={subscriptions}
            columns={columns}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={loading}
          />
        </div>

        {/* Create/Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingSubscription ? 'Edit Subscription' : 'Create Subscription'}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Subscription name"
            />

            <Select
              label="Tier"
              required
              value={formData.tier}
              onChange={(e) => setFormData({ ...formData, tier: e.target.value as 'BASIC' | 'BUSINESS' | 'PLATINUM' })}
              options={SUBSCRIPTION_TIERS.map(tier => ({ value: tier, label: tier }))}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Price (GHS)"
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
              />
              <Input
                label="Original Price (GHS) - for strikethrough"
                type="number"
                step="0.01"
                value={formData.original_price}
                onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Multiplier (e.g., 1.5x, 4x, 10x)"
                value={formData.multiplier}
                onChange={(e) => setFormData({ ...formData, multiplier: e.target.value })}
                placeholder="1.5x"
              />
              <Input
                label="Discount Percentage"
                type="text"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <Input
              label="Duration (Days)"
              type="number"
              required
              value={formData.duration_days}
              onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) || 30 })}
              placeholder="30"
            />

            <Textarea
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Subscription description"
              rows={3}
            />

            <Textarea
              label="Features (comma-separated)"
              value={formData.features}
              onChange={(e) => setFormData({ ...formData, features: e.target.value })}
              placeholder="Feature 1, Feature 2, Feature 3"
              rows={3}
            />

            <Input
              label="Max Products (0 for unlimited)"
              type="number"
              value={formData.max_products}
              onChange={(e) => setFormData({ ...formData, max_products: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />

            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingSubscription ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}

