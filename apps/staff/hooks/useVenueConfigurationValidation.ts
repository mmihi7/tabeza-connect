/**
 * Venue Configuration Validation Hook
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This hook provides client-side venue configuration validation
 * using the Core Truth constraint validation functions.
 */

import { useState, useCallback } from 'react';
import { 
  validateVenueConfiguration,
  validateConfigurationChange,
  generateCorrectedConfiguration,
  getConfigurationDescription,
  getThemeConfiguration,
  type VenueConfiguration,
  type VenueConfigurationInput,
  type ValidationResult
} from '@tabeza/shared';

interface UseVenueConfigurationValidationReturn {
  // Validation functions
  validateConfiguration: (config: VenueConfigurationInput) => ValidationResult;
  validateChange: (current: VenueConfiguration, newConfig: VenueConfigurationInput) => ValidationResult;
  generateConfiguration: (input: VenueConfigurationInput) => VenueConfiguration;
  
  // Utility functions
  getDescription: (config: VenueConfiguration) => string;
  getTheme: (config: VenueConfiguration) => { theme: 'blue' | 'yellow' | 'green'; description: string; icons: string[] };
  
  // API validation (for server-side validation)
  validateWithAPI: (config: VenueConfigurationInput, currentConfig?: VenueConfiguration) => Promise<{
    success: boolean;
    validation: ValidationResult;
    configuration?: VenueConfiguration;
    metadata?: any;
    error?: string;
  }>;
  
  // State
  isValidating: boolean;
  lastValidationResult: ValidationResult | null;
}

export function useVenueConfigurationValidation(): UseVenueConfigurationValidationReturn {
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidationResult, setLastValidationResult] = useState<ValidationResult | null>(null);

  // Client-side validation functions
  const validateConfiguration = useCallback((config: VenueConfigurationInput): ValidationResult => {
    const result = validateVenueConfiguration(config);
    setLastValidationResult(result);
    return result;
  }, []);

  const validateChange = useCallback((
    current: VenueConfiguration, 
    newConfig: VenueConfigurationInput
  ): ValidationResult => {
    const result = validateConfigurationChange(current, newConfig);
    setLastValidationResult(result);
    return result;
  }, []);

  const generateConfiguration = useCallback((input: VenueConfigurationInput): VenueConfiguration => {
    return generateCorrectedConfiguration(input);
  }, []);

  const getDescription = useCallback((config: VenueConfiguration): string => {
    return getConfigurationDescription(config);
  }, []);

  const getTheme = useCallback((config: VenueConfiguration) => {
    return getThemeConfiguration(config);
  }, []);

  // API validation for server-side validation
  const validateWithAPI = useCallback(async (
    config: VenueConfigurationInput,
    currentConfig?: VenueConfiguration
  ) => {
    setIsValidating(true);
    
    try {
      const response = await fetch('/api/venue-configuration/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configuration: config,
          currentConfiguration: currentConfig,
          validationType: currentConfig ? 'change' : 'new'
        }),
      });

      const result = await response.json();
      
      if (result.validation) {
        setLastValidationResult(result.validation);
      }
      
      return result;
    } catch (error) {
      console.error('API validation error:', error);
      return {
        success: false,
        validation: {
          isValid: false,
          errors: ['Failed to validate configuration with server'],
          warnings: []
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setIsValidating(false);
    }
  }, []);

  return {
    validateConfiguration,
    validateChange,
    generateConfiguration,
    getDescription,
    getTheme,
    validateWithAPI,
    isValidating,
    lastValidationResult
  };
}