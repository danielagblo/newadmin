'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { legalApi } from '@/lib/api/legal';
import React, { useEffect, useState } from 'react';
import { FileText, Save, RefreshCw } from 'lucide-react';

export default function TermsPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await legalApi.getTerms();
      if (content) {
        setContent(content);
      } else {
        // If no content from API, show default template
        setContent(`TERMS AND CONDITIONS

Last updated: ${new Date().toLocaleDateString()}

1. ACCEPTANCE OF TERMS
By accessing and using this platform, you accept and agree to be bound by the terms and conditions provided below.

2. USE OF THE PLATFORM
You agree to use this platform only for lawful purposes and in a way that does not infringe the rights of others.

3. USER ACCOUNT
You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

4. CONTENT
Users are responsible for any content they post on the platform. We reserve the right to remove any content that violates our policies.

5. INTELLECTUAL PROPERTY
All content on this platform, including text, graphics, logos, and software, is the property of Oysloe and protected by copyright laws.

6. LIMITATION OF LIABILITY
Oysloe shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the platform.

7. MODIFICATIONS
We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.

8. CONTACT INFORMATION
For questions about these terms, please contact us through the platform's support channels.`);
      }
    } catch (error: any) {
      console.error('Error fetching terms:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load terms and conditions';
      setError(`Failed to load: ${errorMessage}. Please check if the API endpoint exists.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await legalApi.updateTerms(content);
      setSuccess('Terms and conditions saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error saving terms:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save terms and conditions';
      setError(`Failed to save: ${errorMessage}. Please check if the API endpoint exists.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900">Terms and Conditions</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={fetchTerms}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !content.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Terms and Conditions Content
            </label>
            <p className="text-sm text-gray-500 mb-4">
              Edit the terms and conditions content below. This content will be displayed to users.
            </p>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter terms and conditions content..."
            rows={30}
            className="font-mono text-sm"
          />
          <div className="mt-4 text-sm text-gray-500">
            <p>Content length: {content.length} characters</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">API Endpoints:</h3>
          <p className="text-sm text-blue-800 mb-2">
            The system will try the following endpoints in order:
          </p>
          <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
            <li><code className="bg-blue-100 px-1 rounded">GET /api-v1/admin/terms/</code></li>
            <li><code className="bg-blue-100 px-1 rounded">GET /api-v1/terms/</code></li>
            <li><code className="bg-blue-100 px-1 rounded">GET /api-v1/admin/legal-content/?type=terms</code></li>
            <li><code className="bg-blue-100 px-1 rounded">PUT /api-v1/admin/terms/</code> (for saving)</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

