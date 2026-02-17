// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

'use client';

import React from 'react';
import { CheckCircle, Printer, Download, ExternalLink } from 'lucide-react';

interface DriverInstallationGuidanceProps {
  onDriversConfirmed: () => void;
  onSkip?: () => void;
}

const DriverInstallationGuidance: React.FC<DriverInstallationGuidanceProps> = ({
  onDriversConfirmed,
}) => {
  const handleDownload = () => {
    window.open('https://tabeza.co.ke/downloads/tabezaconnect', '_blank');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Automatic Connection Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Printer className="text-blue-600 flex-shrink-0 mt-1" size={24} />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Automatic Printer Connection</h3>
            <p className="text-blue-700 mb-4">
              Your printer will connect automatically after installing TabezaConnect. No manual configuration needed!
            </p>
            <p className="text-sm text-blue-600">
              The TabezaConnect service handles all printer setup automatically. Just install and run the service.
            </p>
          </div>
        </div>
      </div>

      {/* Download Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Download TabezaConnect</h3>
        <p className="text-gray-600 mb-4">
          Download and install the TabezaConnect service. It will automatically detect your printer and connect to Tabeza.
        </p>
        <button
          onClick={handleDownload}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium"
        >
          <Download size={20} />
          Download TabezaConnect
          <ExternalLink size={16} />
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Available for Windows and macOS
        </p>
      </div>

      {/* Installation Steps */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Installation Steps
        </h3>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
              1
            </span>
            <span className="text-gray-700 pt-0.5">Download TabezaConnect from the link above</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
              2
            </span>
            <span className="text-gray-700 pt-0.5">Run the installer as administrator</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
              3
            </span>
            <span className="text-gray-700 pt-0.5">The service will start automatically and connect your printer</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
              4
            </span>
            <span className="text-gray-700 pt-0.5">Your printer will appear online in the dashboard within 30 seconds</span>
          </li>
        </ol>
      </div>

      {/* What Happens Next */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
          <CheckCircle size={20} />
          What Happens Next
        </h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-sm text-green-700">
            <span className="text-green-600 flex-shrink-0">✓</span>
            <span>TabezaConnect reads your venue ID from the installation</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-green-700">
            <span className="text-green-600 flex-shrink-0">✓</span>
            <span>The service automatically sends heartbeats to register your printer</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-green-700">
            <span className="text-green-600 flex-shrink-0">✓</span>
            <span>Your printer status will show as "Online" in the dashboard</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-green-700">
            <span className="text-green-600 flex-shrink-0">✓</span>
            <span>POS receipts will automatically be mirrored to Tabeza</span>
          </li>
        </ul>

        <div className="mt-6">
          <button
            onClick={onDriversConfirmed}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 font-medium"
          >
            <CheckCircle size={20} />
            Continue to Dashboard
          </button>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600 text-center">
          Need help? Contact us at{' '}
          <a
            href="mailto:support@tabeza.co.ke"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            support@tabeza.co.ke
          </a>
        </p>
      </div>
    </div>
  );
};

export default DriverInstallationGuidance;
