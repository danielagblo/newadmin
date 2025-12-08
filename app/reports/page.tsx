'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { reportsApi } from '@/lib/api/reports';
import { ProductReport } from '@/lib/types';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export default function ReportsPage() {
    const [reports, setReports] = useState<ProductReport[]>([]);
    const [rawReports, setRawReports] = useState<ProductReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const [selectedReport, setSelectedReport] = useState<ProductReport | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { page: currentPage };
            const data = await reportsApi.list(params);

            if (Array.isArray(data)) {
                setRawReports(data);
                setReports(data);
                setTotalItems(data.length);
                setTotalPages(1);
            } else {
                const pag = data as any;
                setRawReports(pag.results || []);
                setReports(pag.results || []);
                setTotalItems(pag.count || 0);
                setTotalPages(Math.max(1, Math.ceil((pag.count || 0) / 20)));
            }
        } catch (err: any) {
            console.error('Error fetching reports:', err);
            setError(err?.response?.data?.detail || err?.message || 'Failed to fetch reports');
            setReports([]);
            setRawReports([]);
            setTotalItems(0);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [currentPage]);

    useEffect(() => { fetchReports(); }, [fetchReports]);

    const handleView = (r: ProductReport) => { setSelectedReport(r); setIsModalOpen(true); };

    const columns = [
        { key: 'id', header: 'ID' },
        { key: 'product', header: 'Product', render: (r: ProductReport) => (typeof r.product === 'number' ? `#${r.product}` : r.product?.name || '-') },
        {
            key: 'owner', header: 'Owner', render: (r: ProductReport) => {
                const prod = typeof r.product === 'number' ? null : (r.product as any);
                return prod?.owner?.name || (prod?.owner ? `#${prod.owner}` : '-');
            }
        },
        { key: 'user', header: 'Reporter', render: (r: ProductReport) => (typeof r.user === 'number' ? `#${r.user}` : (r.user as any)?.name || '-') },
        { key: 'reason', header: 'Reason', render: (r: ProductReport) => r.reason || '-' },
        { key: 'message', header: 'Message', render: (r: ProductReport) => (r.message ? (r.message.length > 80 ? r.message.substring(0, 77) + '...' : r.message) : '-') },
        { key: 'created_at', header: 'Created', render: (r: ProductReport) => format(new Date(r.created_at), 'MMM dd, yyyy') },
    ];

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">Product Reports</h1>
                    <div className="text-sm text-gray-600">Total: {totalItems}</div>
                </div>

                <div className="bg-white rounded-lg shadow">
                    <DataTable
                        data={reports}
                        columns={columns}
                        isLoading={loading}
                        actions={(r: ProductReport) => (
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleView(r)} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded" title="View">
                                    <Eye className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    />

                    {totalPages > 1 && (
                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} itemsPerPage={20} />
                    )}

                    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedReport ? `Report #${selectedReport.id}` : 'Report'} size="md">
                        {selectedReport && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-500">Reason</p>
                                        <p className="font-medium">{selectedReport.reason}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Owner</p>
                                        <p className="font-medium">{(typeof selectedReport.product === 'number') ? '-' : ((selectedReport.product as any)?.owner?.name || ((selectedReport.product as any)?.owner ? `#${(selectedReport.product as any).owner}` : '-'))}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Message</p>
                                    <div className="mt-1 p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">{selectedReport.message || '-'}</div>
                                </div>
                                <div className="text-xs text-gray-500">Created: {format(new Date(selectedReport.created_at), 'PPP p')}</div>
                                <div className="flex justify-end"><Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button></div>
                            </div>
                        )}
                    </Modal>
                </div>
            </div>
        </Layout>
    );
}
