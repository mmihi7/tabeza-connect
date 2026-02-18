import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { TemplateGenerationStep } from '../../../components/TemplateGenerationStep';
import { ReceiptAssignment } from '../../../components/ReceiptAssignment';

const supabase = createClientComponentClient();

export default function ReceiptCapturePage() {
  const [activeTab, setActiveTab] = useState<'template' | 'assignment'>('template');
  const [barId, setBarId] = useState<string | null>(null);

  useEffect(() => {
    // Get current bar ID from user context or session
    const fetchBarId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // TODO: Get bar ID from user profile or context
        setBarId('438c80c1-fe11-4ac5-8a48-2fc45104ba31'); // Using test bar ID for now
      }
    };
    fetchBarId();
  }, []);

  if (!barId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Receipt Capture System
          </h1>
          <p className="text-gray-600">
            Generate parsing templates and assign receipts to customer tabs
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('template')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'template'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🧠 Generate Template
            </button>
            <button
              onClick={() => setActiveTab('assignment')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'assignment'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Assign Receipts
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'template' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Generate Receipt Parsing Template
              </h2>
              <p className="text-gray-600 mb-6">
                Print test receipts from your POS system, then generate an AI-powered template 
                for consistent parsing of your receipt format.
              </p>
              <TemplateGenerationStep 
                barId={barId}
                onComplete={() => setActiveTab('assignment')}
              />
            </div>
          )}

          {activeTab === 'assignment' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Assign Receipts to Customer Tabs
              </h2>
              <p className="text-gray-600 mb-6">
                View unclaimed receipts and assign them to customer tabs for payment.
              </p>
              <ReceiptAssignment barId={barId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
