/**
 * Themed Card Component
 * 
 * A card component that adapts its styling based on the current venue theme.
 * Used for displaying venue configuration information with appropriate theming.
 */

'use client';

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemedCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'highlighted' | 'subtle';
}

export function ThemedCard({ children, className = '', variant = 'default' }: ThemedCardProps) {
  const { themeConfig } = useTheme();

  const getVariantClasses = () => {
    switch (variant) {
      case 'highlighted':
        return `${themeConfig.colors.background} ${themeConfig.colors.border} border-2`;
      case 'subtle':
        return 'bg-gray-50 border border-gray-200';
      default:
        return 'bg-white border border-gray-200';
    }
  };

  return (
    <div className={`rounded-xl p-6 ${getVariantClasses()} ${className}`}>
      {children}
    </div>
  );
}