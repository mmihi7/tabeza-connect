// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

'use client';

import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, ExternalLink, Monitor, HelpCircle } from 'lucide-react';
import {
  detectPlatform,
  generateInstallationGuidance,
  getPlatformDescription,
  isPlatformSupported,
} from '@tabeza/shared/lib/services/driver-detection-service';
import type { Platform, InstallationGuidance } from '@tabeza/shared/lib/services/printer-service-types';

interface DriverInstallationGuidanceProps {
  onDriversConfirmed: () => void;
  onSkip?: () => void;
}

const DriverInstallationGuidance: React.FC<DriverInstallationGuidanceProps> = ({
  onDriversConfirmed,
  onSkip,
}) => {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [guidance, setGuidance] = useState<InstallationGuidance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [driversConfirmed, setDriversConfirmed] = useState(false);

  useEffect(() => {
    try {
      const detectedPlatform = detectPlatform();
      setPlatform(detectedPlatform);

      if (!isPlatformSupported(detectedPlatform)) {
        setError(
          `Tabeza printer drivers are not currently supported on ${detectedPlatform.os}. ` +
          'Please use a Windows or macOS computer to complete printer setup.'
        );
        return;
      }

      const installationGuidance = generateInstallationGuidance(detectedPlatform);
      setGuidance(installationGuidance);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to detect platform. Please contact support@tabeza.co.ke for assistance.'
      );
    }
  }, []);

  const handleDownload = () => {
    if (guidance?.downloadUrl) {
      window.open(guidance.downloadUrl, '_blank');
      setShowInstructions(true);
    }
  };

  const handleConfirmInstallation = () => {
    setDriversConfirmed(true);
    setShowVerification(true);
  };

  const handleProceed = () => {
    onDriversConfirmed();
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">Platform Not Supported</h3>
              <p className="text-red-700 mb-4">{error}</p>
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Return to Setup
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!platform || !guidance) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Platform Detection Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Monitor className="text-blue-600 flex-shrink-0 mt-1" size={24} />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Platform Detected</h3>
            <p className="text-blue-700 mb-4">{getPlatformDescription(platform)}</p>
            <p className="text-sm text-blue-600">
              Tabeza printer drivers are required for POS integration. We've detected your platform
              and prepared the appropriate installation package.
            </p>
          </div>
        </div>
      </div>

      {/* Download Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 1: Download Printer Drivers</h3>
        <p className="text-gray-600 mb-4">
          Download the Tabeza printer drivers for {platform.os === 'windows' ? 'Windows' : 'macOS'}.
          The drivers enable your POS system to communicate with Tabeza for digital receipt delivery.
        </p>
        <button
          onClick={handleDownload}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium"
        >
          <Download size={20} />
          Download Tabeza Printer Drivers
          <ExternalLink size={16} />
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Opens in a new tab: {guidance.downloadUrl}
        </p>
      </div>

      {/* Installation Instructions */}
      {showInstructions && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Step 2: Install the Drivers
          </h3>
          <ol className="space-y-3">
            {guidance.instructions.map((instruction, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </span>
                <span className="text-gray-700 pt-0.5">{instruction}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleConfirmInstallation}
              disabled={driversConfirmed}
              className={`w-full px-6 py-3 rounded-lg transition flex items-center justify-center gap-2 font-medium ${
                driversConfirmed
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {driversConfirmed ? (
                <>
                  <CheckCircle size={20} />
                  Drivers Installed
                </>
              ) : (
                'I have installed the drivers'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Troubleshooting Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <button
          onClick={() => setShowTroubleshooting(!showTroubleshooting)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition rounded-lg"
        >
          <div className="flex items-center gap-2">
            <HelpCircle size={20} className="text-gray-600" />
            <span className="font-medium text-gray-800">Troubleshooting</span>
          </div>
          <span className="text-gray-400">{showTroubleshooting ? '−' : '+'}</span>
        </button>
        {showTroubleshooting && (
          <div className="px-6 pb-6">
            <p className="text-sm text-gray-600 mb-3">
              If you encounter issues during installation, try these steps:
            </p>
            <ul className="space-y-2">
              {guidance.troubleshootingSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-600 flex-shrink-0">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Verification Steps */}
      {showVerification && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
            <CheckCircle size={20} />
            Step 3: Verify Installation
          </h3>
          <p className="text-green-700 mb-4">
            Please verify that the Tabeza printer drivers are installed correctly:
          </p>
          <ol className="space-y-3 mb-6">
            {guidance.verificationSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </span>
                <span className="text-green-700 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          <button
            onClick={handleProceed}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 font-medium"
          >
            <CheckCircle size={20} />
            Continue to Printer Setup
          </button>
        </div>
      )}

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
