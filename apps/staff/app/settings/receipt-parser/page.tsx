'use client';

/**
 * Receipt Parser Configuration
 * 
 * Manage DeepSeek AI prompts for receipt parsing
 * Test prompts with sample receipts
 * View parsing results in real-time
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ParserConfig {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

interface TestResult {
  success: boolean;
  items: Array<{ name: string; price: number }>;
  total: number;
  receiptNumber?: string;
  error?: string;
  tokensUsed?: number;
  parseTime?: number;
}

const DEFAULT_PROMPT = `You are a receipt parser. Extract structured data from receipts and return valid JSON.

Extract:
- items: Array of {name: string, price: number}
- total: number (total amount)
- receiptNumber: string (if present)

Rules:
- Return ONLY valid JSON
- Use exact field names
- Convert all prices to numbers
- Handle missing data gracefully
- Ignore non-item lines (headers, footers, etc.)

Example output:
{
  "items": [
    {"name": "Tusker Lager 500ml", "price": 250.00},
    {"name": "Nyama Choma", "price": 800.00}
  ],
  "total": 1050.00,
  "receiptNumber": "RCP-123456"
}`;

export default function ReceiptParserSettings() {
  const router = useRouter();
  const [config, setConfig] = useState<ParserConfig>({
    systemPrompt: DEFAULT_PROMPT,
    temperature: 0.1,
    maxTokens: 2000,
  });
  const [sampleReceipt, setSampleReceipt] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load current config
  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const response = await fetch('/api/settings/receipt-parser');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig(data.config);
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    try {
      setSaving(true);
      const response = await fetch('/api/settings/receipt-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        throw new Error('Failed to save config');
      }

      alert('✅ Configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('❌ Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function testPrompt() {
    if (!sampleReceipt.trim()) {
      alert('Please enter a sample receipt to test');
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);

      const startTime = Date.now();
      const response = await fetch('/api/settings/receipt-parser/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptText: sampleReceipt,
          config,
        }),
      });

      const parseTime = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.json();
        setTestResult({
          success: false,
          items: [],
          total: 0,
          error: error.error || 'Test failed',
          parseTime,
        });
        return;
      }

      const result = await response.json();
      setTestResult({
        success: true,
        items: result.items || [],
        total: result.total || 0,
        receiptNumber: result.receiptNumber,
        tokensUsed: result.tokensUsed,
        parseTime,
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        items: [],
        total: 0,
        error: error.message || 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  }

  function resetToDefault() {
    if (confirm('Reset to default prompt? This will discard your changes.')) {
      setConfig({
        systemPrompt: DEFAULT_PROMPT,
        temperature: 0.1,
        maxTokens: 2000,
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/settings')}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
          >
            ← Back to Settings
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Receipt Parser Configuration</h1>
          <p className="text-gray-600 mt-2">
            Manage DeepSeek AI prompts and test receipt parsing
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Configuration */}
          <div className="space-y-6">
            {/* System Prompt */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">System Prompt</h2>
                <button
                  onClick={resetToDefault}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Reset to Default
                </button>
              </div>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm"
                placeholder="Enter system prompt for DeepSeek..."
              />
              <p className="text-sm text-gray-500 mt-2">
                This prompt instructs the AI how to parse receipts. Be specific about the format you expect.
              </p>
            </div>

            {/* Advanced Settings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Advanced Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temperature: {config.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.temperature}
                    onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lower = more consistent, Higher = more creative
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    min="500"
                    max="4000"
                    step="100"
                    value={config.maxTokens}
                    onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum response length (higher = more cost)
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={saveConfig}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          {/* Right Column: Testing */}
          <div className="space-y-6">
            {/* Sample Receipt Input */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Test with Sample Receipt</h2>
              <textarea
                value={sampleReceipt}
                onChange={(e) => setSampleReceipt(e.target.value)}
                className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm"
                placeholder="Paste a sample receipt here to test parsing..."
              />
              <button
                onClick={testPrompt}
                disabled={testing || !sampleReceipt.trim()}
                className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {testing ? 'Testing...' : 'Test Prompt'}
              </button>
            </div>

            {/* Test Results */}
            {testResult && (
              <div className={`bg-white rounded-lg shadow p-6 ${testResult.success ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
                <h2 className="text-xl font-semibold mb-4">
                  {testResult.success ? '✅ Test Results' : '❌ Test Failed'}
                </h2>

                {testResult.error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
                    <p className="font-medium">Error:</p>
                    <p className="text-sm">{testResult.error}</p>
                  </div>
                )}

                {testResult.success && (
                  <div className="space-y-4">
                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Parse Time:</span>
                        <span className="ml-2 font-medium">{testResult.parseTime}ms</span>
                      </div>
                      {testResult.tokensUsed && (
                        <div>
                          <span className="text-gray-600">Tokens Used:</span>
                          <span className="ml-2 font-medium">{testResult.tokensUsed}</span>
                        </div>
                      )}
                    </div>

                    {/* Total */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600">Total Amount</div>
                      <div className="text-2xl font-bold text-gray-900">
                        KES {testResult.total.toFixed(2)}
                      </div>
                      {testResult.receiptNumber && (
                        <div className="text-sm text-gray-600 mt-1">
                          Receipt #: {testResult.receiptNumber}
                        </div>
                      )}
                    </div>

                    {/* Items */}
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Items Extracted ({testResult.items.length})
                      </div>
                      {testResult.items.length === 0 ? (
                        <div className="text-sm text-gray-500 italic">
                          No items extracted
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {testResult.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-700">{item.name}</span>
                              <span className="text-sm font-medium text-gray-900">
                                KES {item.price.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">💡 Tips for Better Prompts</h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li>• Be specific about the receipt format you expect</li>
                <li>• Include examples of the exact JSON structure</li>
                <li>• Mention how to handle edge cases (missing data, etc.)</li>
                <li>• Test with real receipts from your POS system</li>
                <li>• Lower temperature (0.1-0.3) for consistent parsing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
