'use client';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { legalApi } from '@/lib/api/legal';
import React, { useEffect, useState } from 'react';
import { Lock, Save, RefreshCw } from 'lucide-react';

export default function PrivacyPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchPrivacyPolicy();
  }, []);

  const fetchPrivacyPolicy = async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await legalApi.getPrivacy();
      if (content) {
        setContent(content);
      } else {
        // If no content from API, show default template
        setContent(`PRIVACY POLICY

Last updated: ${new Date().toLocaleDateString()}

1. INTRODUCTION
Oysloe ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.

2. INFORMATION WE COLLECT
We collect information that you provide directly to us, including:
- Personal identification information (name, email address, phone number)
- Account credentials
- Profile information
- Content you post or share on the platform
- Communication data when you contact us

3. AUTOMATICALLY COLLECTED INFORMATION
We automatically collect certain information when you use our platform:
- Device information (device type, operating system, unique device identifiers)
- Log data (IP address, browser type, access times)
- Usage information (pages viewed, features used, time spent)
- Location information (with your consent)

4. HOW WE USE YOUR INFORMATION
We use the collected information to:
- Provide, maintain, and improve our services
- Process transactions and send related information
- Send administrative information and updates
- Respond to your comments and questions
- Monitor and analyze trends and usage
- Detect, prevent, and address technical issues
- Personalize your experience

5. INFORMATION SHARING AND DISCLOSURE
We do not sell your personal information. We may share your information in the following circumstances:
- With service providers who assist in operating our platform
- When required by law or to protect our rights
- In connection with a business transfer or merger
- With your consent

6. DATA SECURITY
We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the internet is 100% secure.

7. YOUR RIGHTS
Depending on your location, you may have certain rights regarding your personal information:
- Access to your personal information
- Correction of inaccurate data
- Deletion of your data
- Objection to processing
- Data portability

8. COOKIES AND TRACKING TECHNOLOGIES
We use cookies and similar tracking technologies to track activity on our platform and store certain information.

9. CHILDREN'S PRIVACY
Our platform is not intended for children under the age of 13. We do not knowingly collect personal information from children.

10. CHANGES TO THIS PRIVACY POLICY
We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.

11. CONTACT US
If you have questions about this Privacy Policy, please contact us through the platform's support channels.`);
      }
    } catch (error: any) {
      console.error('Error fetching privacy policy:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load privacy policy';
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
      await legalApi.updatePrivacy(content);
      setSuccess('Privacy policy saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error saving privacy policy:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save privacy policy';
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
            <Lock className="h-8 w-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={fetchPrivacyPolicy}
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
              Privacy Policy Content
            </label>
            <p className="text-sm text-gray-500 mb-4">
              Edit the privacy policy content below. This content will be displayed to users.
            </p>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter privacy policy content..."
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
            <li><code className="bg-blue-100 px-1 rounded">GET /api-v1/admin/privacy/</code></li>
            <li><code className="bg-blue-100 px-1 rounded">GET /api-v1/privacy/</code></li>
            <li><code className="bg-blue-100 px-1 rounded">GET /api-v1/admin/privacy-policy/</code></li>
            <li><code className="bg-blue-100 px-1 rounded">GET /api-v1/admin/legal-content/?type=privacy</code></li>
            <li><code className="bg-blue-100 px-1 rounded">PUT /api-v1/admin/privacy/</code> (for saving)</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}

