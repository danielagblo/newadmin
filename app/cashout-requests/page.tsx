"use client";

"use client";

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { apiClient } from '@/lib/api/config';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

type UserSummary = {
    id: number;
    email?: string;
    name?: string;
    phone?: string;
};

type Cashout = {
    id: number;
    user: UserSummary;
    amount: string;
    momo_number?: string;
    momo_network?: string;
    status: string;
    note?: string;
    provider?: string;
    processed_at?: string | null;
    created_at: string;
};

export default function CashoutRequestsPage() {
    const [requests, setRequests] = useState<Cashout[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/cashout-requests/');
            const data = res.data;
            setRequests(Array.isArray(data) ? data : data.results || []);
        } catch (err) {
            console.error('Error fetching cashout requests', err);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const performAction = async (id: number, action: 'approve' | 'reject') => {
        if (!window.confirm(`Are you sure you want to ${action} request #${id}?`)) return;
        try {
            await apiClient.post(`/cashout-requests/${id}/${action}/`);
            await fetchRequests();
        } catch (err) {
            console.error(`${action} error`, err);
            window.alert(`Failed to ${action} request`);
        }
    };

    const columns = [
        { key: 'id', header: 'ID' },
        {
            key: 'user',
            header: 'User',
            render: (r: Cashout) => (
                <div>
                    <div className="font-medium">{r.user?.name || r.user?.email || '—'}</div>
                    <div className="text-xs text-gray-500">{r.user?.email || r.user?.phone || ''}</div>
                </div>
            ),
        },
        { key: 'amount', header: 'Amount' },
        { key: 'momo_number', header: 'Momo' },
        { key: 'momo_network', header: 'Network' },
        { key: 'status', header: 'Status' },
        {
            key: 'created_at',
            header: 'Created',
            render: (r: Cashout) => format(new Date(r.created_at), 'MMM dd, yyyy'),
        },
    ];

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">Cashout Requests</h1>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <DataTable
                        data={requests}
                        columns={columns as any}
                        isLoading={loading}
                        actions={(r: Cashout) => (
                            <>
                                <Button size="sm" onClick={() => performAction(r.id, 'approve')}>Approve</Button>
                                <Button size="sm" variant="danger" onClick={() => performAction(r.id, 'reject')}>Reject</Button>
                            </>
                        )}
                    />
                </div>
            </div>
        </Layout>
    );
}
