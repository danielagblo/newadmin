'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import apiClient from '@/lib/api/config';
import { jobApplicationsApi } from '@/lib/api/jobApplications';
import { JobApplication } from '@/lib/types';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function JobApplicationsPage() {
    const [apps, setApps] = useState<JobApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchApps = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await jobApplicationsApi.list();
            let list: JobApplication[] = [];
            if (Array.isArray(data)) list = data;
            else list = data.results || [];
            setApps(list);
            setTotalItems(list.length);
            setTotalPages(Math.max(1, Math.ceil(list.length / 20)));
        } catch (err: any) {
            console.error('Error fetching job applications', err);
            setError(err?.response?.data?.detail || err?.message || 'Failed to load applications');
        } finally {
            setLoading(false);
        }
    }, []);

    // Helper to fetch a file with auth headers and open in new tab
    const openResume = async (resumePath: string) => {
        const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const fullUrl = resumePath.startsWith('http') ? resumePath : `${base}${resumePath}`;
        // Use apiClient so Authorization header is included via interceptor
        const resp = await apiClient.get(fullUrl, { responseType: 'blob' as any });
        const contentType = resp.headers['content-type'] || 'application/octet-stream';
        const blob = new Blob([resp.data], { type: contentType });
        const objectUrl = URL.createObjectURL(blob);
        // Open in new tab
        const newWindow = window.open(objectUrl, '_blank');
        if (!newWindow) {
            // If popup blocked, fallback to triggering download
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = getFileNameFromPath(resumePath) || 'resume';
            document.body.appendChild(a);
            a.click();
            a.remove();
        }
        // Revoke URL after some time
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
    };

    const downloadResume = async (resumePath: string) => {
        const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const fullUrl = resumePath.startsWith('http') ? resumePath : `${base}${resumePath}`;
        const resp = await apiClient.get(fullUrl, { responseType: 'blob' as any });
        const contentType = resp.headers['content-type'] || 'application/octet-stream';
        const blob = new Blob([resp.data], { type: contentType });
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = getFileNameFromPath(resumePath) || 'resume';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
    };

    const getFileNameFromPath = (path: string) => {
        try {
            const p = path.split('/').pop();
            if (!p) return null;
            // strip query
            return p.split('?')[0];
        } catch (err) {
            return null;
        }
    };

    useEffect(() => {
        fetchApps();
    }, [fetchApps]);

    const columns = useMemo(() => [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name' },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: 'Phone' },
        { key: 'location', header: 'Location' },
        { key: 'gender', header: 'Gender' },
        {
            key: 'dob',
            header: 'DOB',
            render: (app: JobApplication) => app.dob ? format(new Date(app.dob), 'MMM dd, yyyy') : '-',
        },
        {
            key: 'resume',
            header: 'Resume',
            render: (app: JobApplication) => (
                app.resume ? (
                    <button
                        onClick={async () => {
                            try {
                                await openResume(app.resume!);
                            } catch (err) {
                                // fallback: open direct URL
                                const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                                const url = app.resume!.startsWith('http') ? app.resume! : `${base}${app.resume}`;
                                window.open(url, '_blank');
                            }
                        }}
                        className="text-sm text-primary-600 hover:underline"
                    >
                        View / Download
                    </button>
                ) : '-'
            ),
        },
        {
            key: 'cover_letter',
            header: 'Cover Letter',
            render: (app: JobApplication) => (
                <span className="text-sm text-gray-700">{app.cover_letter ? (app.cover_letter.length > 80 ? app.cover_letter.slice(0, 80) + '…' : app.cover_letter) : '-'}</span>
            ),
        },
    ], []);

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Job Applications</h1>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <DataTable
                        data={apps}
                        columns={columns}
                        isLoading={loading}
                        actions={(app: JobApplication) => (
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => {
                                        setSelectedApp(app);
                                        setIsModalOpen(true);
                                    }}
                                >
                                    View
                                </Button>
                                {app.resume && (
                                    <Button
                                        variant="outline"
                                        onClick={async () => {
                                            try {
                                                await openResume(app.resume!);
                                            } catch (err) {
                                                const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                                                const url = app.resume!.startsWith('http') ? app.resume! : `${base}${app.resume}`;
                                                window.open(url, '_blank');
                                            }
                                        }}
                                    >
                                        Open Resume
                                    </Button>
                                )}
                            </div>
                        )}
                    />

                    {totalPages > 1 && (
                        <div className="mt-4">
                            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                        </div>
                    )}
                </div>

                <Modal
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setSelectedApp(null); }}
                    title="Application Details"
                >
                    {selectedApp ? (
                        <div className="space-y-3">
                            <div><strong>Name:</strong> {selectedApp.name}</div>
                            <div><strong>Email:</strong> {selectedApp.email}</div>
                            <div><strong>Phone:</strong> {selectedApp.phone || '-'}</div>
                            <div><strong>Location:</strong> {selectedApp.location || '-'}</div>
                            <div><strong>Gender:</strong> {selectedApp.gender || '-'}</div>
                            <div><strong>DOB:</strong> {selectedApp.dob ? format(new Date(selectedApp.dob), 'MMM dd, yyyy') : '-'}</div>
                            <div><strong>Cover Letter:</strong>
                                <div className="mt-2 p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">{selectedApp.cover_letter || '-'}</div>
                            </div>
                            {selectedApp.resume && (
                                <div>
                                    <strong>Resume:</strong>
                                    <div className="mt-2">
                                        <button
                                            className="text-primary-600 hover:underline"
                                            onClick={async () => {
                                                try {
                                                    await openResume(selectedApp.resume!);
                                                } catch (err) {
                                                    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                                                    const url = selectedApp.resume!.startsWith('http') ? selectedApp.resume! : `${base}${selectedApp.resume}`;
                                                    window.open(url, '_blank');
                                                }
                                            }}
                                        >
                                            Open Resume (new tab)
                                        </button>
                                        <button
                                            className="ml-4 text-sm text-gray-600 hover:underline"
                                            onClick={async () => {
                                                try {
                                                    await downloadResume(selectedApp.resume!);
                                                } catch (err) {
                                                    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                                                    const url = selectedApp.resume!.startsWith('http') ? selectedApp.resume! : `${base}${selectedApp.resume}`;
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = '';
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    a.remove();
                                                }
                                            }}
                                        >
                                            Download
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p>No application selected</p>
                    )}
                </Modal>
            </div>
        </Layout>
    );
}
