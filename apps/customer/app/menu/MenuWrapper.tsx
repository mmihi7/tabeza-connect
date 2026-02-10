/**
 * Menu Wrapper Component
 * Task 7: Customer Menu Page Adaptation
 * 
 * Provides mode configuration context to the menu page.
 * The menu page uses this to conditionally render sections based on mode:
 * - POS mode: Shows ONLY messages, orders, payment
 * - Tabeza mode: Shows full menu with ordering
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchModeConfig, type ModeConfiguration } from '@tabeza/shared/services/modeConfigService';

interface ModeContextValue {
  config: ModeConfiguration | null;
  loading: boolean;
}

const ModeContext = createContext<ModeContextValue>({ config: null, loading: true });

export function useModeConfig() {
  return useContext(ModeContext);
}

interface MenuWrapperProps {
  children: React.ReactNode;
}

export function MenuWrapper({ children }: MenuWrapperProps): React.JSX.Element {
  const router = useRouter();
  const [config, setConfig] = useState<ModeConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadModeConfig = async () => {
      try {
        // Get bar ID from session storage (set when tab is opened)
        const tabData = sessionStorage.getItem('currentTab');
        if (!tabData) {
          // No tab found, redirect to home
          router.replace('/');
          return;
        }
        
        const tab = JSON.parse(tabData);
        const currentBarId = tab.bar_id;
        
        if (!currentBarId) {
          console.error('No bar ID found in tab data');
          setLoading(false);
          return;
        }
        
        // Fetch mode configuration
        const modeConfig = await fetchModeConfig(currentBarId);
        
        console.log('🔍 Menu mode config loaded:', {
          barId: currentBarId,
          venue_mode: modeConfig.venue_mode,
          authority_mode: modeConfig.authority_mode,
          isBasic: modeConfig.isBasic,
          isPOSAuthority: modeConfig.isPOSAuthority
        });
        
        setConfig(modeConfig);
        setLoading(false);
        
      } catch (error) {
        console.error('Error loading mode config:', error);
        // On error, allow access to menu (fail open with Tabeza mode)
        setLoading(false);
      }
    };
    
    loadModeConfig();
  }, [router]);
  
  // Show loading state while fetching mode
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Provide mode config to children
  return (
    <ModeContext.Provider value={{ config, loading }}>
      {children}
    </ModeContext.Provider>
  );
}
