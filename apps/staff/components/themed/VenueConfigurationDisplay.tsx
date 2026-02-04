/**
 * Venue Configuration Display Component
 * 
 * Displays venue configuration information with appropriate theming based on
 * the venue's mode and authority settings. Shows enabled/disabled features
 * clearly and explains workflow limitations.
 * 
 * Implements Requirements 5.1, 5.2, 5.3, 5.4, 5.5.
 */

'use client';

import React from 'react';
import { 
  Printer, 
  Menu, 
  MessageSquare, 
  CreditCard, 
  BarChart3, 
  Settings, 
  Check, 
  X, 
  AlertTriangle, 
  Info,
  Users,
  ShoppingCart,
  Receipt,
  Smartphone
} from 'lucide-react';
import { getVenueThemeConfig } from '../../contexts/ThemeContext';
import { ThemedCard } from './ThemedCard';
import { type VenueConfiguration } from '@tabeza/shared';

interface VenueConfigurationDisplayProps {
  config: VenueConfiguration;
  showDetails?: boolean;
  className?: string;
}

// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.

// Feature definitions based on venue configuration
interface FeatureDefinition {
  name: string;
  description: string;
  enabled: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tooltip?: string;
}

interface WorkflowLimitation {
  title: string;
  description: string;
  type: 'info' | 'warning' | 'restriction';
}

const getFeatureDefinitions = (config: VenueConfiguration): FeatureDefinition[] => {
  const features: FeatureDefinition[] = [];

  if (config.venue_mode === 'basic') {
    // Basic mode features - POS bridge only
    features.push(
      {
        name: 'POS Integration',
        description: 'Connect with your existing POS system',
        enabled: true,
        icon: Printer,
        tooltip: 'Required for Basic mode - all orders come from your POS'
      },
      {
        name: 'Digital Receipts',
        description: 'Send receipts to customers digitally',
        enabled: true,
        icon: Receipt,
        tooltip: 'Customers receive digital copies of POS receipts'
      },
      {
        name: 'Payment Processing',
        description: 'Accept mobile and card payments',
        enabled: true,
        icon: CreditCard,
        tooltip: 'Customers can pay through the app'
      },
      {
        name: 'Customer Menus',
        description: 'Interactive menu browsing',
        enabled: false,
        icon: Menu,
        tooltip: 'Not available in Basic mode - customers use physical menus'
      },
      {
        name: 'Customer Ordering',
        description: 'Direct customer order placement',
        enabled: false,
        icon: ShoppingCart,
        tooltip: 'Not available in Basic mode - orders come through POS only'
      },
      {
        name: 'Staff Ordering',
        description: 'Staff can create orders in Tabeza',
        enabled: false,
        icon: Users,
        tooltip: 'Not available in Basic mode - staff use POS for all orders'
      },
      {
        name: 'Two-way Messaging',
        description: 'Chat with customers',
        enabled: false,
        icon: MessageSquare,
        tooltip: 'Not available in Basic mode - communication is through traditional service'
      }
    );
  } else {
    // Venue mode features
    features.push(
      {
        name: 'Customer Menus',
        description: 'Interactive menu browsing',
        enabled: true,
        icon: Menu,
        tooltip: 'Customers can browse your menu on their phones'
      },
      {
        name: 'Two-way Messaging',
        description: 'Chat with customers',
        enabled: true,
        icon: MessageSquare,
        tooltip: 'Staff and customers can communicate through the app'
      },
      {
        name: 'Payment Processing',
        description: 'Accept mobile and card payments',
        enabled: true,
        icon: CreditCard,
        tooltip: 'Customers can pay through the app'
      }
    );

    if (config.authority_mode === 'pos') {
      // Venue + POS authority
      features.push(
        {
          name: 'POS Integration',
          description: 'Connect with your existing POS system',
          enabled: true,
          icon: Printer,
          tooltip: 'Orders are created in your POS system'
        },
        {
          name: 'Customer Order Requests',
          description: 'Customers can request orders',
          enabled: true,
          icon: ShoppingCart,
          tooltip: 'Customers send order requests that staff confirm in POS'
        },
        {
          name: 'Staff Ordering',
          description: 'Staff can create orders in Tabeza',
          enabled: false,
          icon: Users,
          tooltip: 'Staff use POS for order creation - Tabeza shows requests only'
        },
        {
          name: 'Digital Receipts',
          description: 'Send receipts to customers digitally',
          enabled: true,
          icon: Receipt,
          tooltip: 'Digital copies of POS receipts sent to customers'
        }
      );
    } else {
      // Venue + Tabeza authority
      features.push(
        {
          name: 'Customer Ordering',
          description: 'Direct customer order placement',
          enabled: true,
          icon: ShoppingCart,
          tooltip: 'Customers can place orders directly through the app'
        },
        {
          name: 'Staff Ordering',
          description: 'Staff can create orders in Tabeza',
          enabled: true,
          icon: Users,
          tooltip: 'Staff can create orders directly in Tabeza'
        },
        {
          name: 'Digital Receipts',
          description: 'Generate digital receipts',
          enabled: true,
          icon: Receipt,
          tooltip: 'Tabeza generates and sends digital receipts'
        },
        {
          name: 'Analytics & Reports',
          description: 'View sales and order analytics',
          enabled: true,
          icon: BarChart3,
          tooltip: 'Built-in reporting and analytics dashboard'
        },
        {
          name: 'POS Integration',
          description: 'Connect with external POS system',
          enabled: false,
          icon: Printer,
          tooltip: 'Not needed - Tabeza handles all order processing'
        }
      );
    }
  }

  return features;
};

