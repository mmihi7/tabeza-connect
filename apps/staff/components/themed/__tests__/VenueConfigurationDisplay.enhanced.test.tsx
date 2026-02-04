/**
 * Enhanced VenueConfigurationDisplay Component Tests
 * 
 * Tests for task 7.2 - configuration summary and feature explanations
 * Validates Requirements 5.4, 5.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { VenueConfigurationDisplay } from '../VenueConfigurationDisplay';
import { type VenueConfiguration } from '@tabeza/shared';

// Mock the ThemeContext and ThemedCard
jest.mock('../../../contexts/ThemeContext', () => ({
  getVenueThemeConfig: () => ({
    colors: {
      primary: 'bg-blue-600',
      primaryLight: 'bg-blue-100',
      text: 'text-blue-600',
      textLight: 'text-blue-600',
      background: 'bg-blue-50',
      border: 'border-blue-200'
    },
    description: 'Test Theme',
    icons: ['🔵']
  }),
  useTheme: () => ({
    themeConfig: {
      colors: {
        primary: 'bg-blue-600',
        primaryLight: 'bg-blue-100',
        text: 'text-blue-600',
        textLight: 'text-blue-600',
        background: 'bg-blue-50',
        border: 'border-blue-200'
      },
      description: 'Test Theme',
      icons: ['🔵']
    }
  })
}));

// Mock ThemedCard to avoid theme context issues
jest.mock('../ThemedCard', () => ({
  ThemedCard: ({ children, className = '', variant = 'default' }: any) => (
    <div className={`themed-card ${className} ${variant}`} data-testid="themed-card">
      {children}
    </div>
  )
}));

describe('VenueConfigurationDisplay - Enhanced Features', () => {
  const basicConfig: VenueConfiguration = {
    venue_mode: 'basic',
    authority_mode: 'pos',
    pos_integration_enabled: true,
    printer_required: true,
    onboarding_completed: true,
    authority_configured_at: '2024-01-01T00:00:00Z',
    mode_last_changed_at: '2024-01-01T00:00:00Z'
  };

  const venueTabezaConfig: VenueConfiguration = {
    venue_mode: 'venue',
    authority_mode: 'tabeza',
    pos_integration_enabled: false,
    printer_required: false,
    onboarding_completed: true,
    authority_configured_at: '2024-01-01T00:00:00Z',
    mode_last_changed_at: '2024-01-01T00:00:00Z'
  };

  const venuePosConfig: VenueConfiguration = {
    venue_mode: 'venue',
    authority_mode: 'pos',
    pos_integration_enabled: true,
    printer_required: false,
    onboarding_completed: true,
    authority_configured_at: '2024-01-01T00:00:00Z',
    mode_last_changed_at: '2024-01-01T00:00:00Z'
  };

  describe('Feature Display - Requirement 5.4', () => {
    it('should clearly show enabled and disabled features for Basic mode', () => {
      render(<VenueConfigurationDisplay config={basicConfig} showDetails={true} />);
      
      // Should show enabled features section
      expect(screen.getByText(/Enabled Features/)).toBeInTheDocument();
      expect(screen.getByText('POS Integration')).toBeInTheDocument();
      expect(screen.getByText('Digital Receipts')).toBeInTheDocument();
      expect(screen.getByText('Payment Processing')).toBeInTheDocument();
      
      // Should show disabled features section
      expect(screen.getByText(/Disabled Features/)).toBeInTheDocument();
      expect(screen.getByText('Customer Menus')).toBeInTheDocument();
      expect(screen.getByText('Customer Ordering')).toBeInTheDocument();
      expect(screen.getByText('Staff Ordering')).toBeInTheDocument();
      expect(screen.getByText('Two-way Messaging')).toBeInTheDocument();
    });

    it('should show different features for Venue + Tabeza mode', () => {
      render(<VenueConfigurationDisplay config={venueTabezaConfig} showDetails={true} />);
      
      // Should show enabled features
      expect(screen.getByText('Customer Menus')).toBeInTheDocument();
      expect(screen.getByText('Customer Ordering')).toBeInTheDocument();
      expect(screen.getByText('Staff Ordering')).toBeInTheDocument();
      expect(screen.getByText('Analytics & Reports')).toBeInTheDocument();
      
      // Should show POS Integration as disabled
      expect(screen.getByText('POS Integration')).toBeInTheDocument();
    });

    it('should show different features for Venue + POS mode', () => {
      render(<VenueConfigurationDisplay config={venuePosConfig} showDetails={true} />);
      
      // Should show enabled features
      expect(screen.getByText('Customer Menus')).toBeInTheDocument();
      expect(screen.getByText('Customer Order Requests')).toBeInTheDocument();
      expect(screen.getByText('POS Integration')).toBeInTheDocument();
      
      // Should show Staff Ordering as disabled
      expect(screen.getByText('Staff Ordering')).toBeInTheDocument();
    });
  });

  describe('Workflow Limitations - Requirement 5.5', () => {
    it('should explain workflow limitations for Basic mode', () => {
      render(<VenueConfigurationDisplay config={basicConfig} showDetails={true} />);
      
      expect(screen.getByText('Workflow Guidelines')).toBeInTheDocument();
      expect(screen.getByText('POS-Only Order Creation')).toBeInTheDocument();
      expect(screen.getByText('Traditional Service Required')).toBeInTheDocument();
      expect(screen.getByText('Printer Setup Required')).toBeInTheDocument();
      expect(screen.getByText('Manual Service Always Available')).toBeInTheDocument();
    });

    it('should explain workflow limitations for Venue + POS mode', () => {
      render(<VenueConfigurationDisplay config={venuePosConfig} showDetails={true} />);
      
      expect(screen.getByText('POS Confirmation Required')).toBeInTheDocument();
      expect(screen.getByText('Dual System Workflow')).toBeInTheDocument();
      expect(screen.getByText('POS Integration Setup')).toBeInTheDocument();
      expect(screen.getByText('Manual Service Always Available')).toBeInTheDocument();
    });

    it('should explain workflow limitations for Venue + Tabeza mode', () => {
      render(<VenueConfigurationDisplay config={venueTabezaConfig} showDetails={true} />);
      
      expect(screen.getByText('Tabeza-Only Order Processing')).toBeInTheDocument();
      expect(screen.getByText('No External POS Integration')).toBeInTheDocument();
      expect(screen.getByText('Manual Service Always Available')).toBeInTheDocument();
    });
  });

  describe('Configuration Summary', () => {
    it('should display configuration summary with clear values', () => {
      render(<VenueConfigurationDisplay config={basicConfig} showDetails={true} />);
      
      expect(screen.getByText('Configuration Summary')).toBeInTheDocument();
      expect(screen.getByText('Basic')).toBeInTheDocument();
      expect(screen.getByText('POS System')).toBeInTheDocument();
      expect(screen.getByText('Enabled')).toBeInTheDocument(); // POS Integration
      expect(screen.getByText('Yes')).toBeInTheDocument(); // Printer Required
    });
  });

  describe('Tooltips and Guidance', () => {
    it('should include helpful tooltips for features', () => {
      render(<VenueConfigurationDisplay config={basicConfig} showDetails={true} />);
      
      // Check for tooltip descriptions in features - be more specific
      expect(screen.getByText(/Required for Basic mode/)).toBeInTheDocument();
      expect(screen.getAllByText(/Not available in Basic mode/).length).toBeGreaterThan(0);
    });
  });

  describe('Visual Indicators', () => {
    it('should use different visual styles for enabled vs disabled features', () => {
      render(<VenueConfigurationDisplay config={basicConfig} showDetails={true} />);
      
      // Enabled features should have green styling
      const enabledSection = screen.getByText(/Enabled Features/).closest('div');
      expect(enabledSection).toBeInTheDocument();
      
      // Disabled features should have gray styling
      const disabledSection = screen.getByText(/Disabled Features/).closest('div');
      expect(disabledSection).toBeInTheDocument();
    });

    it('should use different colors for different limitation types', () => {
      render(<VenueConfigurationDisplay config={basicConfig} showDetails={true} />);
      
      // Should have workflow guidelines section
      expect(screen.getByText('Workflow Guidelines')).toBeInTheDocument();
      
      // Should have different types of limitations (info, warning, restriction)
      const workflowSection = screen.getByText('Workflow Guidelines').closest('div');
      expect(workflowSection).toBeInTheDocument();
    });
  });
});