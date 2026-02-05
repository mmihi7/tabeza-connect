/**
 * Onboarding State Management Service
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service manages onboarding state persistence, progress tracking, and step validation
 * as defined in the onboarding-flow-redesign specification.
 */

import { VenueConfiguration, VenueConfigurationInput } from './venue-configuration-validation';

// Enhanced onboarding step enumeration
export enum OnboardingStep {
  WELCOME = 'welcome',
  BASIC_INFO = 'basic_info',
  POS_DECISION = 'pos_decision',
  MPESA_SETUP = 'mpesa_setup',
  PRINTER_SETUP = 'printer_setup',
  COMPLETE = 'complete'
}

// Venue information interface
export interface VenueInfo {
  name: string;
  location: string;
  phone?: string;
  email?: string;
}

// M-Pesa configuration interface
export interface MpesaConfig {
  enabled: boolean;
  environment: 'sandbox' | 'production';
  businessShortcode?: string;
  consumerKey?: string;
  consumerSecret?: string;
  passkey?: string;
  callbackUrl?: string;
}

// Printer configuration interface
export interface PrinterConfig {
  required: boolean;
  configured: boolean;
  testPassed?: boolean;
  printerType?: string;
  connectionMethod?: 'usb' | 'network' | 'bluetooth';
}

// Enhanced onboarding progress interface
export interface OnboardingProgress {
  id: string;
  barId: string;
  currentStep: OnboardingStep;
  venueMode: 'basic' | 'venue' | null;
  authorityMode: 'pos' | 'tabeza' | null;
  completedSteps: OnboardingStep[];
  venueInfo: Partial<VenueInfo>;
  mpesaConfig?: Partial<MpesaConfig>;
  printerConfig?: Partial<PrinterConfig>;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date; // Progress expires after 24 hours
}

// Venue configuration interface (extends existing)
export interface VenueConfigurationExtended extends VenueConfiguration {
  venueInfo: VenueInfo;
  mpesaConfig?: MpesaConfig;
  printerConfig?: PrinterConfig;
  onboardingProgress?: OnboardingProgress;
}

// Onboarding validation interface
export interface OnboardingValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  requiredSteps: OnboardingStep[];
  canProceed: boolean;
  nextStep?: OnboardingStep;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

// Step validation result
export interface StepValidationResult {
  isValid: boolean;
  canProceed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  nextStep?: OnboardingStep;
}

// Onboarding state management class
export class OnboardingStateManager {
  private static readonly STORAGE_KEY_PREFIX = 'tabeza_onboarding_progress_';
  private static readonly PROGRESS_EXPIRY_HOURS = 24;

  /**
   * Create new onboarding progress
   */
  static createProgress(barId: string, initialStep: OnboardingStep = OnboardingStep.WELCOME): OnboardingProgress {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (this.PROGRESS_EXPIRY_HOURS * 60 * 60 * 1000));

