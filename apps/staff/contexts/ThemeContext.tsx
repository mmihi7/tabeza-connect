/**
 * Theme Context for Venue Configuration-Based Theming
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This context provides theme configuration based on venue mode and authority settings.
 * Implements Requirements 5.1, 5.2, 5.3 from onboarding-flow-fix specification.
 */

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { getThemeConfiguration, type VenueConfiguration } from '@tabeza/shared';

// Theme configuration types
export interface ThemeConfig {
  theme: 'blue' | 'yellow' | 'green';
  description: string;
  icons: string[];
  colors: {
    primary: string;
    primaryHover: string;
    primaryLight: string;
    primaryDark: string;
    background: string;
    border: string;
    text: string;
    textLight: string;
  };
}

// Theme configurations for each mode
const THEME_CONFIGS: Record<'blue' | 'yellow' | 'green', ThemeConfig> = {
  blue: {
    theme: 'blue',
    description: 'POS Bridge Mode',
    icons: ['🖨️', '📱', '💳'],
    colors: {
      primary: 'bg-blue-500',
      primaryHover: 'hover:bg-blue-600',
      primaryLight: 'bg-blue-100',
      primaryDark: 'bg-blue-600',
      background: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      textLight: 'text-blue-600',
    },
  },
  yellow: {
    theme: 'yellow',
    description: 'Hybrid Workflow Mode',
    icons: ['📋', '🖨️', '💬'],
    colors: {
      primary: 'bg-yellow-500',
      primaryHover: 'hover:bg-yellow-600',
      primaryLight: 'bg-yellow-100',
      primaryDark: 'bg-yellow-600',
      background: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      textLight: 'text-yellow-600',
    },
  },
  green: {
    theme: 'green',
    description: 'Full Service Mode',
    icons: ['📋', '💬', '💳', '📊'],
    colors: {
      primary: 'bg-green-500',
      primaryHover: 'hover:bg-green-600',
      primaryLight: 'bg-green-100',
      primaryDark: 'bg-green-600',
      background: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      textLight: 'text-green-600',
    },
  },
};

// Context interface
interface ThemeContextType {
  themeConfig: ThemeConfig;
  updateTheme: (venueConfig: VenueConfiguration) => void;
  getThemeClasses: (element: 'primary' | 'background' | 'border' | 'text') => string;
}

// Create context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider props
interface ThemeProviderProps {
  children: ReactNode;
  initialVenueConfig?: VenueConfiguration;
}

// Default theme (fallback to blue)
const DEFAULT_THEME = THEME_CONFIGS.blue;

// Theme provider component
export function ThemeProvider({ children, initialVenueConfig }: ThemeProviderProps) {
  const [themeConfig, setThemeConfig] = React.useState<ThemeConfig>(() => {
    if (initialVenueConfig) {
      const { theme } = getThemeConfiguration(initialVenueConfig);
      return THEME_CONFIGS[theme] || DEFAULT_THEME;
    }
    return DEFAULT_THEME;
  });

  const updateTheme = React.useCallback((venueConfig: VenueConfiguration) => {
    const { theme } = getThemeConfiguration(venueConfig);
    const newThemeConfig = THEME_CONFIGS[theme] || DEFAULT_THEME;
    setThemeConfig(newThemeConfig);
  }, []);

  const getThemeClasses = React.useCallback((element: 'primary' | 'background' | 'border' | 'text') => {
    switch (element) {
      case 'primary':
        return `${themeConfig.colors.primary} ${themeConfig.colors.primaryHover}`;
      case 'background':
        return `${themeConfig.colors.background} ${themeConfig.colors.border}`;
      case 'border':
        return themeConfig.colors.border;
      case 'text':
        return themeConfig.colors.text;
      default:
        return '';
    }
  }, [themeConfig]);

  const value: ThemeContextType = {
    themeConfig,
    updateTheme,
    getThemeClasses,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme context
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Utility function to get theme configuration without context
export function getVenueThemeConfig(venueConfig: VenueConfiguration): ThemeConfig {
  const { theme } = getThemeConfiguration(venueConfig);
  return THEME_CONFIGS[theme] || DEFAULT_THEME;
}

// Helper function to generate theme classes for specific venue config
export function getVenueThemeClasses(
  venueConfig: VenueConfiguration,
  element: 'primary' | 'background' | 'border' | 'text' | 'icon'
): string {
  const { theme } = getThemeConfiguration(venueConfig);
  const themeConfig = THEME_CONFIGS[theme] || DEFAULT_THEME;

  switch (element) {
    case 'primary':
      return `${themeConfig.colors.primary} ${themeConfig.colors.primaryHover}`;
    case 'background':
      return `${themeConfig.colors.background} ${themeConfig.colors.border}`;
    case 'border':
      return themeConfig.colors.border;
    case 'text':
      return themeConfig.colors.text;
    case 'icon':
      return themeConfig.colors.textLight;
    default:
      return '';
  }
}