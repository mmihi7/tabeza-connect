// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

'use client';

import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Printer, MapPin, Store, Check, AlertCircle } from 'lucide-react';

interface BasicSetupProps {
  onComplete: (config: BasicSetupConfig) => void;
  onBack: () => void;
}

interface BasicSetupConfig {
  venueName: string;
  location: string;
  mpesaConfig: MpesaConfig;
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

type SetupStep = 'venue-info' | 'mpesa-config' | 'summary';

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

  const handleNext = () => {
    let isValid = false;
    
    switch (currentStep) {
      case 'venue-info':
        isValid = validateVenueInfo();
        if (isValid) setCurrentStep('mpesa-config');
        break;
      case 'mpesa-config':
        isValid = validateMpesaConfig();
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
      case 'summary':
        setCurrentStep('mpesa-config');
        break;
    }
  };

  const handleComplete = () => {
    const config: BasicSetupConfig = {
      venueName: venueInfo.name,
      location: venueInfo.location,
      mpesaConfig,
      venue_mode: 'basic',
      authority_mode: 'pos'
    };
    
    onComplete(config);
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case 'venue-info': return 1;
      case 'mpesa-config': return 2;
      case 'summary': return 3;
      default: return 1;
    }
  };

  const renderProgressIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((step) => (
          <React.Fragment key={step}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step <= getStepNumber() 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-500'
            }`}>
              {step}
            </div>
            {step < 3 && (
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

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 className="font-medium text-green-800 mb-3 flex items-center gap-2">
            <Printer size={18} />
            Printer Setup - Automatic Connection
          </h4>
          <p className="text-sm text-green-700 mb-3">
            Your printer will connect automatically after you install the TabezaConnect service.
          </p>
          <div className="space-y-2 text-sm text-green-700">
            <div className="flex items-start gap-2">
              <Check size={16} className="flex-shrink-0 mt-0.5" />
              <span>Download TabezaConnect from tabeza.co.ke</span>
            </div>
            <div className="flex items-start gap-2">
              <Check size={16} className="flex-shrink-0 mt-0.5" />
              <span>Install and run the service</span>
            </div>
            <div className="flex items-start gap-2">
              <Check size={16} className="flex-shrink-0 mt-0.5" />
              <span>Printer will appear online automatically within 30 seconds</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-green-200">
            <p className="text-xs text-green-600">
              No manual configuration needed - the service handles everything automatically!
            </p>
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