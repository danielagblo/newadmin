'use client';

import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { paymentsApi } from '@/lib/api/payments';
import { Payment } from '@/lib/types';
import { format } from 'date-fns';
import { CreditCard } from 'lucide-react';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'SUCCESS' | 'FAILED'>('all');

  useEffect(() => {
    fetchAllPayments();
  }, []);

  const fetchAllPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const first = await paymentsApi.list();
      let all: Payment[] = [];

      if (Array.isArray(first)) {
        all = first as Payment[];
      } else if (first && (first as any).results) {
        // paginated
        const pag = first as any;
        all = Array.isArray(pag.results) ? pag.results.slice() : [];
        let currentPage = 2;
        let hasMore = !!pag.next;
        while (hasMore && currentPage <= 50) {
          try {
            const nextPage = await paymentsApi.list({ page: currentPage });
            if (nextPage && (nextPage as any).results && Array.isArray((nextPage as any).results)) {
              all.push(...(nextPage as any).results);
              hasMore = !!(nextPage as any).next;
              currentPage++;
            } else {
              hasMore = false;
            }
          } catch (err) {
            console.error('Error fetching payments page', currentPage, err);
            hasMore = false;
          }
        }
      }

      setPayments(all);
    } catch (err: any) {
      console.error('Error fetching payments:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = payments.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search && !String(p.reference || p.user || p.amount || p.provider).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'user', header: 'User' },
    { key: 'subscription', header: 'Subscription' },
    { key: 'amount', header: 'Amount' },
    { key: 'currency', header: 'Currency' },
    { key: 'provider', header: 'Provider' },
    { key: 'reference', header: 'Reference' },
    {
      key: 'status',
      header: 'Status',
      render: (p: Payment) => {
        const cls = p.status === 'SUCCESS' ? 'bg-green-100 text-green-800' : p.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
        return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{p.status}</span>;
      },
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (p: Payment) => {
        try {
          return format(new Date(p.created_at), 'MMM dd, yyyy HH:mm');
        } catch {
          return '-';
        }
      },
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-gray-700" />
            <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Search reference, provider, user..." value={search} onChange={(e:any)=>setSearch(e.target.value)} className="w-80" />
            <Select value={statusFilter} onChange={(e:any)=>setStatusFilter(e.target.value)} options={[{value:'all', label:'All'},{value:'PENDING', label:'Pending'},{value:'SUCCESS', label:'Success'},{value:'FAILED', label:'Failed'}]} />
            <button className="btn btn-outline" onClick={fetchAllPayments}>Refresh</button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error Loading Payments</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <DataTable data={filtered} columns={columns} isLoading={loading} />
        </div>
      </div>
    </Layout>
  );
}
