'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { jobApplicationsApi } from '@/lib/api/jobApplications';
import { JobApplication } from '@/lib/types';
import { format } from 'date-fns';

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
          <a href={app.resume} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline">
            View / Download
          </a>
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
                  <a href={app.resume} target="_blank" rel="noreferrer">
                    <Button variant="outline">Open Resume</Button>
                  </a>
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
                    <a href={selectedApp.resume} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">Open Resume (new tab)</a>
                    <a href={selectedApp.resume} download className="ml-4 text-sm text-gray-600 hover:underline">Download</a>
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
