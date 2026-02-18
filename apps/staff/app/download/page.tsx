'use client';

import React, { useState } from 'react';
import { 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Monitor, 
  Settings, 
  Zap, 
  Shield,
  ArrowRight,
  Copy,
  ExternalLink
} from 'lucide-react';

interface InstallationStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

export default function DownloadPage() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [steps, setSteps] = useState<InstallationStep[]>([
    {
      id: 1,
      title: 'Download TabezaConnect',
      description: 'Download the latest version of TabezaConnect installer',
      icon: <Download className="w-5 h-5" />,
      completed: false
    },
    {
      id: 2,
      title: 'Run Installer as Administrator',
      description: 'Right-click the installer and select "Run as administrator"',
      icon: <Monitor className="w-5 h-5" />,
      completed: false
    },
    {
      id: 3,
      title: 'Configure Bar ID',
      description: 'Enter your venue Bar ID when prompted during installation',
      icon: <Settings className="w-5 h-5" />,
      completed: false
    },
    {
      id: 4,
      title: 'Verify Connection',
      description: 'Check that the printer service shows as "Online" in your staff dashboard',
      icon: <CheckCircle className="w-5 h-5" />,
      completed: false
    }
  ]);

  const downloadUrl = 'https://github.com/billoapp/TabezaConnect/releases/download/v1.0.0/TabezaConnect-Setup-v1.0.0.exe';
  const fallbackUrl = 'https://github.com/billoapp/TabezaConnect/releases/latest';

  const handleDownload = () => {
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    setSteps(prev => prev.map(step => 
      step.id === 1 ? { ...step, completed: true } : step
    ));
  };

  const copyDownloadUrl = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const toggleStep = (stepId: number) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed: !step.completed } : step
    ));
  };

  const allStepsCompleted = steps.every(step => step.completed);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Download className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Download TabezaConnect
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            TabezaConnect enables automatic receipt capture from your POS system to Tabeza. 
            Install it on your venue's computer to start processing receipts automatically.
          </p>
        </div>

        {/* Main Download Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                TabezaConnect v1.1.0
              </h2>
              <p className="text-gray-600">
                Professional Windows installer with spooler monitoring support
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-600">Verified</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-3">Key Features:</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Zap className="w-4 h-4 text-blue-500" />
                  Automatic receipt capture
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Monitor className="w-4 h-4 text-blue-500" />
                  Spooler monitoring (no POS changes)
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Shield className="w-4 h-4 text-blue-500" />
                  Secure Windows service
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <Settings className="w-4 h-4 text-blue-500" />
                  Easy configuration wizard
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-3">System Requirements:</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Windows 10 or later</li>
                <li>• Administrator privileges</li>
                <li>• Internet connection</li>
                <li>• 50MB disk space</li>
              </ul>
            </div>
          </div>

          {/* Download Button */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Download className="w-5 h-5" />
              Download TabezaConnect v1.1.0
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={copyDownloadUrl}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700"
            >
              {copiedUrl ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Link
                </>
              )}
            </button>
          </div>

          {/* Fallback Link */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Having trouble?{' '}
              <a 
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
              >
                View all releases on GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

        {/* Installation Steps */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Installation Steps
          </h2>
          
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition cursor-pointer"
                onClick={() => toggleStep(step.id)}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  step.completed 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {step.completed ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.id}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {step.icon}
                    <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  </div>
                  <p className="text-gray-600 text-sm">{step.description}</p>
                </div>

                <div className="text-xs text-gray-400">
                  Step {index + 1} of {steps.length}
                </div>
              </div>
            ))}
          </div>

          {allStepsCompleted && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Installation Complete!</span>
              </div>
              <p className="text-green-700 text-sm mt-1">
                Your TabezaConnect service should now be running. Check your staff dashboard to verify the connection status.
              </p>
            </div>
          )}
        </div>

        {/* Troubleshooting */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Troubleshooting
          </h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Service Not Connecting
              </h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-7">
                <li>• Ensure you're running the installer as Administrator</li>
                <li>• Check that your Bar ID is correct during setup</li>
                <li>• Verify your internet connection</li>
                <li>• Restart the TabezaConnect service from Windows Services</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Firewall Blocking
              </h3>
              <ul className="text-sm text-gray-600 space-y-1 ml-7">
                <li>• Allow TabezaConnect through Windows Firewall</li>
                <li>• Check corporate firewall settings</li>
                <li>• Port 80 and 443 should be accessible</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Need Help?
              </h3>
              <p className="text-sm text-gray-600 ml-7">
                Contact support at tabeza.co.ke or check your staff dashboard for connection status and error messages.
              </p>
            </div>
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
