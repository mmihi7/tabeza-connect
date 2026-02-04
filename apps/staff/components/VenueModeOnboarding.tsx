// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

'use client';

import React, { useState, useEffect } from 'react';
import { Check, ArrowRight, Printer, Menu, MessageSquare, CreditCard, AlertCircle, Store, Zap, Lock, X, Info, AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { 
  validateVenueConfiguration,
  generateCorrectedConfiguration,
  getConfigurationDescription,
  getThemeConfiguration,
  type VenueConfiguration,
  type VenueConfigurationInput
} from '@tabeza/shared';
import { 
  type OnboardingProgress
} from '@tabeza/shared/lib/services/onboarding-operations';
import { VenueConfigurationDisplay } from './themed/VenueConfigurationDisplay';
import { ThemedButton } from './themed/ThemedButton';
import { ThemedCard } from './themed/ThemedCard';
import { getVenueThemeConfig, getVenueThemeClasses } from '../contexts/ThemeContext';
import { useNetworkAwareOnboarding } from '../hooks/useNetworkAwareOnboarding';
import { NetworkStatusIndicator } from './NetworkStatusIndicator';

interface VenueModeOnboardingProps {
  onComplete: (config: VenueConfiguration) => void;
  onCancel?: () => void;
  isForced?: boolean; // Indicates non-dismissible mode
  barId?: string; // For progress persistence
}

// Use the shared VenueConfiguration type from the validation service

const ONBOARDING_PROGRESS_KEY = 'tabeza_onboarding_progress';

export default function VenueModeOnboarding({ onComplete, onCancel, isForced = false, barId }: VenueModeOnboardingProps) {
  const [step, setStep] = useState<'mode' | 'authority' | 'summary'>('mode');
  const [selectedMode, setSelectedMode] = useState<'basic' | 'venue' | null>(null);
  const [selectedAuthority, setSelectedAuthority] = useState<'pos' | 'tabeza' | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [showValidationFeedback, setShowValidationFeedback] = useState(false);

  // Use network-aware onboarding hook
  const { state: networkState, actions: networkActions } = useNetworkAwareOnboarding({
    barId,
    autoRestoreProgress: true,
    enableNetworkStatusUpdates: true,
    maxRetries: 3,
    enableRetryQueue: true,
    enableProgressPersistence: true,
    
    onNetworkStatusChange: (status) => {
      console.log('Network status changed:', status.isOnline ? 'online' : 'offline');
    },
    
    onOperationQueued: (operationType, operationId) => {
      console.log(`Operation ${operationType} queued with ID: ${operationId}`);
    },
    
    onOperationCompleted: (operationType, result) => {
      console.log(`Operation ${operationType} completed successfully`);
    }
  });

  // Helper function to get correction suggestions for common mistakes
  const getConfigurationSuggestions = (errors: string[]): string[] => {
    const suggestions: string[] = [];
    
    for (const error of errors) {
      if (error.includes('Basic mode requires POS authority')) {
        suggestions.push('Basic mode is designed to work with existing POS systems. If you don\'t have a POS system, consider choosing Tabeza Venue instead.');
        suggestions.push('Basic mode automatically sets POS authority and requires thermal printer integration.');
      }
      
      if (error.includes('Authority mode is required')) {
        suggestions.push('Please select whether you have an existing POS system or want to use Tabeza for order management.');
        suggestions.push('This choice determines how orders are processed and receipts are generated.');
      }
      
      if (error.includes('Venue mode requires valid authority selection')) {
        suggestions.push('For Venue mode, you must choose either POS integration or Tabeza-only ordering.');
        suggestions.push('POS integration: Customer requests → Staff confirms in POS → Digital receipts');
        suggestions.push('Tabeza-only: Customer orders → Staff confirms in Tabeza → Digital receipts');
      }
    }
    
    // Add general guidance if no specific suggestions
    if (suggestions.length === 0 && errors.length > 0) {
      suggestions.push('Please review your selections and ensure they match your venue\'s operational needs.');
      suggestions.push('Contact support if you need help choosing the right configuration.');
    }
    
    return suggestions;
  };

  // Helper function to get configuration warnings
  const getConfigurationWarnings = (mode: 'basic' | 'venue' | null, authority: 'pos' | 'tabeza' | null): string[] => {
    const warnings: string[] = [];
    
    if (mode === 'basic') {
      warnings.push('Basic mode disables customer ordering and menus. Customers can only make payments and receive digital receipts.');
      warnings.push('You will need to set up thermal printer integration to use Basic mode.');
    }
    
    if (mode === 'venue' && authority === 'pos') {
      warnings.push('With POS authority, staff ordering in Tabeza will be disabled. All orders must be entered in your POS system.');
      warnings.push('Customer menus will create requests only - staff must confirm orders in the POS.');
    }
    
    if (mode === 'venue' && authority === 'tabeza') {
      warnings.push('With Tabeza authority, POS integration will be disabled. All orders and receipts will be managed in Tabeza.');
      warnings.push('This mode provides full customer ordering and staff management capabilities.');
    }
    
    return warnings;
  };

  // Error display component
  const ErrorDisplay = ({ error, canRetry, onRetry }: { 
    error: string, 
    canRetry: boolean, 
    onRetry: () => void 
  }) => {
    if (!error) return null;

    return (
      <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-red-800 mb-2">Setup Error</h4>
            <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
            
            {canRetry && (
              <div className="mt-3">
                <button
                  onClick={onRetry}
                  disabled={networkState.isProcessing}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={14} className={networkState.isProcessing ? 'animate-spin' : ''} />
                  {networkState.isProcessing ? 'Retrying...' : 'Try Again'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Validation feedback component
  const ValidationFeedback = ({ errors, warnings, suggestions }: { 
    errors: string[], 
    warnings: string[], 
    suggestions: string[] 
  }) => {
    if (!showValidationFeedback || (errors.length === 0 && warnings.length === 0)) {
      return null;
    }

    return (
      <div className="mb-6 space-y-3">
        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-red-800 mb-2">Configuration Error</h4>
                <ul className="space-y-1 text-sm text-red-700">
                  {errors.map((error, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <X size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
                
                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <h5 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                      <Info size={16} />
                      Suggestions
                    </h5>
                    <ul className="space-y-1 text-sm text-red-700">
                      {suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <ArrowRight size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-yellow-800 mb-2">Important Notice</h4>
                <ul className="space-y-1 text-sm text-yellow-700">
                  {warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Info size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Save progress to localStorage using the network-aware service
  const saveProgress = (currentStep: 'mode' | 'authority' | 'summary', mode: 'basic' | 'venue' | null, authority: 'pos' | 'tabeza' | null) => {
    const progress: OnboardingProgress = {
      step: currentStep,
      selectedMode: mode,
      selectedAuthority: authority,
      timestamp: Date.now(),
      barId
    };
    
    networkActions.saveProgress(progress);
  };

  // Restore progress from localStorage using the network-aware service
  const restoreProgress = () => {
    const progress = networkActions.restoreProgress(barId);
    
    if (progress) {
      setStep(progress.step);
      setSelectedMode(progress.selectedMode);
      setSelectedAuthority(progress.selectedAuthority);
    }
  };

  // Clear progress from localStorage using the network-aware service
  const clearProgress = () => {
    networkActions.clearProgress(barId);
  };

  // Handle retry for processing errors
  const handleRetry = async () => {
    networkActions.clearError();
    
    // Retry the last operation based on current step
    if (step === 'summary') {
      await handleComplete();
    } else {
      // Try to retry any network operations
      await networkActions.retry();
    }
  };

  // Restore progress on component mount
  useEffect(() => {
    // Check if we have stored progress from the network-aware hook
    if (networkState.hasStoredProgress && networkState.storedProgress) {
      const progress = networkState.storedProgress;
      setStep(progress.step);
      setSelectedMode(progress.selectedMode);
      setSelectedAuthority(progress.selectedAuthority);
    } else {
      // Fallback to manual restore
      restoreProgress();
    }
  }, [networkState.hasStoredProgress, networkState.storedProgress]);

  // Save progress whenever state changes
  useEffect(() => {
    saveProgress(step, selectedMode, selectedAuthority);
  }, [step, selectedMode, selectedAuthority]);

  // Prevent ESC key dismissal in forced mode
  useEffect(() => {
    if (!isForced) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isForced]);

  const handleModeSelection = (mode: 'basic' | 'venue') => {
    setSelectedMode(mode);
    setShowValidationFeedback(false);
    
    // Get configuration warnings for the selected mode
    const configWarnings = getConfigurationWarnings(mode, mode === 'basic' ? 'pos' : null);
    setValidationWarnings(configWarnings);
    
    // Validate the configuration using Core Truth constraints
    const configInput: VenueConfigurationInput = {
      venue_mode: mode,
      authority_mode: mode === 'basic' ? 'pos' : undefined
    };
    
    const validationResult = validateVenueConfiguration(configInput);
    
    if (mode === 'basic') {
      // Basic mode always uses POS authority - validate this
      setSelectedAuthority('pos');
      
      // Validate the complete Basic configuration
      const basicValidation = validateVenueConfiguration({
        venue_mode: 'basic',
        authority_mode: 'pos'
      });
      
      setValidationErrors(basicValidation.errors);
      
      if (basicValidation.isValid) {
        setStep('summary');
      } else {
        setShowValidationFeedback(true);
      }
    } else {
      // Venue mode needs authority selection
      setValidationErrors([]);
      setStep('authority');
    }
  };

  const handleAuthoritySelection = (authority: 'pos' | 'tabeza') => {
    setSelectedAuthority(authority);
    setShowValidationFeedback(false);
    
    // Get configuration warnings for the selected authority
    const configWarnings = getConfigurationWarnings(selectedMode, authority);
    setValidationWarnings(configWarnings);
    
    // Validate the complete configuration using Core Truth constraints
    if (selectedMode) {
      const validationResult = validateVenueConfiguration({
        venue_mode: selectedMode,
        authority_mode: authority
      });
      
      setValidationErrors(validationResult.errors);
      
      if (validationResult.isValid) {
        setStep('summary');
      } else {
        setShowValidationFeedback(true);
      }
    }
  };

  const getConfiguration = (): VenueConfiguration => {
    if (!selectedMode || !selectedAuthority) {
      throw new Error('Configuration is incomplete');
    }
    
    // Use the Core Truth validation to generate the correct configuration
    const correctedConfig = generateCorrectedConfiguration({
      venue_mode: selectedMode,
      authority_mode: selectedAuthority
    });
    
    return correctedConfig;
  };

  const handleComplete = async () => {
    if (!selectedMode || !selectedAuthority) {
      return;
    }

    try {
      // Final validation before completion
      const validationResult = validateVenueConfiguration({
        venue_mode: selectedMode,
        authority_mode: selectedAuthority
      });
      
      if (!validationResult.isValid) {
        setValidationErrors(validationResult.errors);
        setValidationWarnings(validationResult.warnings);
        setShowValidationFeedback(true);
        return;
      }
      
      // Use the validated and corrected configuration
      const finalConfig = validationResult.correctedConfig!;
      
      // If we have a barId, use the network-aware API for completion
      if (barId) {
        const result = await networkActions.completeOnboarding(barId, {
          venue_mode: selectedMode,
          authority_mode: selectedAuthority
        });

        if (!result.success) {
          console.error('❌ Onboarding completion failed:', result.error);
          
          if (result.isQueued) {
            // Operation was queued for retry
            console.log('✅ Onboarding queued for completion when online');
            // Show success message since it will be completed automatically
            clearProgress();
            await onComplete(finalConfig);
          } else {
            // Show error but don't fail completely if it can be retried
            setValidationErrors([result.error || 'Failed to complete venue setup']);
            setShowValidationFeedback(true);
          }
          return;
        }

        console.log('✅ Onboarding completed successfully via network-aware API');
        
        // Clear stored progress on successful completion
        clearProgress();
        
        // Call the completion handler with the final config
        await onComplete(finalConfig);
      } else {
        // Fallback to direct completion handler
        console.log('✅ Onboarding completed successfully via direct handler');
        
        // Clear stored progress on successful completion
        clearProgress();
        
        // Call the completion handler
        await onComplete(finalConfig);
      }
      
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      
      // Create user-friendly error message
      let errorMessage = 'Failed to complete venue setup. Please try again.';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setValidationErrors([errorMessage]);
      setShowValidationFeedback(true);
    }
  };

  // Mode Selection Step
  if (step === 'mode') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Forced mode indicator */}
        {isForced && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Lock size={20} className="text-orange-600" />
              <div className="text-sm text-orange-800">
                <p className="font-medium">Setup Required</p>
                <p>You must complete venue configuration before accessing settings.</p>
              </div>
            </div>
          </div>
        )}

        {/* Network Status Indicator */}
        <NetworkStatusIndicator
          networkState={networkState.networkState}
          queuedOperations={networkState.queuedOperations}
          isProcessing={networkState.isProcessing}
          processingOperation={networkState.processingOperation}
          onRetryQueue={networkActions.processRetryQueue}
          onRefreshStatus={networkActions.refreshNetworkStatus}
          className="mb-6"
        />

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Choose Your Tabeza Setup
            {isForced && <span className="text-orange-600 ml-2">*</span>}
          </h1>
          <p className="text-lg text-gray-600">
            Select the option that best matches your venue's needs
            {isForced && <span className="block text-sm text-orange-600 mt-1">* Required to continue</span>}
          </p>
        </div>

        {/* Error Display */}
        <ErrorDisplay 
          error={networkState.lastError || ''}
          canRetry={networkState.canRetry}
          onRetry={handleRetry}
        />

        {/* Validation Feedback */}
        <ValidationFeedback 
          errors={validationErrors} 
          warnings={validationWarnings}
          suggestions={getConfigurationSuggestions(validationErrors)}
        />

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Tabeza Basic */}
          <div 
            onClick={() => handleModeSelection('basic')}
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedMode === 'basic' 
                ? validationErrors.length > 0 && showValidationFeedback
                  ? 'border-red-500 bg-red-50' 
                  : 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Printer size={24} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800">Tabeza Basic</h3>
                <p className="text-sm text-blue-600 font-medium">Transaction & Receipt Bridge</p>
                <div className="flex gap-1 mt-1">
                  <span className="text-lg">🖨️</span>
                  <span className="text-lg">📱</span>
                  <span className="text-lg">💳</span>
                </div>
              </div>
              {selectedMode === 'basic' && (
                <div className="flex-shrink-0">
                  {validationErrors.length > 0 && showValidationFeedback ? (
                    <AlertCircle size={24} className="text-red-500" />
                  ) : (
                    <Check size={24} className="text-green-500" />
                  )}
                </div>
              )}
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
                ? validationErrors.length > 0 && showValidationFeedback
                  ? 'border-red-500 bg-red-50' 
                  : 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Menu size={24} className="text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800">Tabeza Venue</h3>
                <p className="text-sm text-green-600 font-medium">Customer Interaction & Service Layer</p>
                <div className="flex gap-1 mt-1">
                  <span className="text-lg">📋</span>
                  <span className="text-lg">💬</span>
                  <span className="text-lg">💳</span>
                </div>
              </div>
              {selectedMode === 'venue' && (
                <div className="flex-shrink-0">
                  {validationErrors.length > 0 && showValidationFeedback ? (
                    <AlertCircle size={24} className="text-red-500" />
                  ) : (
                    <Check size={24} className="text-green-500" />
                  )}
                </div>
              )}
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

        <div className={`flex ${!isForced && onCancel ? 'justify-between' : 'justify-end'}`}>
          {!isForced && onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel Setup
            </button>
          )}
          
          <button
            onClick={() => selectedMode && handleModeSelection(selectedMode)}
            disabled={!selectedMode}
            className={`px-6 py-3 rounded-lg transition flex items-center gap-2 ${
              !selectedMode
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : validationErrors.length > 0 && showValidationFeedback
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {validationErrors.length > 0 && showValidationFeedback ? 'Fix Issues & Continue' : 'Continue'}
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
        {/* Forced mode indicator */}
        {isForced && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Lock size={20} className="text-orange-600" />
              <div className="text-sm text-orange-800">
                <p className="font-medium">Setup Required</p>
                <p>You must complete venue configuration before accessing settings.</p>
              </div>
            </div>
          </div>
        )}

        {/* Network Status Indicator */}
        <NetworkStatusIndicator
          networkState={networkState.networkState}
          queuedOperations={networkState.queuedOperations}
          isProcessing={networkState.isProcessing}
          processingOperation={networkState.processingOperation}
          onRetryQueue={networkActions.processRetryQueue}
          onRefreshStatus={networkActions.refreshNetworkStatus}
          className="mb-6"
        />

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Order Management Setup
            {isForced && <span className="text-orange-600 ml-2">*</span>}
          </h1>
          <p className="text-lg text-gray-600">
            Do you have an existing POS system?
            {isForced && <span className="block text-sm text-orange-600 mt-1">* Required to continue</span>}
          </p>
        </div>

        {/* Error Display */}
        <ErrorDisplay 
          error={networkState.lastError || ''}
          canRetry={networkState.canRetry}
          onRetry={handleRetry}
        />

        {/* Validation Feedback */}
        <ValidationFeedback 
          errors={validationErrors} 
          warnings={validationWarnings}
          suggestions={getConfigurationSuggestions(validationErrors)}
        />

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* POS Integration */}
          <div 
            onClick={() => handleAuthoritySelection('pos')}
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedAuthority === 'pos' 
                ? validationErrors.length > 0 && showValidationFeedback
                  ? 'border-red-500 bg-red-50' 
                  : 'border-yellow-500 bg-yellow-50'
                : 'border-gray-200 hover:border-yellow-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Store size={24} className="text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800">Yes - I have a POS</h3>
                <p className="text-sm text-yellow-600 font-medium">Integrate with existing system</p>
                <div className="flex gap-1 mt-1">
                  <span className="text-lg">📋</span>
                  <span className="text-lg">🖨️</span>
                  <span className="text-lg">💬</span>
                </div>
              </div>
              {selectedAuthority === 'pos' && (
                <div className="flex-shrink-0">
                  {validationErrors.length > 0 && showValidationFeedback ? (
                    <AlertCircle size={24} className="text-red-500" />
                  ) : (
                    <Check size={24} className="text-green-500" />
                  )}
                </div>
              )}
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
                ? validationErrors.length > 0 && showValidationFeedback
                  ? 'border-red-500 bg-red-50' 
                  : 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Zap size={24} className="text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800">No - Use Tabeza</h3>
                <p className="text-sm text-green-600 font-medium">Tabeza handles everything</p>
                <div className="flex gap-1 mt-1">
                  <span className="text-lg">📋</span>
                  <span className="text-lg">💬</span>
                  <span className="text-lg">💳</span>
                  <span className="text-lg">📊</span>
                </div>
              </div>
              {selectedAuthority === 'tabeza' && (
                <div className="flex-shrink-0">
                  {validationErrors.length > 0 && showValidationFeedback ? (
                    <AlertCircle size={24} className="text-red-500" />
                  ) : (
                    <Check size={24} className="text-green-500" />
                  )}
                </div>
              )}
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
            className={`px-6 py-3 rounded-lg transition flex items-center gap-2 ${
              !selectedAuthority
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : validationErrors.length > 0 && showValidationFeedback
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {validationErrors.length > 0 && showValidationFeedback ? 'Fix Issues & Continue' : 'Continue'}
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
        {/* Forced mode indicator */}
        {isForced && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Lock size={20} className="text-orange-600" />
              <div className="text-sm text-orange-800">
                <p className="font-medium">Setup Required</p>
                <p>You must complete venue configuration before accessing settings.</p>
              </div>
            </div>
          </div>
        )}

        {/* Network Status Indicator */}
        <NetworkStatusIndicator
          networkState={networkState.networkState}
          queuedOperations={networkState.queuedOperations}
          isProcessing={networkState.isProcessing}
          processingOperation={networkState.processingOperation}
          onRetryQueue={networkActions.processRetryQueue}
          onRefreshStatus={networkActions.refreshNetworkStatus}
          className="mb-6"
        />

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Configuration Summary
            {isForced && <span className="text-orange-600 ml-2">*</span>}
          </h1>
          <p className="text-lg text-gray-600">
            Review your Tabeza setup before completing
            {isForced && <span className="block text-sm text-orange-600 mt-1">* Required to continue</span>}
          </p>
        </div>

        {/* Error Display */}
        <ErrorDisplay 
          error={networkState.lastError || ''}
          canRetry={networkState.canRetry}
          onRetry={handleRetry}
        />

        {/* Validation Feedback */}
        <ValidationFeedback 
          errors={validationErrors} 
          warnings={validationWarnings}
          suggestions={getConfigurationSuggestions(validationErrors)}
        />

        {/* Use the new themed configuration display */}
        <VenueConfigurationDisplay 
          config={config}
          showDetails={true}
          className="mb-8"
        />

        <div className="flex justify-between">
          <ThemedButton
            onClick={() => selectedMode === 'basic' ? setStep('mode') : setStep('authority')}
            variant="outline"
          >
            Back
          </ThemedButton>
          
          <ThemedButton
            onClick={handleComplete}
            disabled={validationErrors.length > 0 || networkState.isProcessing}
            variant="primary"
            className="flex items-center gap-2"
          >
            {networkState.isProcessing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                {isForced ? 'Completing Setup...' : 'Setting Up...'}
              </>
            ) : (
              <>
                {isForced ? 'Complete Required Setup' : 'Complete Setup'}
                <Check size={16} />
              </>
            )}
          </ThemedButton>
        </div>
      </div>
    );
  }

  return null;
}