const getWorkflowLimitations = (config: VenueConfiguration): WorkflowLimitation[] => {
  const limitations: WorkflowLimitation[] = [];

  if (config.venue_mode === 'basic') {
    limitations.push(
      {
        title: 'POS-Only Order Creation',
        description: 'All orders must be created in your POS system. Tabeza mirrors these orders digitally but cannot create new ones.',
        type: 'restriction'
      },
      {
        title: 'Traditional Service Required',
        description: 'Customers cannot browse menus or place orders through the app. They must order through traditional waiter service.',
        type: 'info'
      },
      {
        title: 'Printer Setup Required',
        description: 'A thermal printer must be connected to your POS system for receipt printing and digital mirroring.',
        type: 'warning'
      }
    );
  } else if (config.authority_mode === 'pos') {
    limitations.push(
      {
        title: 'POS Confirmation Required',
        description: 'Customer order requests must be confirmed and processed through your POS system. Staff cannot create orders directly in Tabeza.',
        type: 'restriction'
      },
      {
        title: 'Dual System Workflow',
        description: 'Staff will use both Tabeza (for customer requests) and POS (for order processing). Ensure both systems are accessible.',
        type: 'info'
      },
      {
        title: 'POS Integration Setup',
        description: 'Your POS system must be configured to send receipt data to Tabeza for digital delivery.',
        type: 'warning'
      }
    );
  } else {
    limitations.push(
      {
        title: 'Tabeza-Only Order Processing',
        description: 'All orders are processed through Tabeza. Staff should be trained on the Tabeza ordering interface.',
        type: 'info'
      },
      {
        title: 'No External POS Integration',
        description: 'Orders will not appear in external POS systems. Use Tabeza\'s built-in reporting for sales tracking.',
        type: 'info'
      }
    );
  }

  // Universal limitations that always apply
  limitations.push({
    title: 'Manual Service Always Available',
    description: 'Traditional waiter service and manual ordering continue to work alongside digital features. Staff can always take orders manually.',
    type: 'info'
  });

  return limitations;
};

