'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Key, Phone, Info, ExternalLink, Shield, AlertTriangle } from 'lucide-react';

interface MpesaSandboxSetupProps {
  barData: {
    mpesa_enabled: boolean;
    mpesa_environment: string;
    mpesa_business_shortcode: string;
    mpesa_consumer_key_encrypted: string | null;
    mpesa_consumer_secret_encrypted: string | null;
    mpesa_passkey_encrypted: string | null;
    mpesa_callback_url: string | null;
  };
  barId: string;
}

interface ValidationStatus {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  summary: {
    configurationStatus: 'complete' | 'partial' | 'invalid';
    isStandardShortcode: boolean;
    hasValidCredentials: boolean;
    testPhoneNumbers: string[];
  };
}

export default function MpesaSandboxSetup({ barData, barId }: MpesaSandboxSetupProps) {
  const [validationStatus, setValidationStatus] = useState<ValidationStatus | null>(null);
  const [validating, setValidating] = useState(false);

  if (!barData.mpesa_enabled || barData.mpesa_environment !== 'sandbox') {
    return null;
  }

  const hasConsumerKey = barData.mpesa_consumer_key_encrypted && 
    barData.mpesa_consumer_key_encrypted !== 'test_encrypted_value';
  const hasConsumerSecret = barData.mpesa_consumer_secret_encrypted && 
    barData.mpesa_consumer_secret_encrypted !== 'test_encrypted_value';
  const isFullyConfigured = hasConsumerKey && hasConsumerSecret;

  // Validate sandbox configuration
  const validateSandboxConfig = async () => {
    if (!isFullyConfigured) return;

    setValidating(true);
    try {
      const response = await fetch('/api/mpesa/validate-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          barId,
          strictMode: false // Use warnings instead of errors for non-critical issues
        })
      });

      const result = await response.json();
      
      if (result.success || result.validation) {
        setValidationStatus({
          isValid: result.success,
          errors: result.validation?.configuration?.errors || [],
          warnings: result.validation?.configuration?.warnings || [],
          recommendations: result.recommendations || [],
          summary: result.validation?.summary || {
            configurationStatus: 'invalid',
            isStandardShortcode: false,
            hasValidCredentials: false,
            testPhoneNumbers: []
          }
        });
      }
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setValidating(false);
    }
  };

  // Auto-validate when component mounts and credentials are available
  useEffect(() => {
    if (isFullyConfigured && !validationStatus) {
      validateSandboxConfig();
    }
  }, [isFullyConfigured, barId]);

  return (
    <div className="space-y-4">
      {/* Auto-Setup Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800 mb-2">M-Pesa Sandbox Auto-Setup</h4>
            <p className="text-sm text-blue-700 mb-3">
              We've automatically configured your sandbox defaults. You only need to add your Safaricom API keys.
            </p>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-green-700">Business Shortcode: {barData.mpesa_business_shortcode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-green-700">Passkey: Auto-configured</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-green-700">Callback URL: Set</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-green-700">Environment: Sandbox</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What Still Needs Setup */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Key size={20} className="text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-yellow-800 mb-2">Required: Add Your Safaricom API Keys</h4>
            <p className="text-sm text-yellow-700 mb-3">
              Get these from your Safaricom Developer Portal account:
            </p>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                {hasConsumerKey ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <AlertCircle size={16} className="text-red-500" />
                )}
                <span className={hasConsumerKey ? 'text-green-700' : 'text-red-700'}>
                  Consumer Key {hasConsumerKey ? '(Configured)' : '(Required)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasConsumerSecret ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <AlertCircle size={16} className="text-red-500" />
                )}
                <span className={hasConsumerSecret ? 'text-green-700' : 'text-red-700'}>
                  Consumer Secret {hasConsumerSecret ? '(Configured)' : '(Required)'}
                </span>
              </div>
            </div>

            <a 
              href="https://developer.safaricom.co.ke/MyApps" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <ExternalLink size={14} />
              Get API Keys from Safaricom Developer Portal
            </a>
          </div>
        </div>
      </div>

      {/* Validation Status */}
      {isFullyConfigured && (
        <div className="space-y-3">
          {/* Validation Results */}
          {validationStatus && (
            <div className={`border rounded-lg p-4 ${
              validationStatus.isValid 
                ? 'border-green-200 bg-green-50' 
                : validationStatus.errors.length > 0
                ? 'border-red-200 bg-red-50'
                : 'border-yellow-200 bg-yellow-50'
            }`}>
              <div className="flex items-start gap-3">
                {validationStatus.isValid ? (
                  <Shield size={20} className="text-green-600 mt-0.5" />
                ) : validationStatus.errors.length > 0 ? (
                  <AlertCircle size={20} className="text-red-600 mt-0.5" />
                ) : (
                  <AlertTriangle size={20} className="text-yellow-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className={`font-medium mb-2 ${
                    validationStatus.isValid 
                      ? 'text-green-800' 
                      : validationStatus.errors.length > 0
                      ? 'text-red-800'
                      : 'text-yellow-800'
                  }`}>
                    {validationStatus.isValid 
                      ? 'Sandbox Configuration Valid' 
                      : validationStatus.errors.length > 0
                      ? 'Configuration Issues Found'
                      : 'Configuration Warnings'
                    }
                  </h4>

                  {/* Errors */}
                  {validationStatus.errors.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-red-800 mb-1">Issues to Fix:</p>
                      <ul className="text-sm text-red-700 space-y-1">
                        {validationStatus.errors.map((error, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {validationStatus.warnings.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-yellow-800 mb-1">Recommendations:</p>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        {validationStatus.warnings.map((warning, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-yellow-500 mt-1">•</span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Configuration Summary */}
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      {validationStatus.summary.isStandardShortcode ? (
                        <CheckCircle size={14} className="text-green-600" />
                      ) : (
                        <AlertTriangle size={14} className="text-yellow-600" />
                      )}
                      <span>Standard sandbox shortcode: {validationStatus.summary.isStandardShortcode ? 'Yes' : 'Custom'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {validationStatus.summary.hasValidCredentials ? (
                        <CheckCircle size={14} className="text-green-600" />
                      ) : (
                        <AlertCircle size={14} className="text-red-600" />
                      )}
                      <span>Valid credentials: {validationStatus.summary.hasValidCredentials ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Re-validate Button */}
          <button
            onClick={validateSandboxConfig}
            disabled={validating}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Shield size={16} />
            {validating ? 'Validating Configuration...' : 'Re-validate Sandbox Setup'}
          </button>
        </div>
      )}

      {/* Test Phone Number & PIN Notice */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Phone size={20} className="text-green-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-800 mb-2">Sandbox Testing Information</h4>
            <div className="text-sm text-green-700 space-y-2">
              <div>
                <span className="font-medium">Test Phone Numbers:</span>
                <div className="mt-1 space-y-1">
                  {validationStatus?.summary.testPhoneNumbers?.slice(0, 3).map((number, index) => (
                    <div key={index} className="font-mono bg-green-100 px-2 py-1 rounded inline-block mr-2">
                      {number}
                    </div>
                  )) || (
                    <div className="font-mono bg-green-100 px-2 py-1 rounded inline-block mr-2">
                      254708374149
                    </div>
                  )}
                </div>
              </div>
              <div>
                <span className="font-medium">Test PIN:</span>
                <span className="ml-2 font-mono bg-green-100 px-2 py-1 rounded">1234</span>
              </div>
              <p className="text-xs text-green-600 mt-2">
                Use these credentials when testing M-Pesa payments in sandbox mode.
                Real money is not involved in sandbox testing.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Complete Status */}
      {isFullyConfigured && validationStatus?.isValid && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <h4 className="font-medium text-green-800">M-Pesa Sandbox Ready!</h4>
              <p className="text-sm text-green-700 mt-1">
                Your M-Pesa integration is fully configured and ready for testing.
                Customers can now make payments using the test credentials above.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}