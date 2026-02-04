/**
 * Themed Button Component
 * 
 * A button component that adapts its styling based on the current venue theme.
 * Provides consistent theming across different venue configurations.
 */

'use client';

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function ThemedButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
}: ThemedButtonProps) {
  const { themeConfig } = useTheme();

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return `${themeConfig.colors.primary} ${themeConfig.colors.primaryHover} text-white`;
      case 'secondary':
        return `${themeConfig.colors.primaryLight} ${themeConfig.colors.text} hover:${themeConfig.colors.background}`;
      case 'outline':
        return `border-2 ${themeConfig.colors.border} ${themeConfig.colors.text} hover:${themeConfig.colors.primaryLight}`;
      default:
        return `${themeConfig.colors.primary} ${themeConfig.colors.primaryHover} text-white`;
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2 text-base';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        font-semibold rounded-lg transition-colors duration-200
        ${getVariantClasses()}
        ${getSizeClasses()}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {children}
    </button>
  );
}