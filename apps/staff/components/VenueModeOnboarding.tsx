// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

'use client';

import React, { useState } from 'react';
import { Check, ArrowRight, Printer, Menu, MessageSquare, CreditCard, AlertCircle, Store, Zap } from 'lucide-react';

interface VenueModeOnboardingProps {
  onComplete: (config: VenueConfiguration) => void;
  onCancel: () => void;
}

interface VenueConfiguration {
  venue_mode: 'basic' | 'venue';
  authority_mode: 'pos' | 'tabeza';
  pos_integration_enabled: boolean;
  printer_required: boolean;
}

export default function VenueModeOnboarding({ onComplete, onCancel }: VenueModeOnboardingProps) {
  const [step, setStep] = useState<'mode' | 'authority' | 'summary'>('mode');
  const [selectedMode, setSelectedMode] = useState<'basic' | 'venue' | null>(null);
  const [selectedAuthority, setSelectedAuthority] = useState<'pos' | 'tabeza' | null>(null);

  const handleModeSelection = (mode: 'basic' | 'venue') => {
    setSelectedMode(mode);
    
    if (mode === 'basic') {
      // Basic mode always uses POS authority
      setSelectedAuthority('pos');
      setStep('summary');
    } else {
      // Venue mode needs authority selection
      setStep('authority');
    }
  };

  const handleAuthoritySelection = (authority: 'pos' | 'tabeza') => {
    setSelectedAuthority(authority);
    setStep('summary');
  };

  const getConfiguration = (): VenueConfiguration => {
    return {
      venue_mode: selectedMode!,
      authority_mode: selectedAuthority!,
      pos_integration_enabled: selectedAuthority === 'pos',
      printer_required: selectedMode === 'basic'
    };
  };

  const handleComplete = () => {
    if (selectedMode && selectedAuthority) {
      onComplete(getConfiguration());
    }
  };

  // Mode Selection Step
  if (step === 'mode') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Choose Your Tabeza Setup</h1>
          <p className="text-lg text-gray-600">
            Select the option that best matches your venue's needs
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Tabeza Basic */}
          <div 
            onClick={() => handleModeSelection('basic')}
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedMode === 'basic' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Printer size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Tabeza Basic</h3>
                <p className="text-sm text-blue-600 font-medium">Transaction & Receipt Bridge</p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-4">
              Perfect for established venues with existing POS systems. Tabeza works alongside your current workflow.
            </p>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check size={16} className="text-green-600" />
                <span>Works with your existing POS system</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check size={16} className="text-green-600" />
                <span>Digital receipt delivery to customers</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check size={16} className="text-green-600" />
                <span>Customer payment processing</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check size={16} className="text-green-600" />
                <span>Thermal printer integration required</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>How it works:</strong> You continue using your POS as normal. 
                Tabeza prints receipts and delivers digital copies to customers.
              </p>
            </div>
          </div>

          {/* Tabeza Venue */}
          <div 
            onClick={() => handleModeSelection('venue')}
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedMode === 'venue' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Menu size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Tabeza Venue</h3>
                <p className="text-sm text-green-600 font-medium">Customer Interaction & Service Layer</p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-4">
              Complete solution for customer interaction, ordering, and service management.
            </p>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check size={16} className="text-green-600" />
                <span>Digital menus and customer ordering</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check size={16} className="text-green-600" />
                <span>Two-way customer messaging</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check size={16} className="text-green-600" />
                <span>Payment processing and receipts</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check size={16} className="text-green-600" />
                <span>Works with or without POS systems</span>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-800">
                <strong>How it works:</strong> Customers browse menus, place orders, and communicate 
                directly through Tabeza. You choose how orders are processed.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel Setup
          </button>
          
          <button
            onClick={() => selectedMode && handleModeSelection(selectedMode)}
            disabled={!selectedMode}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            Continue
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Authority Selection Step (Venue mode only)
  if (step === 'authority') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Order Management Setup</h1>
          <p className="text-lg text-gray-600">
            Do you have an existing POS system?
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* POS Integration */}
          <div 
            onClick={() => handleAuthoritySelection('pos')}
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedAuthority === 'pos' 
                ? 'border-yellow-500 bg-yellow-50' 
                : 'border-gray-200 hover:border-yellow-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Store size={24} className="text-yellow-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Yes - I have a POS</h3>
                <p className="text-sm text-yellow-600 font-medium">Integrate with existing system</p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-4">
              Tabeza will work alongside your existing POS system for order processing.
            </p>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <MessageSquare size={16} className="text-blue-600" />
                <span>Customers send order requests</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Store size={16} className="text-yellow-600" />
                <span>You confirm orders in your POS</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Printer size={16} className="text-green-600" />
                <span>Tabeza delivers digital receipts</span>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                <strong>Workflow:</strong> Customer requests → Staff confirms in POS → 
                Digital receipt delivered → Payment processed
              </p>
            </div>
          </div>

          {/* Tabeza Authority */}
          <div 
            onClick={() => handleAuthoritySelection('tabeza')}
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedAuthority === 'tabeza' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Zap size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">No - Use Tabeza</h3>
                <p className="text-sm text-green-600 font-medium">Tabeza handles everything</p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-4">
              Tabeza will be your complete ordering and receipt system.
            </p>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Menu size={16} className="text-blue-600" />
                <span>Customers place direct orders</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Check size={16} className="text-green-600" />
                <span>Orders confirmed in Tabeza</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CreditCard size={16} className="text-purple-600" />
                <span>Digital receipts and payments</span>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-800">
                <strong>Workflow:</strong> Customer orders → Staff confirms in Tabeza → 
                Digital receipt generated → Payment processed
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setStep('mode')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Back
          </button>
          
          <button
            onClick={() => selectedAuthority && handleAuthoritySelection(selectedAuthority)}
            disabled={!selectedAuthority}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            Continue
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Summary Step
  if (step === 'summary') {
    const config = getConfiguration();
    
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Configuration Summary</h1>
          <p className="text-lg text-gray-600">
            Review your Tabeza setup before completing
          </p>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
              config.venue_mode === 'basic' 
                ? 'bg-blue-100' 
                : 'bg-green-100'
            }`}>
              {config.venue_mode === 'basic' ? (
                <Printer size={32} className="text-blue-600" />
              ) : (
                <Menu size={32} className="text-green-600" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {config.venue_mode === 'basic' ? 'Tabeza Basic' : 'Tabeza Venue'}
              </h2>
              <p className="text-gray-600">
                {config.venue_mode === 'basic' 
                  ? 'Transaction & Receipt Bridge' 
                  : config.authority_mode === 'pos'
                    ? 'Customer Interaction + POS Integration'
                    : 'Full Service Platform'
                }
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">What's Enabled</h3>
              <div className="space-y-2">
                {config.venue_mode === 'basic' ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>POS receipt mirroring</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>Digital receipt delivery</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>Customer payments</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>Thermal printer integration</span>
                    </div>
                  </>
                ) : config.authority_mode === 'pos' ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>Customer order requests</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>POS order confirmation</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>Two-way messaging</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>Digital receipts & payments</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>Full customer ordering</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>Staff order management</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>Digital receipts & payments</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check size={16} />
                      <span>Two-way messaging</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Configuration Details</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <strong>Mode:</strong> {config.venue_mode === 'basic' ? 'Basic' : 'Venue'}
                </div>
                <div>
                  <strong>Order Authority:</strong> {config.authority_mode === 'pos' ? 'POS System' : 'Tabeza'}
                </div>
                <div>
                  <strong>POS Integration:</strong> {config.pos_integration_enabled ? 'Enabled' : 'Disabled'}
                </div>
                <div>
                  <strong>Printer Required:</strong> {config.printer_required ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
          </div>

          {config.venue_mode === 'basic' && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Printer Setup Required</p>
                  <p>You'll need to configure a thermal printer to use Tabeza Basic. 
                     This ensures receipts are printed from your POS and delivered digitally to customers.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => selectedMode === 'basic' ? setStep('mode') : setStep('authority')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Back
          </button>
          
          <button
            onClick={handleComplete}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2"
          >
            Complete Setup
            <Check size={16} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}