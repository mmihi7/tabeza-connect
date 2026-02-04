/**
 * Themed Icon Component
 * 
 * An icon wrapper component that applies theme-appropriate colors and styling.
 * Used for displaying icons with consistent theming across venue configurations.
 */

'use client';

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { LucideIcon } from 'lucide-react';

interface ThemedIconProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
  variant?: 'primary' | 'light' | 'dark';
}

export function ThemedIcon({ 
  icon: Icon, 
  size = 20, 
  className = '', 
  variant = 'primary' 
}: ThemedIconProps) {
  const { themeConfig } = useTheme();

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return themeConfig.colors.textLight;
      case 'light':
        return themeConfig.colors.primaryLight.replace('bg-', 'text-');
      case 'dark':
        return themeConfig.colors.text;
      default:
        return themeConfig.colors.textLight;
    }
  };

  return (
    <Icon 
      size={size} 
      className={`${getVariantClasses()} ${className}`} 
    />
  );
}