    return {
      id: `onboarding_${barId}_${Date.now()}`,
      barId,
      currentStep: initialStep,
      venueMode: null,
      authorityMode: null,
      completedSteps: [],
      venueInfo: {},
      isComplete: false,
      createdAt: now,
      updatedAt: now,
      expiresAt
    };
  }

  /**
   * Save onboarding progress to localStorage and database
   */
  static async saveProgress(progress: OnboardingProgress): Promise<void> {
    // Update timestamp
    progress.updatedAt = new Date();

    // Save to localStorage for immediate persistence
    this.saveToLocalStorage(progress);

    // Save to database for cross-device persistence
    await this.saveToDatabase(progress);
  }

  /**
   * Restore onboarding progress from localStorage or database
   */
  static async restoreProgress(barId: string): Promise<OnboardingProgress | null> {
    // Try localStorage first (faster)
    let progress = this.restoreFromLocalStorage(barId);

    // If not found or expired, try database
    if (!progress || this.isExpired(progress)) {
      progress = await this.restoreFromDatabase(barId);
    }

    // Validate progress is not expired
    if (progress && this.isExpired(progress)) {
      await this.clearProgress(barId);
      return null;
    }

    return progress;
  }

  /**
   * Update progress step and validate transition
   */
  static updateStep(progress: OnboardingProgress, newStep: OnboardingStep): OnboardingProgress {
    // Validate step transition
    const validation = this.validateStepTransition(progress.currentStep, newStep);
    if (!validation.isValid) {
      throw new Error(`Invalid step transition: ${validation.errors[0]?.message}`);
    }

    // Mark current step as completed if moving forward
    if (!progress.completedSteps.includes(progress.currentStep)) {
      progress.completedSteps.push(progress.currentStep);
    }

    // Update current step
    progress.currentStep = newStep;
    progress.updatedAt = new Date();

    // Check if onboarding is complete
    if (newStep === OnboardingStep.COMPLETE) {
      progress.isComplete = true;
    }

    return progress;
  }

  /**
   * Validate step transition
   */
  static validateStepTransition(currentStep: OnboardingStep, newStep: OnboardingStep): StepValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Define valid step transitions
    const validTransitions: Record<OnboardingStep, OnboardingStep[]> = {
      [OnboardingStep.WELCOME]: [OnboardingStep.BASIC_INFO],
      [OnboardingStep.BASIC_INFO]: [OnboardingStep.POS_DECISION, OnboardingStep.MPESA_SETUP], // Basic mode skips POS decision
      [OnboardingStep.POS_DECISION]: [OnboardingStep.MPESA_SETUP],
      [OnboardingStep.MPESA_SETUP]: [OnboardingStep.PRINTER_SETUP, OnboardingStep.COMPLETE], // Venue+Tabeza may skip printer
      [OnboardingStep.PRINTER_SETUP]: [OnboardingStep.COMPLETE],
      [OnboardingStep.COMPLETE]: [] // Terminal step
    };

    // Check if transition is valid
    const allowedSteps = validTransitions[currentStep] || [];
    if (!allowedSteps.includes(newStep)) {
      errors.push({
        field: 'step_transition',
        message: `Cannot transition from ${currentStep} to ${newStep}`,
        code: 'INVALID_STEP_TRANSITION',
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      canProceed: errors.length === 0,
      errors,
      warnings,
      nextStep: errors.length === 0 ? newStep : undefined
    };
  }

  /**
   * Validate current progress state
   */
  static validateProgress(progress: OnboardingProgress): OnboardingValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const requiredSteps: OnboardingStep[] = [];

    // Check if progress is expired
    if (this.isExpired(progress)) {
      errors.push({
        field: 'progress',
        message: 'Onboarding progress has expired',
        code: 'PROGRESS_EXPIRED',
        severity: 'error'
      });
    }

    // Validate venue mode selection
    if (progress.currentStep !== OnboardingStep.WELCOME && !progress.venueMode) {
      errors.push({
        field: 'venue_mode',
        message: 'Venue mode must be selected',
        code: 'VENUE_MODE_REQUIRED',
        severity: 'error'
      });
      requiredSteps.push(OnboardingStep.WELCOME);
    }

    // CORE TRUTH VALIDATION: Basic mode must have POS authority
    if (progress.venueMode === 'basic' && progress.authorityMode && progress.authorityMode !== 'pos') {
      errors.push({
        field: 'authority_mode',
        message: 'Basic mode requires POS authority',
        code: 'BASIC_MODE_REQUIRES_POS',
        severity: 'error'
      });
    }

    // Validate authority mode for venue mode
    if (progress.venueMode === 'venue' && 
        progress.currentStep !== OnboardingStep.WELCOME && 
        progress.currentStep !== OnboardingStep.BASIC_INFO && 
        !progress.authorityMode) {
      errors.push({
        field: 'authority_mode',
        message: 'Authority mode must be selected for venue mode',
        code: 'AUTHORITY_MODE_REQUIRED',
        severity: 'error'
      });
      requiredSteps.push(OnboardingStep.POS_DECISION);
    }

    // Validate venue info
    if (progress.currentStep !== OnboardingStep.WELCOME && 
        (!progress.venueInfo.name || !progress.venueInfo.location)) {
      errors.push({
        field: 'venue_info',
        message: 'Venue name and location are required',
        code: 'VENUE_INFO_REQUIRED',
        severity: 'error'
      });
      requiredSteps.push(OnboardingStep.BASIC_INFO);
    }

    // Determine next step
    let nextStep: OnboardingStep | undefined;
    if (errors.length === 0) {
      nextStep = this.getNextStep(progress);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredSteps,
      canProceed: errors.length === 0,
      nextStep
    };
  }

  /**
   * Get next step based on current progress
   */
  static getNextStep(progress: OnboardingProgress): OnboardingStep | undefined {
    switch (progress.currentStep) {
      case OnboardingStep.WELCOME:
        return OnboardingStep.BASIC_INFO;
      
      case OnboardingStep.BASIC_INFO:
        // Basic mode skips POS decision, goes directly to M-Pesa
        return progress.venueMode === 'basic' ? OnboardingStep.MPESA_SETUP : OnboardingStep.POS_DECISION;
      
      case OnboardingStep.POS_DECISION:
        return OnboardingStep.MPESA_SETUP;
      
      case OnboardingStep.MPESA_SETUP:
        // Basic mode and Venue+POS require printer setup
        return (progress.venueMode === 'basic' || progress.authorityMode === 'pos') 
          ? OnboardingStep.PRINTER_SETUP 
          : OnboardingStep.COMPLETE;
      
      case OnboardingStep.PRINTER_SETUP:
        return OnboardingStep.COMPLETE;
      
      case OnboardingStep.COMPLETE:
        return undefined; // Terminal step
      
      default:
        return undefined;
    }
  }

  /**
   * Clear onboarding progress
   */
  static async clearProgress(barId: string): Promise<void> {
    // Clear from localStorage
    this.clearFromLocalStorage(barId);

    // Clear from database
    await this.clearFromDatabase(barId);
  }

  /**
   * Check if progress is expired
   */
  private static isExpired(progress: OnboardingProgress): boolean {
    return new Date() > progress.expiresAt;
  }

  /**
   * Save to localStorage
   */
  private static saveToLocalStorage(progress: OnboardingProgress): void {
    try {
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        const storage = (globalThis as any).localStorage;
        const key = `${this.STORAGE_KEY_PREFIX}${progress.barId}`;
        storage.setItem(key, JSON.stringify({
          ...progress,
          createdAt: progress.createdAt.toISOString(),
          updatedAt: progress.updatedAt.toISOString(),
          expiresAt: progress.expiresAt.toISOString()
        }));
      }
    } catch (error) {
      console.warn('Failed to save onboarding progress to localStorage:', error);
    }
  }

  /**
   * Restore from localStorage
   */
  private static restoreFromLocalStorage(barId: string): OnboardingProgress | null {
    try {
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        const storage = (globalThis as any).localStorage;
        const key = `${this.STORAGE_KEY_PREFIX}${barId}`;
        const saved = storage.getItem(key);
        
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...parsed,
            createdAt: new Date(parsed.createdAt),
            updatedAt: new Date(parsed.updatedAt),
            expiresAt: new Date(parsed.expiresAt)
          };
        }
      }
    } catch (error) {
      console.warn('Failed to restore onboarding progress from localStorage:', error);
    }
    return null;
  }

  /**
   * Clear from localStorage
   */
  private static clearFromLocalStorage(barId: string): void {
    try {
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        const storage = (globalThis as any).localStorage;
        const key = `${this.STORAGE_KEY_PREFIX}${barId}`;
        storage.removeItem(key);
      }
    } catch (error) {
      console.warn('Failed to clear onboarding progress from localStorage:', error);
    }
  }

  /**
   * Save to database (placeholder - implement with actual database calls)
   */
  private static async saveToDatabase(progress: OnboardingProgress): Promise<void> {
    try {
      // TODO: Implement database persistence
      // This would typically use Supabase client to save to onboarding_progress table
      console.log('Saving onboarding progress to database:', progress.id);
    } catch (error) {
      console.warn('Failed to save onboarding progress to database:', error);
    }
  }

  /**
   * Restore from database (placeholder - implement with actual database calls)
   */
  private static async restoreFromDatabase(barId: string): Promise<OnboardingProgress | null> {
    try {
      // TODO: Implement database restoration
      // This would typically use Supabase client to query onboarding_progress table
      console.log('Restoring onboarding progress from database for bar:', barId);
      return null;
    } catch (error) {
      console.warn('Failed to restore onboarding progress from database:', error);
      return null;
    }
  }

  /**
   * Clear from database (placeholder - implement with actual database calls)
   */
  private static async clearFromDatabase(barId: string): Promise<void> {
    try {
      // TODO: Implement database clearing
      // This would typically use Supabase client to delete from onboarding_progress table
      console.log('Clearing onboarding progress from database for bar:', barId);
    } catch (error) {
      console.warn('Failed to clear onboarding progress from database:', error);
    }
  }
}

// Utility functions for backward compatibility with existing code
export function createOnboardingProgress(barId: string): OnboardingProgress {
  return OnboardingStateManager.createProgress(barId);
}

export async function saveOnboardingProgress(progress: OnboardingProgress): Promise<void> {
  return OnboardingStateManager.saveProgress(progress);
}

export async function restoreOnboardingProgress(barId: string): Promise<OnboardingProgress | null> {
  return OnboardingStateManager.restoreProgress(barId);
}

export async function clearOnboardingProgress(barId: string): Promise<void> {
  return OnboardingStateManager.clearProgress(barId);
}

export function validateOnboardingProgress(progress: OnboardingProgress): OnboardingValidation {
  return OnboardingStateManager.validateProgress(progress);
}

export function updateOnboardingStep(progress: OnboardingProgress, newStep: OnboardingStep): OnboardingProgress {
  return OnboardingStateManager.updateStep(progress, newStep);
}