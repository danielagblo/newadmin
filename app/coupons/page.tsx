'use client';

import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { couponsApi } from '@/lib/api/coupons';
import { Coupon, DISCOUNT_TYPES } from '@/lib/types';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState<{
    code: string;
    description: string;
    discount_type: 'percent' | 'fixed';
    discount_value: string;
    max_uses: string;
    per_user_limit: string;
    valid_from: string;
    valid_until: string;
    is_active: boolean;
  }>({
    code: '',
    description: '',
    discount_type: 'percent',
    discount_value: '',
    max_uses: '',
    per_user_limit: '',
    valid_from: '',
    valid_until: '',
    is_active: true,
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await couponsApi.list();
      setCoupons(data);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      description: '',
      discount_type: 'percent',
      discount_value: '',
      max_uses: '',
      per_user_limit: '',
      valid_from: '',
      valid_until: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    // Convert discount_type from API format (PERCENT/FIXED) to form format (percent/fixed)
    const discountType = coupon.discount_type?.toLowerCase() === 'percent' || coupon.discount_type === 'PERCENT' 
      ? 'percent' 
      : 'fixed';
    
    setFormData({
      code: coupon.code,
      description: 'description' in coupon ? (coupon as any).description || '' : '',
      discount_type: discountType,
      discount_value: coupon.discount_value,
      max_uses: coupon.max_uses?.toString() || '',
      per_user_limit: coupon.per_user_limit?.toString() || '',
      valid_from: coupon.valid_from ? format(new Date(coupon.valid_from), "yyyy-MM-dd'T'HH:mm") : '',
      valid_until: coupon.valid_until ? format(new Date(coupon.valid_until), "yyyy-MM-dd'T'HH:mm") : '',
      is_active: coupon.is_active,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (coupon: Coupon) => {
    try {
      await couponsApi.delete(coupon.id);
      fetchCoupons();
    } catch (error) {
      console.error('Error deleting coupon:', error);
      window.alert('Failed to delete coupon');
    }
  };

  const handleExpire = async (coupon: Coupon) => {
    try {
      await couponsApi.expire(coupon.id);
      fetchCoupons();
    } catch (error) {
      console.error('Error expiring coupon:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData: any = {
        ...formData,
        discount_value: parseFloat(formData.discount_value),
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : undefined,
        per_user_limit: formData.per_user_limit ? parseInt(formData.per_user_limit) : undefined,
        valid_from: formData.valid_from || undefined,
        valid_until: formData.valid_until || undefined,
      };
      if (editingCoupon) {
        await couponsApi.update(editingCoupon.id, submitData);
      } else {
        await couponsApi.create(submitData);
      }
      setIsModalOpen(false);
      fetchCoupons();
    } catch (error: any) {
      console.error('Error saving coupon:', error);
      window.alert(error.response?.data?.detail || 'Failed to save coupon');
    }
  };

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'code', header: 'Code' },
    {
      key: 'discount_type',
      header: 'Type',
      render: (coupon: Coupon) => (
        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
          {coupon.discount_type}
        </span>
      ),
    },
    {
      key: 'discount_value',
      header: 'Value',
      render: (coupon: Coupon) =>
        coupon.discount_type === 'percent' ? `${coupon.discount_value}%` : `GHS ${coupon.discount_value}`,
    },
    { key: 'uses', header: 'Uses' },
    {
      key: 'remaining_uses',
      header: 'Remaining',
      render: (coupon: Coupon) => coupon.remaining_uses ?? 'Unlimited',
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (coupon: Coupon) => (
        <span className={`px-2 py-1 rounded text-xs ${
          coupon.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {coupon.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (coupon: Coupon) => format(new Date(coupon.created_at), 'MMM dd, yyyy'),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Coupons</h1>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Coupon
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <DataTable
            data={coupons}
            columns={columns}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isLoading={loading}
            actions={(coupon: Coupon) => (
              coupon.is_active && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExpire(coupon)}
                >
                  Expire
                </Button>
              )
            )}
          />
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Code"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            />
            <Textarea
              label="Description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Discount Type"
                required
                value={formData.discount_type}
                onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                options={DISCOUNT_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
              />
              <Input
                label="Discount Value"
                type="number"
                step="0.01"
                required
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Max Uses"
                type="number"
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
              />
              <Input
                label="Per User Limit"
                type="number"
                value={formData.per_user_limit}
                onChange={(e) => setFormData({ ...formData, per_user_limit: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Valid From"
                type="datetime-local"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
              />
              <Input
                label="Valid Until"
                type="datetime-local"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                Active
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
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}