export function VenueConfigurationDisplay({ 
  config, 
  showDetails = true, 
  className = '' 
}: VenueConfigurationDisplayProps) {
  const themeConfig = getVenueThemeConfig(config);
  const features = getFeatureDefinitions(config);
  const limitations = getWorkflowLimitations(config);

  const getModeName = () => {
    if (config.venue_mode === 'basic') {
      return 'Tabeza Basic';
    }
    return 'Tabeza Venue';
  };

  const getModeDescription = () => {
    if (config.venue_mode === 'basic') {
      return 'Transaction & Receipt Bridge';
    }
    
    if (config.authority_mode === 'pos') {
      return 'Customer Interaction + POS Integration';
    }
    
    return 'Full Service Platform';
  };

  const getAuthorityDescription = () => {
    if (config.authority_mode === 'pos') {
      return 'POS System Authority';
    }
    return 'Tabeza Authority';
  };

  const enabledFeatures = features.filter(f => f.enabled);
  const disabledFeatures = features.filter(f => !f.enabled);

  return (
    <div className={`${className}`}>
      <ThemedCard variant="highlighted">
        {/* Header with icon and title */}
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${themeConfig.colors.primaryLight}`}>
            {config.venue_mode === 'basic' ? (
              <Printer size={32} className={themeConfig.colors.textLight} />
            ) : config.authority_mode === 'pos' ? (
              <div className="flex items-center gap-1">
                <Menu size={20} className={themeConfig.colors.textLight} />
                <Printer size={20} className={themeConfig.colors.textLight} />
              </div>
            ) : (
              <Menu size={32} className={themeConfig.colors.textLight} />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {getModeName()}
            </h2>
            <p className="text-gray-600">
              {getModeDescription()}
            </p>
            <p className={`text-sm font-medium ${themeConfig.colors.text}`}>
              {getAuthorityDescription()}
            </p>
          </div>
        </div>

        {showDetails && (
          <div className="space-y-6">
            {/* Enabled Features */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Check size={16} className="text-green-600" />
                Enabled Features ({enabledFeatures.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {enabledFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className={`p-2 rounded-lg ${themeConfig.colors.primaryLight}`}>
                      <feature.icon size={16} className={themeConfig.colors.textLight} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{feature.name}</span>
                        {feature.tooltip && (
                          <div className="group relative">
                            <Info size={12} className="text-gray-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                              {feature.tooltip}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">{feature.description}</p>
                    </div>
                    <Check size={16} className="text-green-600 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Disabled Features */}
            {disabledFeatures.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <X size={16} className="text-gray-400" />
                  Disabled Features ({disabledFeatures.length})
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {disabledFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-75">
                      <div className="p-2 rounded-lg bg-gray-200">
                        <feature.icon size={16} className="text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-500">{feature.name}</span>
                          {feature.tooltip && (
                            <div className="group relative">
                              <Info size={12} className="text-gray-400 cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                {feature.tooltip}
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{feature.description}</p>
                      </div>
                      <X size={16} className="text-gray-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workflow Limitations */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                Workflow Guidelines
              </h3>
              <div className="space-y-3">
                {limitations.map((limitation, index) => (
                  <div key={index} className={`p-4 rounded-lg border-l-4 ${
                    limitation.type === 'warning' 
                      ? 'bg-amber-50 border-amber-400 border-l-amber-400' 
                      : limitation.type === 'restriction'
                      ? 'bg-red-50 border-red-400 border-l-red-400'
                      : 'bg-blue-50 border-blue-400 border-l-blue-400'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-1 rounded ${
                        limitation.type === 'warning' 
                          ? 'bg-amber-100' 
                          : limitation.type === 'restriction'
                          ? 'bg-red-100'
                          : 'bg-blue-100'
                      }`}>
                        {limitation.type === 'warning' ? (
                          <AlertTriangle size={14} className="text-amber-600" />
                        ) : limitation.type === 'restriction' ? (
                          <X size={14} className="text-red-600" />
                        ) : (
                          <Info size={14} className="text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${
                          limitation.type === 'warning' 
                            ? 'text-amber-800' 
                            : limitation.type === 'restriction'
                            ? 'text-red-800'
                            : 'text-blue-800'
                        }`}>
                          {limitation.title}
                        </h4>
                        <p className={`text-xs mt-1 ${
                          limitation.type === 'warning' 
                            ? 'text-amber-700' 
                            : limitation.type === 'restriction'
                            ? 'text-red-700'
                            : 'text-blue-700'
                        }`}>
                          {limitation.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration Summary */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Configuration Summary</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Mode:</span>
                    <span className={`font-semibold ${themeConfig.colors.text}`}>
                      {config.venue_mode === 'basic' ? 'Basic' : 'Venue'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Authority:</span>
                    <span className={`font-semibold ${themeConfig.colors.text}`}>
                      {config.authority_mode === 'pos' ? 'POS System' : 'Tabeza'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">POS Integration:</span>
                    <span className={config.pos_integration_enabled ? 'text-green-600 font-medium' : 'text-gray-500'}>
                      {config.pos_integration_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Printer Required:</span>
                    <span className={config.printer_required ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                      {config.printer_required ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Theme indicator */}
        <div className={`mt-6 p-3 rounded-lg ${themeConfig.colors.background} ${themeConfig.colors.border} border`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${themeConfig.colors.primary}`}></div>
              <span className={`text-sm font-medium ${themeConfig.colors.text}`}>
                {themeConfig.description}
              </span>
            </div>
            <div className="flex gap-1">
              {themeConfig.icons.map((emoji, index) => (
                <span key={index} className="text-lg">{emoji}</span>
              ))}
            </div>
          </div>
        </div>
      </ThemedCard>
    </div>
  );
}