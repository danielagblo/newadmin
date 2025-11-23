'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
// No create form — admin-only approve/reject UI
import { accountDeleteRequestsApi } from '@/lib/api/accountDeleteRequests';
import { AccountDeleteRequest } from '@/lib/types';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

export default function AccountDeleteRequestsPage() {
    const [items, setItems] = useState<AccountDeleteRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | ''>('');
    const [search, setSearch] = useState('');

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (statusFilter) params.status = statusFilter;
            if (search) params.search = search;
            const data = await accountDeleteRequestsApi.list(params);
            setItems(data);
        } catch (err) {
            console.error('Error fetching account delete requests:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, search]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);


    // Creation of requests from frontend is disabled — admin UI only approves/rejects existing requests.

    const handleApprove = async (id: number) => {
        const admin_reason = window.prompt('Optional admin reason/comment') || null;
        setSubmitting(true);
        try {
            await accountDeleteRequestsApi.approve(id, admin_reason ? { reason: admin_reason } : undefined);
            await fetchItems();
            window.alert('Request approved');
        } catch (err: any) {
            console.error('Error approving request:', err);
            const msg = err?.response?.data || err?.message || String(err);
            window.alert('Failed to approve: ' + JSON.stringify(msg));
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async (id: number) => {
        const admin_reason = window.prompt('Optional admin reason/comment') || null;
        setSubmitting(true);
        try {
            await accountDeleteRequestsApi.reject(id, admin_reason ? { reason: admin_reason } : undefined);
            await fetchItems();
            window.alert('Request rejected');
        } catch (err: any) {
            console.error('Error rejecting request:', err);
            const msg = err?.response?.data || err?.message || String(err);
            window.alert('Failed to reject: ' + JSON.stringify(msg));
        } finally {
            setSubmitting(false);
        }
    };

    // Note: update via PATCH removed — using approve/reject POST endpoints instead

    const columns = [
        { key: 'id', header: 'ID' },
        {
            key: 'user',
            header: 'User',
            render: (row: AccountDeleteRequest) => {
                const u: any = (row as any).user;
                if (!u) return '-';
                if (typeof u === 'object') return u.name || u.email || `User ${u.id}`;
                return `User ${u}`;
            },
        },
        { key: 'reason', header: 'Reason' },
        { key: 'status', header: 'Status' },
        { key: 'admin_comment', header: 'Admin Comment' },
        {
            key: 'created_at',
            header: 'Created',
            render: (row: AccountDeleteRequest) => {
                return row.created_at ? format(new Date(row.created_at), 'MMM dd, yyyy HH:mm') : '-';
            },
        },
        {
            key: 'processed_at',
            header: 'Processed',
            render: (row: AccountDeleteRequest) => {
                return row.processed_at ? format(new Date(row.processed_at), 'MMM dd, yyyy HH:mm') : '-';
            },
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (row: AccountDeleteRequest) => {
                if (row.status === 'PENDING') {
                    return (
                        <div className="flex gap-2">
                            <Button onClick={() => handleApprove(row.id)} disabled={submitting}>
                                Approve
                            </Button>
                            <Button onClick={() => handleReject(row.id)} disabled={submitting}>
                                Reject
                            </Button>
                        </div>
                    );
                }
                return <span>-</span>;
            },
        },
    ];

    return (
        <Layout>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-gray-900">Account Delete Requests</h1>

                <div className="bg-white rounded-lg shadow p-6">
                    {/* Create form removed - requests are submitted elsewhere; this admin UI handles approve/reject only */}

                    <div>
                        <h2 className="font-semibold mb-2">All Requests</h2>
                        <DataTable data={items} columns={columns} isLoading={loading} />
                    </div>
                </div>
            </div>
        </Layout>
    );
}
