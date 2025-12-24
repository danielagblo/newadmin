"use client";

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { apiClient } from '@/lib/api/config';
import { usersApi } from '@/lib/api/users';
import { User } from '@/lib/types';
import { useEffect, useState } from 'react';

export default function ReinstateCouponRedemptionPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await usersApi.list();
            // Only include regular users (exclude staff and superusers)
            // Also exclude users who already can redeem coupons (can_redeem_coupon === true)
            const regular = data.filter((u: User) =>
                !u.is_staff && !u.is_superuser && !((u as any).can_redeem_coupon === true)
            );
            setUsers(regular);
        } catch (err) {
            console.error('Error fetching users', err);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const toggle = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const reinstate = async () => {
        if (selected.size === 0) return;
        if (!confirm('Unlock coupon redemption for selected users?')) return;
        setSubmitting(true);
        try {
            await apiClient.post('/admin/reinstate-coupon-redemption/', {
                user_ids: Array.from(selected),
            });
            window.alert('Successfully reinstated redemption for selected users');
            setSelected(new Set());
        } catch (err) {
            console.error('Reinstate error', err);
            window.alert('Failed to reinstate');
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        {
            key: 'select',
            header: '',
            render: (u: User) => (
                <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="h-4 w-4"
                />
            ),
        },
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name', render: (u: User) => u.name || '—' },
        { key: 'email', header: 'Email' },
    ];

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">Reinstate Coupon Redemption</h1>
                    <div>
                        <Button onClick={reinstate} disabled={selected.size === 0 || submitting}>
                            Reinstate Redemption
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <DataTable data={users} columns={columns as any} isLoading={loading} />
                </div>
            </div>
        </Layout>
    );
}
