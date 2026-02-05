// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

'use client';

import React, { useState } from 'react';
import { ArrowRight, Printer, Menu, Info, X, Store, Zap, MessageSquare, CreditCard, Check } from 'lucide-react';

interface WelcomeScreenProps {
  onModeSelect: (mode: 'basic' | 'venue') => void;
  onLearnMore: (mode: 'basic' | 'venue') => void;
}

interface ModeOption {
  id: 'basic' | 'venue';
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  theme: 'blue' | 'green';
  emojis: string[];
  workflow: string;
}

interface LearnMoreModalProps {
  mode: 'basic' | 'venue' | null;
  onClose: () => void;
  onSelect: (mode: 'basic' | 'venue') => void;
}

const LearnMoreModal: React.FC<LearnMoreModalProps> = ({ mode, onClose, onSelect }) => {
  if (!mode) return null;

  const modeDetails = {
    basic: {
      title: 'Tabeza Basic',
      subtitle: 'Transaction & Receipt Bridge',
      description: 'Perfect for established venues with existing POS systems. Tabeza works alongside your current workflow without disrupting your operations.',
      benefits: [
        'Keep using your existing POS system exactly as you do now',
        'Automatically deliver digital receipts to customers',
        'Accept mobile payments through M-Pesa integration',
        'Provide customers with transaction history and digital copies',
        'No staff training required - your workflow stays the same'
      ],
      requirements: [
        'Existing POS system (required)',
        'Thermal printer for receipt integration',
        'Basic venue information (name, location)',
        'M-Pesa business account for payments'
      ],
      workflow: [
        'Customer scans QR code to open a tab',
        'You serve customers and process orders in your POS as usual',
        'Tabeza automatically prints receipts and sends digital copies',
        'Customer receives digital receipt and can pay via M-Pesa',
        'All transactions are tracked digitally for easy management'
      ],
      theme: 'blue' as const,
      icon: <Printer size={32} className="text-blue-600" />
    },
    venue: {
      title: 'Tabeza Venue',
      subtitle: 'Customer Interaction & Service Layer',
      description: 'Complete solution for customer interaction, ordering, and service management. Enables direct customer engagement through digital menus and messaging.',
      benefits: [
        'Digital menus that customers can browse on their phones',
        'Direct customer ordering and real-time communication',
        'Flexible integration with or without POS systems',
        'Complete payment processing and digital receipts',
        'Enhanced customer experience with interactive features'
      ],
      requirements: [
        'Venue information (name, location)',
        'Menu setup and product configuration',
        'Decision on POS integration (optional)',
        'M-Pesa business account for payments'
      ],
      workflow: [
        'Customer scans QR code to access digital menu',
        'Customer browses menu and places orders or requests',
        'Staff receives notifications and manages orders',
        'Orders processed through POS (if available) or Tabeza directly',
        'Digital receipts generated and payments processed'
      ],
      theme: 'green' as const,
      icon: <Menu size={32} className="text-green-600" />
    }
  };

  const details = modeDetails[mode];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${details.theme === 'blue' ? 'bg-blue-100' : 'bg-green-100'} rounded-xl flex items-center justify-center`}>
                {details.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{details.title}</h2>
                <p className={`text-sm font-medium ${details.theme === 'blue' ? 'text-blue-600' : 'text-green-600'}`}>
                  {details.subtitle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Description */}
          <div className="mb-6">
            <p className="text-gray-600 leading-relaxed">{details.description}</p>
          </div>

          {/* Benefits */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Key Benefits</h3>
            <ul className="space-y-2">
              {details.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check size={16} className={`${details.theme === 'blue' ? 'text-blue-600' : 'text-green-600'} mt-0.5 flex-shrink-0`} />
                  <span className="text-sm text-gray-700">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Requirements */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Requirements</h3>
            <ul className="space-y-2">
              {details.requirements.map((requirement, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Info size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{requirement}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Workflow */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">How It Works</h3>
            <ol className="space-y-2">
              {details.workflow.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className={`w-6 h-6 ${details.theme === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'} rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0`}>
                    {index + 1}
                  </div>
                  <span className="text-sm text-gray-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Close
            </button>
            <button
              onClick={() => onSelect(mode)}
              className={`flex-1 px-4 py-3 text-white rounded-lg transition flex items-center justify-center gap-2 ${
                details.theme === 'blue' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Choose {details.title}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onModeSelect, onLearnMore }) => {
  const [selectedMode, setSelectedMode] = useState<'basic' | 'venue' | null>(null);
  const [showLearnMore, setShowLearnMore] = useState<'basic' | 'venue' | null>(null);

  const modeOptions: ModeOption[] = [
    {
      id: 'basic',
      title: 'Tabeza Basic',
      subtitle: 'Transaction & Receipt Bridge',
      description: 'Perfect for established venues with existing POS systems. Tabeza works alongside your current workflow.',
      features: [
        'Works with your existing POS system',
        'Digital receipt delivery to customers',
        'Customer payment processing',
        'Thermal printer integration required'
      ],
      icon: <Printer size={24} className="text-blue-600" />,
      theme: 'blue',
      emojis: ['🖨️', '📱', '💳'],
      workflow: 'You continue using your POS as normal. Tabeza prints receipts and delivers digital copies to customers.'
    },
    {
      id: 'venue',
      title: 'Tabeza Venue',
      subtitle: 'Customer Interaction & Service Layer',
      description: 'Complete solution for customer interaction, ordering, and service management.',
      features: [
        'Digital menus and customer ordering',
        'Two-way customer messaging',
        'Payment processing and receipts',
        'Works with or without POS systems'
      ],
      icon: <Menu size={24} className="text-green-600" />,
      theme: 'green',
      emojis: ['📋', '💬', '💳'],
      workflow: 'Customers browse menus, place orders, and communicate directly through Tabeza. You choose how orders are processed.'
    }
  ];

  const handleModeClick = (mode: 'basic' | 'venue') => {
    setSelectedMode(mode);
  };

  const handleLearnMoreClick = (mode: 'basic' | 'venue') => {
    setShowLearnMore(mode);
    onLearnMore(mode);
  };

  const handleContinue = () => {
    if (selectedMode) {
      onModeSelect(selectedMode);
    }
  };

  return (
    <>
      <div className="max-w-4xl mx-auto p-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <div className="w-16 h-1 bg-gray-200 rounded"></div>
            <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <div className="w-16 h-1 bg-gray-200 rounded"></div>
            <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-semibold">
              3
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Welcome to Tabeza
          </h1>
          <p className="text-lg text-gray-600">
            Choose the setup that best matches your venue's needs
          </p>
        </div>

        {/* Mode Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {modeOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => handleModeClick(option.id)}
              className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
                selectedMode === option.id
                  ? option.theme === 'blue'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 ${option.theme === 'blue' ? 'bg-blue-100' : 'bg-green-100'} rounded-xl flex items-center justify-center`}>
                  {option.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800">{option.title}</h3>
                  <p className={`text-sm font-medium ${option.theme === 'blue' ? 'text-blue-600' : 'text-green-600'}`}>
                    {option.subtitle}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {option.emojis.map((emoji, index) => (
                      <span key={index} className="text-lg">{emoji}</span>
                    ))}
                  </div>
                </div>
                {selectedMode === option.id && (
                  <div className="flex-shrink-0">
                    <Check size={24} className="text-green-500" />
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-gray-600 mb-4">
                {option.description}
              </p>

              {/* Features */}
              <div className="space-y-2 mb-4">
                {option.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check size={16} className="text-green-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* Workflow */}
              <div className={`${option.theme === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border rounded-lg p-3 mb-4`}>
                <p className={`text-xs ${option.theme === 'blue' ? 'text-blue-800' : 'text-green-800'}`}>
                  <strong>How it works:</strong> {option.workflow}
                </p>
              </div>

              {/* Learn More Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLearnMoreClick(option.id);
                }}
                className={`w-full py-2 px-4 text-sm border rounded-lg transition ${
                  option.theme === 'blue'
                    ? 'border-blue-300 text-blue-700 hover:bg-blue-100'
                    : 'border-green-300 text-green-700 hover:bg-green-100'
                }`}
              >
                Learn More
              </button>
            </div>
          ))}
        </div>

        {/* Continue Button */}
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            disabled={!selectedMode}
            className={`px-6 py-3 rounded-lg transition flex items-center gap-2 ${
              !selectedMode
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            Continue
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Learn More Modal */}
      <LearnMoreModal
        mode={showLearnMore}
        onClose={() => setShowLearnMore(null)}
        onSelect={(mode) => {
          setShowLearnMore(null);
          setSelectedMode(mode);
        }}
      />
    </>
  );
};

export default WelcomeScreen;