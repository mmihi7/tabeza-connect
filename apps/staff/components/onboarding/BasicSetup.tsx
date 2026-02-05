// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

'use client';

import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Printer, Phone, MapPin, Store, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface BasicSetupProps {
  onComplete: (config: BasicSetupConfig) => void;
  onBack: () => void;
}

interface BasicSetupConfig {
  venueName: string;
  location: string;
  mpesaConfig: MpesaConfig;
  printerConfig: PrinterConfig;
  venue_mode: 'basic';
  authority_mode: 'pos';
}

interface MpesaConfig {
  businessShortcode: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  environment: 'sandbox' | 'production';
}

interface PrinterConfig {
  printerName: string;
  connectionType: 'usb' | 'network' | 'bluetooth';
  ipAddress?: string;
  port?: number;
  tested: boolean;
}

type SetupStep = 'venue-info' | 'mpesa-config' | 'printer-setup' | 'summary';

const BasicSetup: React.FC<BasicSetupProps> = ({ onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('venue-info');
  const [venueInfo, setVenueInfo] = useState({
    name: '',
    location: ''
  });
  const [mpesaConfig, setMpesaConfig] = useState<MpesaConfig>({
    businessShortcode: '',
    consumerKey: '',
    consumerSecret: '',
    passkey: '',
    environment: 'sandbox' as const
  });
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>({
    printerName: '',
    connectionType: 'usb',
    tested: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const validateVenueInfo = () => {
    const newErrors: Record<string, string> = {};
    
    if (!venueInfo.name.trim()) {
      newErrors.name = 'Venue name is required';
    }
    
    if (!venueInfo.location.trim()) {
      newErrors.location = 'Location is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateMpesaConfig = () => {
    const newErrors: Record<string, string> = {};
    
    if (!mpesaConfig.businessShortcode.trim()) {
      newErrors.businessShortcode = 'Business shortcode is required';
    }
    
    if (!mpesaConfig.consumerKey.trim()) {
      newErrors.consumerKey = 'Consumer key is required';
    }
    
    if (!mpesaConfig.consumerSecret.trim()) {
      newErrors.consumerSecret = 'Consumer secret is required';
    }
    
    if (!mpesaConfig.passkey.trim()) {
      newErrors.passkey = 'Passkey is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePrinterConfig = () => {
    const newErrors: Record<string, string> = {};
    
    if (!printerConfig.printerName.trim()) {
      newErrors.printerName = 'Printer name is required';
    }
    
    if (printerConfig.connectionType === 'network') {
      if (!printerConfig.ipAddress?.trim()) {
        newErrors.ipAddress = 'IP address is required for network printers';
      }
      if (!printerConfig.port) {
        newErrors.port = 'Port is required for network printers';
      }
    }
    
    if (!printerConfig.tested) {
      newErrors.tested = 'Please test the printer connection before continuing';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    let isValid = false;
    
    switch (currentStep) {
      case 'venue-info':
        isValid = validateVenueInfo();
        if (isValid) setCurrentStep('mpesa-config');
        break;
      case 'mpesa-config':
        isValid = validateMpesaConfig();
        if (isValid) setCurrentStep('printer-setup');
        break;
      case 'printer-setup':
        isValid = validatePrinterConfig();
        if (isValid) setCurrentStep('summary');
        break;
      case 'summary':
        handleComplete();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'venue-info':
        onBack();
        break;
      case 'mpesa-config':
        setCurrentStep('venue-info');
        break;
      case 'printer-setup':
        setCurrentStep('mpesa-config');
        break;
      case 'summary':
        setCurrentStep('printer-setup');
        break;
    }
  };

  const handleTestPrinter = async () => {
    setIsProcessing(true);
    try {
      // Simulate printer test
      await new Promise(resolve => setTimeout(resolve, 2000));
      setPrinterConfig(prev => ({ ...prev, tested: true }));
      setErrors(prev => ({ ...prev, tested: '' }));
    } catch (error) {
      setErrors(prev => ({ ...prev, tested: 'Printer test failed. Please check your connection.' }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = () => {
    const config: BasicSetupConfig = {
      venueName: venueInfo.name,
      location: venueInfo.location,
      mpesaConfig,
      printerConfig,
      venue_mode: 'basic',
      authority_mode: 'pos'
    };
    
    onComplete(config);
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case 'venue-info': return 1;
      case 'mpesa-config': return 2;
      case 'printer-setup': return 3;
      case 'summary': return 4;
      default: return 1;
    }
  };

  const renderProgressIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((step) => (
          <React.Fragment key={step}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step <= getStepNumber() 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-500'
            }`}>
              {step}
            </div>
            {step < 4 && (
              <div className={`w-16 h-1 rounded ${
                step < getStepNumber() ? 'bg-blue-500' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const renderVenueInfoStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Venue Information</h2>
        <p className="text-gray-600">Let's start with basic information about your venue</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Store size={16} className="inline mr-2" />
            Venue Name *
          </label>
          <input
            type="text"
            value={venueInfo.name}
            onChange={(e) => setVenueInfo(prev => ({ ...prev, name: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your venue name"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin size={16} className="inline mr-2" />
            Location *
          </label>
          <input
            type="text"
            value={venueInfo.location}
            onChange={(e) => setVenueInfo(prev => ({ ...prev, location: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.location ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your venue location"
          />
          {errors.location && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.location}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderMpesaConfigStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">M-Pesa Configuration</h2>
        <p className="text-gray-600">Configure your M-Pesa payment integration</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="sandbox"
                checked={mpesaConfig.environment === 'sandbox'}
                onChange={(e) => setMpesaConfig(prev => ({ ...prev, environment: e.target.value as 'sandbox' }))}
                className="mr-2"
              />
              Sandbox (Testing)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="production"
                checked={mpesaConfig.environment === 'production'}
                onChange={(e) => setMpesaConfig(prev => ({ ...prev, environment: e.target.value as 'production' }))}
                className="mr-2"
              />
              Production (Live)
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Business Shortcode *</label>
          <input
            type="text"
            value={mpesaConfig.businessShortcode}
            onChange={(e) => setMpesaConfig(prev => ({ ...prev, businessShortcode: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.businessShortcode ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your business shortcode"
          />
          {errors.businessShortcode && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.businessShortcode}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Consumer Key *</label>
          <input
            type="text"
            value={mpesaConfig.consumerKey}
            onChange={(e) => setMpesaConfig(prev => ({ ...prev, consumerKey: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.consumerKey ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your consumer key"
          />
          {errors.consumerKey && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.consumerKey}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Consumer Secret *</label>
          <input
            type="password"
            value={mpesaConfig.consumerSecret}
            onChange={(e) => setMpesaConfig(prev => ({ ...prev, consumerSecret: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.consumerSecret ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your consumer secret"
          />
          {errors.consumerSecret && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.consumerSecret}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Passkey *</label>
          <input
            type="password"
            value={mpesaConfig.passkey}
            onChange={(e) => setMpesaConfig(prev => ({ ...prev, passkey: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.passkey ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your passkey"
          />
          {errors.passkey && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.passkey}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderPrinterSetupStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Printer Setup</h2>
        <p className="text-gray-600">Configure your thermal printer for receipt printing</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Printer size={16} className="inline mr-2" />
            Printer Name *
          </label>
          <input
            type="text"
            value={printerConfig.printerName}
            onChange={(e) => setPrinterConfig(prev => ({ ...prev, printerName: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.printerName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter printer name"
          />
          {errors.printerName && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.printerName}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Connection Type</label>
          <div className="flex gap-4">
            {(['usb', 'network', 'bluetooth'] as const).map((type) => (
              <label key={type} className="flex items-center">
                <input
                  type="radio"
                  value={type}
                  checked={printerConfig.connectionType === type}
                  onChange={(e) => setPrinterConfig(prev => ({ 
                    ...prev, 
                    connectionType: e.target.value as 'usb' | 'network' | 'bluetooth',
                    tested: false // Reset test status when connection type changes
                  }))}
                  className="mr-2"
                />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {printerConfig.connectionType === 'network' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">IP Address *</label>
              <input
                type="text"
                value={printerConfig.ipAddress || ''}
                onChange={(e) => setPrinterConfig(prev => ({ ...prev, ipAddress: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.ipAddress ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="192.168.1.100"
              />
              {errors.ipAddress && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.ipAddress}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Port *</label>
              <input
                type="number"
                value={printerConfig.port || ''}
                onChange={(e) => setPrinterConfig(prev => ({ ...prev, port: parseInt(e.target.value) || undefined }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.port ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="9100"
              />
              {errors.port && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.port}
                </p>
              )}
            </div>
          </>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-blue-800">Test Printer Connection</h4>
            {printerConfig.tested && (
              <div className="flex items-center gap-1 text-green-600">
                <Check size={16} />
                <span className="text-sm">Tested Successfully</span>
              </div>
            )}
          </div>
          <p className="text-sm text-blue-700 mb-4">
            Test your printer connection to ensure receipts will print correctly.
          </p>
          <button
            onClick={handleTestPrinter}
            disabled={isProcessing || !printerConfig.printerName}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              isProcessing || !printerConfig.printerName
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : printerConfig.tested
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isProcessing ? 'Testing...' : printerConfig.tested ? 'Test Again' : 'Test Printer'}
          </button>
          {errors.tested && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.tested}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderSummaryStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Setup Summary</h2>
        <p className="text-gray-600">Review your Basic setup configuration</p>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
            <Printer size={20} />
            Tabeza Basic Configuration
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">Mode:</span>
              <span className="font-medium text-blue-800">Basic (POS Integration)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Authority:</span>
              <span className="font-medium text-blue-800">POS System</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Customer Ordering:</span>
              <span className="font-medium text-blue-800">Disabled</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Staff Ordering:</span>
              <span className="font-medium text-blue-800">Disabled</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Printer Required:</span>
              <span className="font-medium text-blue-800">Yes</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="font-medium text-gray-800 mb-3">Venue Information</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium">{venueInfo.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Location:</span>
              <span className="font-medium">{venueInfo.location}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="font-medium text-gray-800 mb-3">M-Pesa Configuration</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Environment:</span>
              <span className="font-medium capitalize">{mpesaConfig.environment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Business Shortcode:</span>
              <span className="font-medium">{mpesaConfig.businessShortcode}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="font-medium text-gray-800 mb-3">Printer Configuration</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Printer Name:</span>
              <span className="font-medium">{printerConfig.printerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Connection:</span>
              <span className="font-medium capitalize">{printerConfig.connectionType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${printerConfig.tested ? 'text-green-600' : 'text-red-600'}`}>
                {printerConfig.tested ? 'Tested Successfully' : 'Not Tested'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {renderProgressIndicator()}
      
      {currentStep === 'venue-info' && renderVenueInfoStep()}
      {currentStep === 'mpesa-config' && renderMpesaConfigStep()}
      {currentStep === 'printer-setup' && renderPrinterSetupStep()}
      {currentStep === 'summary' && renderSummaryStep()}

      <div className="flex justify-between mt-8">
        <button
          onClick={handleBack}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        
        <button
          onClick={handleNext}
          disabled={isProcessing}
          className={`px-6 py-3 rounded-lg transition flex items-center gap-2 ${
            isProcessing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {currentStep === 'summary' ? 'Complete Setup' : 'Continue'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default BasicSetup;