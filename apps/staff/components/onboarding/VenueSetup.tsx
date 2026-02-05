// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

'use client';

import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Store, MapPin, Check, AlertCircle, HelpCircle, Zap, Menu, Printer, Users } from 'lucide-react';

interface VenueSetupProps {
  onComplete: (config: VenueSetupConfig) => void;
  onBack: () => void;
}

interface VenueSetupConfig {
  venueName: string;
  location: string;
  hasPOS: boolean;
  mpesaConfig: MpesaConfig;
  venue_mode: 'venue';
  authority_mode: 'pos' | 'tabeza';
}

interface MpesaConfig {
  businessShortcode: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  environment: 'sandbox' | 'production';
}

type SetupStep = 'venue-info' | 'pos-decision' | 'mpesa-config' | 'summary';

interface POSOption {
  hasPOS: boolean;
  title: string;
  subtitle: string;
  description: string;
  implications: string[];
  authorityMode: 'pos' | 'tabeza';
  icon: React.ReactNode;
  theme: 'yellow' | 'green';
}

const VenueSetup: React.FC<VenueSetupProps> = ({ onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('venue-info');
  const [venueInfo, setVenueInfo] = useState({
    name: '',
    location: ''
  });
  const [hasPOS, setHasPOS] = useState<boolean | null>(null);
  const [mpesaConfig, setMpesaConfig] = useState<MpesaConfig>({
    businessShortcode: '',
    consumerKey: '',
    consumerSecret: '',
    passkey: '',
    environment: 'sandbox' as const
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const posOptions: POSOption[] = [
    {
      hasPOS: true,
      title: 'Yes, I have a POS system',
      subtitle: 'Integrate with existing POS',
      description: 'Tabeza will work alongside your existing POS system. Your POS remains the authority for orders and receipts.',
      implications: [
        'Your POS system creates all financial orders',
        'Tabeza provides customer requests and digital receipts',
        'Staff ordering in Tabeza is disabled',
        'Customers can browse menus and send requests to staff',
        'Printer integration recommended for receipt mirroring'
      ],
      authorityMode: 'pos',
      icon: <Printer size={24} className="text-yellow-600" />,
      theme: 'yellow'
    },
    {
      hasPOS: false,
      title: 'No, I don\'t have a POS system',
      subtitle: 'Tabeza as complete solution',
      description: 'Tabeza will be your complete ordering and receipt system. Staff can create orders directly in Tabeza.',
      implications: [
        'Tabeza creates all orders and receipts',
        'Staff can build orders directly in Tabeza',
        'Customers can place full orders through menus',
        'Digital receipts generated automatically',
        'No printer integration required'
      ],
      authorityMode: 'tabeza',
      icon: <Menu size={24} className="text-green-600" />,
      theme: 'green'
    }
  ];

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

  const validatePOSDecision = () => {
    const newErrors: Record<string, string> = {};
    
    if (hasPOS === null) {
      newErrors.posDecision = 'Please select whether you have a POS system';
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
        if (isValid) setCurrentStep('pos-decision');
        break;
      case 'pos-decision':
        isValid = validatePOSDecision();
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
      case 'pos-decision':
        setCurrentStep('venue-info');
        break;
      case 'mpesa-config':
        setCurrentStep('pos-decision');
        break;
      case 'summary':
        setCurrentStep('mpesa-config');
        break;
    }
  };

  const handlePOSSelection = (selectedHasPOS: boolean) => {
    setHasPOS(selectedHasPOS);
    setErrors(prev => ({ ...prev, posDecision: '' }));
  };

  const handleComplete = () => {
    if (hasPOS === null) return;
    
    const config: VenueSetupConfig = {
      venueName: venueInfo.name,
      location: venueInfo.location,
      hasPOS,
      mpesaConfig,
      venue_mode: 'venue',
      authority_mode: hasPOS ? 'pos' : 'tabeza'
    };
    
    onComplete(config);
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case 'venue-info': return 1;
      case 'pos-decision': return 2;
      case 'mpesa-config': return 3;
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
                ? 'bg-green-500 text-white' 
                : 'bg-gray-200 text-gray-500'
            }`}>
              {step}
            </div>
            {step < 4 && (
              <div className={`w-16 h-1 rounded ${
                step < getStepNumber() ? 'bg-green-500' : 'bg-gray-200'
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
          <label htmlFor="venue-name" className="block text-sm font-medium text-gray-700 mb-2">
            <Store size={16} className="inline mr-2" />
            Venue Name *
          </label>
          <input
            id="venue-name"
            type="text"
            value={venueInfo.name}
            onChange={(e) => setVenueInfo(prev => ({ ...prev, name: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
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
          <label htmlFor="venue-location" className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin size={16} className="inline mr-2" />
            Location *
          </label>
          <input
            id="venue-location"
            type="text"
            value={venueInfo.location}
            onChange={(e) => setVenueInfo(prev => ({ ...prev, location: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
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

  const renderPOSDecisionStep = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">POS System Integration</h2>
        <p className="text-gray-600">Do you have an existing POS system?</p>
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-800">
            <HelpCircle size={16} />
            <span className="text-sm font-medium">This determines how orders and receipts are handled</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {posOptions.map((option) => (
          <div
            key={option.hasPOS.toString()}
            onClick={() => handlePOSSelection(option.hasPOS)}
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
              hasPOS === option.hasPOS
                ? option.theme === 'yellow'
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 ${option.theme === 'yellow' ? 'bg-yellow-100' : 'bg-green-100'} rounded-xl flex items-center justify-center`}>
                {option.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800">{option.title}</h3>
                <p className={`text-sm font-medium ${option.theme === 'yellow' ? 'text-yellow-600' : 'text-green-600'}`}>
                  {option.subtitle}
                </p>
              </div>
              {hasPOS === option.hasPOS && (
                <div className="flex-shrink-0">
                  <Check size={24} className="text-green-500" />
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-600 mb-4">
              {option.description}
            </p>

            {/* Implications */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-800">What this means:</h4>
              {option.implications.map((implication, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check size={14} className={`${option.theme === 'yellow' ? 'text-yellow-600' : 'text-green-600'} mt-0.5 flex-shrink-0`} />
                  <span>{implication}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {errors.posDecision && (
        <div className="text-center mb-4">
          <p className="text-sm text-red-600 flex items-center justify-center gap-1">
            <AlertCircle size={14} />
            {errors.posDecision}
          </p>
        </div>
      )}
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
          <label htmlFor="business-shortcode" className="block text-sm font-medium text-gray-700 mb-2">Business Shortcode *</label>
          <input
            id="business-shortcode"
            type="text"
            value={mpesaConfig.businessShortcode}
            onChange={(e) => setMpesaConfig(prev => ({ ...prev, businessShortcode: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
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
          <label htmlFor="consumer-key" className="block text-sm font-medium text-gray-700 mb-2">Consumer Key *</label>
          <input
            id="consumer-key"
            type="text"
            value={mpesaConfig.consumerKey}
            onChange={(e) => setMpesaConfig(prev => ({ ...prev, consumerKey: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
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
          <label htmlFor="consumer-secret" className="block text-sm font-medium text-gray-700 mb-2">Consumer Secret *</label>
          <input
            id="consumer-secret"
            type="password"
            value={mpesaConfig.consumerSecret}
            onChange={(e) => setMpesaConfig(prev => ({ ...prev, consumerSecret: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
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
          <label htmlFor="passkey" className="block text-sm font-medium text-gray-700 mb-2">Passkey *</label>
          <input
            id="passkey"
            type="password"
            value={mpesaConfig.passkey}
            onChange={(e) => setMpesaConfig(prev => ({ ...prev, passkey: e.target.value }))}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
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

  const renderSummaryStep = () => {
    const selectedOption = posOptions.find(option => option.hasPOS === hasPOS);
    
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Setup Summary</h2>
          <p className="text-gray-600">Review your Venue setup configuration</p>
        </div>

        <div className="space-y-6">
          <div className={`${selectedOption?.theme === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'} border rounded-lg p-6`}>
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${selectedOption?.theme === 'yellow' ? 'text-yellow-800' : 'text-green-800'}`}>
              {selectedOption?.icon}
              Tabeza Venue Configuration
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className={selectedOption?.theme === 'yellow' ? 'text-yellow-700' : 'text-green-700'}>Mode:</span>
                <span className={`font-medium ${selectedOption?.theme === 'yellow' ? 'text-yellow-800' : 'text-green-800'}`}>
                  Venue ({hasPOS ? 'POS Integration' : 'Complete Solution'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className={selectedOption?.theme === 'yellow' ? 'text-yellow-700' : 'text-green-700'}>Authority:</span>
                <span className={`font-medium ${selectedOption?.theme === 'yellow' ? 'text-yellow-800' : 'text-green-800'}`}>
                  {hasPOS ? 'POS System' : 'Tabeza System'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={selectedOption?.theme === 'yellow' ? 'text-yellow-700' : 'text-green-700'}>Customer Ordering:</span>
                <span className={`font-medium ${selectedOption?.theme === 'yellow' ? 'text-yellow-800' : 'text-green-800'}`}>
                  {hasPOS ? 'Requests Only' : 'Full Orders'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={selectedOption?.theme === 'yellow' ? 'text-yellow-700' : 'text-green-700'}>Staff Ordering:</span>
                <span className={`font-medium ${selectedOption?.theme === 'yellow' ? 'text-yellow-800' : 'text-green-800'}`}>
                  {hasPOS ? 'Disabled' : 'Enabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={selectedOption?.theme === 'yellow' ? 'text-yellow-700' : 'text-green-700'}>Printer Required:</span>
                <span className={`font-medium ${selectedOption?.theme === 'yellow' ? 'text-yellow-800' : 'text-green-800'}`}>
                  {hasPOS ? 'Recommended' : 'Optional'}
                </span>
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
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {renderProgressIndicator()}
      
      {currentStep === 'venue-info' && renderVenueInfoStep()}
      {currentStep === 'pos-decision' && renderPOSDecisionStep()}
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
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2"
        >
          {currentStep === 'summary' ? 'Complete Setup' : 'Continue'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default VenueSetup;