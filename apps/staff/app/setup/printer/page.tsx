// apps/staff/app/setup/printer/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Printer, Download, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function PrinterSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [driverConfirmed, setDriverConfirmed] = useState(false);

  const handleDownload = () => {
    // Open the driver download page
    window.open('https://tabeza.co.ke/drivers', '_blank');
  };

  const handleContinue = async () => {
    if (!driverConfirmed) {
      alert('Please confirm you have installed the Tabeza printer drivers before continuing.');
      return;
    }
    
    setLoading(true);
    
    // Small delay to ensure any pending operations complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log('✅ Printer setup confirmed, redirecting to home...');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <Printer size={40} className="text-blue-600" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">
            Install Printer Service
          </h1>

          <p className="text-center text-gray-600 mb-8">
            Follow these steps to set up the Tabeza printer service for receipt printing.
          </p>

          {/* Simple Instructions */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-sm">1</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">Download Printer Service</p>
                <a
                  href="https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v1.0.0.zip"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm mt-1 hover:underline"
                >
                  <Download size={16} />
                  <span>tabeza-printer-service.exe</span>
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-sm">2</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">Run Installer</p>
                <p className="text-sm text-gray-600 mt-1">
                  Right-click the downloaded file and select "Run as administrator"
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-sm">3</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">Verify Installation</p>
                <p className="text-sm text-gray-600 mt-1">
                  Visit{' '}
                  <a 
                    href="http://localhost:8765/api/status" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    localhost:8765/api/status
                  </a>
                  {' '}to confirm the service is running
                </p>
              </div>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={driverConfirmed}
                onChange={(e) => setDriverConfirmed(e.target.checked)}
                className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  I have installed the Tabeza printer service
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Check this box to confirm you've completed the installation and the service is running
                </p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleContinue}
              disabled={!driverConfirmed || loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>Continue to App</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            {!driverConfirmed && (
              <p className="text-center text-sm text-gray-500">
                Please confirm you've installed the printer service to continue
              </p>
            )}
          </div>
        </div>

        {/* Help Link */}
        <div className="mt-6 text-center">
          <a
            href="https://tabeza.co.ke/support/printer-setup"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Need help? View setup guide →
          </a>
        </div>
      </div>
    </div>
  );
}
