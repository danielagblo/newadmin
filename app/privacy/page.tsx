"use client";

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { legalApi, LegalContent } from '@/lib/api/legal';
import { Calendar, Edit, Lock, Plus, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function PrivacyPage() {
  const [items, setItems] = useState<LegalContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<LegalContent | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>();

  useEffect(() => {
    fetchList();
  }, []);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await legalApi.listPrivacy();
      setItems(list || []);
    } catch (err: any) {
      console.error('Failed to load privacy list', err);
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setFormErrors(undefined);
    setIsModalOpen(true);
  };

  const openEdit = (item: LegalContent) => {
    setEditing(item);
    setTitle((item as any).title || '');
    setBody((item as any).content || (item as any).body || '');
    setFormErrors(undefined);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required');
      return;
    }
    setSaving(true);
    setError(null);
    setFormErrors(undefined);
    try {
      const iso = new Date().toISOString();
      const dateOnly = iso.split('T')[0];
      const payload: Record<string, any> = {
        content: body,
        updated_at: iso,
        body: body,
        date: dateOnly,
        ...(title ? { title } : {}),
      };

      let result: LegalContent;
      if (editing && editing.id) {
        result = await legalApi.updatePrivacyById(editing.id as any, payload);
      } else {
        result = await legalApi.createPrivacy(payload);
      }

      await fetchList();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save failed', err);
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        setFormErrors(data as Record<string, string[]>);
        const firstKey = Object.keys(data)[0];
        const firstMsg = Array.isArray((data as any)[firstKey]) ? (data as any)[firstKey][0] : String((data as any)[firstKey]);
        setError(firstMsg || 'Save failed');
      } else {
        setError(err?.response?.data?.message || err?.message || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: LegalContent) => {
    if (!confirm('Delete this privacy entry?')) return;
    try {
      await legalApi.deletePrivacyById(item.id as any);
      await fetchList();
    } catch (err: any) {
      console.error('Delete failed', err);
      setError(err?.message || 'Delete failed');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Lock className="h-8 w-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900">Privacy Policies</h1>
          </div>
          <div>
            <Button onClick={openCreate} className="flex items-center" variant="primary">
              <Plus className="h-4 w-4 mr-2" />
              New Privacy
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No privacy policies found. Create one with the button above.</div>
          ) : (
            <div className="space-y-4">
              {items.map((t) => (
                <div key={t.id} className="p-4 border rounded-lg flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold">{(t as any).title || `Privacy #${t.id}`}</h3>
                      {t.updated_at && (
                        <div className="text-sm text-gray-500 flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(t.updated_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-3 whitespace-pre-wrap">{(t as any).body || t.content}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" onClick={() => openEdit(t)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(t)}>
                      <Trash className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? 'Edit Privacy' : 'Create Privacy'} size="lg">
          <div className="space-y-4">
            {formErrors && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <p className="font-medium">Please fix the following:</p>
                <ul className="mt-2 list-disc list-inside text-sm">
                  {Object.entries(formErrors).map(([field, msgs]) => (
                    <li key={field}>
                      <strong className="capitalize">{field}</strong>: {Array.isArray(msgs) ? msgs.join(' ') : String(msgs)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
            </div>
            <div className="flex items-center justify-end space-x-2">
              <Button variant="outline" onClick={closeModal}>Cancel</Button>
              <Button onClick={handleSave} isLoading={saving}>{editing ? 'Save Changes' : 'Create'}</Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}

