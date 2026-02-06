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
  const [driverStatus, setDriverStatus] = useState<{
    installed: boolean;
    checking: boolean;
  }>({ installed: false, checking: true });

  useEffect(() => {
    // Check if drivers are already installed
    const checkDrivers = async () => {
      try {
        const response = await fetch('/api/printer/driver-status');
        const data = await response.json();
        
        setDriverStatus({
          installed: data.installed,
          checking: false,
        });
      } catch (error) {
        setDriverStatus({
          installed: false,
          checking: false,
        });
      }
    };

    checkDrivers();
    
    // Auto-refresh every 5 seconds to detect when service is installed
    const interval = setInterval(checkDrivers, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleContinue = async () => {
    setLoading(true);
    router.push('/dashboard');
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

          {/* Status */}
          {driverStatus.checking ? (
            <div className="flex items-center justify-center gap-3 py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-gray-600">Checking...</p>
            </div>
          ) : driverStatus.installed ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle size={24} className="text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Service Running</p>
                  <p className="text-sm text-green-600">Printer service detected on this computer</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} className="text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-800">Service Not Found</p>
                  <p className="text-sm text-amber-600">Install the printer service to continue</p>
                </div>
              </div>
            </div>
          )}

          {/* Simple Instructions */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-sm">1</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Download Service</p>
                <a
                  href="https://github.com/billoapp/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm mt-1"
                  download
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
              <div>
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
              <div>
                <p className="font-semibold text-gray-800">Verify Installation</p>
                <p className="text-sm text-gray-600 mt-1">
                  Visit <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">localhost:8765/api/status</code> to confirm
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleContinue}
              disabled={!driverStatus.installed || loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                'Loading...'
              ) : driverStatus.installed ? (
                <>
                  <span>Continue to Dashboard</span>
                  <ArrowRight size={20} />
                </>
              ) : (
                'Install Service to Continue'
              )}
            </button>

            {!driverStatus.installed && (
              <p className="text-center text-sm text-amber-600">
                Service must be installed and running before you can continue
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
