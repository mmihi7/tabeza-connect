// apps/staff/app/settings/page.tsx - Fixed payment column names
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, Store, Bell, QrCode, Save, X, MessageSquare, Copy, Check, Edit2, Download, AlertCircle, CreditCard, Phone, DollarSign, Send, Clock, Calendar, Sun, Moon, BellRing, Grid3X3, Menu, Printer, AlertTriangle, Settings, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import VenueModeOnboarding from '@/components/VenueModeOnboarding';
import { useVenueConfigurationValidation } from '@/hooks/useVenueConfigurationValidation';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { VenueConfigurationDisplay } from '@/components/themed/VenueConfigurationDisplay';
import { ThemedButton } from '@/components/themed/ThemedButton';
import { ThemedCard } from '@/components/themed/ThemedCard';
import ConfigurationHistory from '@/components/ConfigurationHistory';
import { type VenueConfiguration } from '@tabeza/shared';
import PrinterStatusIndicator from '@/components/PrinterStatusIndicator';

import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Types for business hours
type DayHours = {
  day: string;
  label: string;
  open: boolean;
  openTime: string;
  closeTime: string;
  openNextDay: boolean;
};

type BusinessHoursMode = 'simple' | 'advanced' | '24hours';

export default function SettingsPage() {
  const router = useRouter();
  const [barInfo, setBarInfo] = useState({
    id: '',
    name: '',
    location: '',
    city: '',
    phone: '',
    email: '',
    slug: ''
  });
  const [editMode, setEditMode] = useState(false);
  const [editedInfo, setEditedInfo] = useState({ ...barInfo });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  
  const [notifications, setNotifications] = useState({
    newOrders: false,
    pendingApprovals: false,
    payments: false
  });

  // Payment settings (excluding M-Pesa which has its own section)
  const [paymentSettings, setPaymentSettings] = useState({
    payment_card_enabled: false,
    payment_cash_enabled: true
  });
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);
  
  // Feedback form state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  // Alert settings state
  const [alertSettings, setAlertSettings] = useState({
    timeout: 5,
    soundEnabled: true,
    customAudioUrl: '',
    customAudioName: '',
    volume: 0.8
  });
  const [savingAlertSettings, setSavingAlertSettings] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // Table setup state
  const [tableSettings, setTableSettings] = useState({
    table_setup_enabled: false,
    table_count: 20
  });
  const [savingTableSettings, setSavingTableSettings] = useState(false);

  // M-Pesa Setup State
  const [mpesaSettings, setMpesaSettings] = useState({
    mpesa_enabled: false,
    mpesa_environment: 'sandbox' as 'sandbox' | 'production',
    mpesa_business_shortcode: '',
    mpesa_consumer_key: '',
    mpesa_consumer_secret: '',
    mpesa_passkey: '',
    mpesa_setup_completed: false,
    mpesa_last_test_at: null as string | null,
    mpesa_test_status: 'pending' as 'pending' | 'success' | 'failed'
  });
  const [savingMpesaSettings, setSavingMpesaSettings] = useState(false);
  const [testingMpesa, setTestingMpesa] = useState(false);
  const [showMpesaSetup, setShowMpesaSetup] = useState(false);

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState<'general' | 'venue' | 'payments' | 'notifications' | 'operations'>('general');

  // Venue Mode State
  const [venueMode, setVenueMode] = useState<'basic' | 'venue'>('venue');
  const [authorityMode, setAuthorityMode] = useState<'pos' | 'tabeza'>('tabeza');
  const [posIntegrationEnabled, setPosIntegrationEnabled] = useState(false);
  const [printerRequired, setPrinterRequired] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [showVenueModeModal, setShowVenueModeModal] = useState(false);
  const [savingVenueMode, setSavingVenueMode] = useState(false);

  // Printer Setup State
  const [printerServiceStatus, setPrinterServiceStatus] = useState<'checking' | 'online' | 'offline' | 'error'>('checking');
  const [printerBarIdCopied, setPrinterBarIdCopied] = useState(false);
  const [configuringPrinter, setConfiguringPrinter] = useState(false);

  // Configuration Change Validation State
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingConfigChange, setPendingConfigChange] = useState<{
    venue_mode: 'basic' | 'venue';
    authority_mode: 'pos' | 'tabeza';
    pos_integration_enabled: boolean;
    printer_required: boolean;
  } | null>(null);
  const [configChangeWarnings, setConfigChangeWarnings] = useState<string[]>([]);

  // Venue Configuration Validation Hook
  const {
    validateChange,
    getDescription,
    getTheme,
    validateWithAPI,
    isValidating,
    lastValidationResult
  } = useVenueConfigurationValidation();

  // Business Hours State
  const [businessHoursMode, setBusinessHoursMode] = useState<BusinessHoursMode>('simple');
  const [savingHours, setSavingHours] = useState(false);
  const [simpleHours, setSimpleHours] = useState({
    openTime: '09:00',
    closeTime: '23:00',
    closeNextDay: false
  });
  const [advancedHours, setAdvancedHours] = useState<DayHours[]>([
    { day: 'monday', label: 'Monday', open: true, openTime: '09:00', closeTime: '23:00', openNextDay: false },
    { day: 'tuesday', label: 'Tuesday', open: true, openTime: '09:00', closeTime: '23:00', openNextDay: false },
    { day: 'wednesday', label: 'Wednesday', open: true, openTime: '09:00', closeTime: '23:00', openNextDay: false },
    { day: 'thursday', label: 'Thursday', open: true, openTime: '09:00', closeTime: '23:00', openNextDay: false },
    { day: 'friday', label: 'Friday', open: true, openTime: '09:00', closeTime: '02:00', openNextDay: true },
    { day: 'saturday', label: 'Saturday', open: true, openTime: '10:00', closeTime: '02:00', openNextDay: true },
    { day: 'sunday', label: 'Sunday', open: true, openTime: '10:00', closeTime: '22:00', openNextDay: false },
  ]);

  useEffect(() => {
    loadBarInfo();
    checkPrinterServiceStatus();
  }, []);

  // Debug: Log activeTab changes
  useEffect(() => {
    console.log('Active tab changed to:', activeTab);
  }, [activeTab]);

  // Force venue mode onboarding for venues that haven't completed onboarding
  useEffect(() => {
    if (!loading && !onboardingCompleted) {
      console.log('🚨 Venue onboarding incomplete - forcing onboarding modal');
      setShowVenueModeModal(true);
    }
  }, [loading, onboardingCompleted]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  };

  // CORE TRUTH: Manual service always exists. 
  // Digital authority is singular. 
  // Tabeza adapts to the venue — never the reverse.

  const checkPrinterServiceStatus = async () => {
    try {
      setPrinterServiceStatus('checking');
      const response = await fetch('/api/printer/driver-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPrinterServiceStatus(data.isOnline ? 'online' : 'offline');
      } else {
        setPrinterServiceStatus('offline');
      }
    } catch (error) {
      console.error('Error checking printer service status:', error);
      setPrinterServiceStatus('offline');
    }
  };

  const handleCopyPrinterBarId = () => {
    if (barInfo.id) {
      navigator.clipboard.writeText(barInfo.id);
      setPrinterBarIdCopied(true);
      setTimeout(() => setPrinterBarIdCopied(false), 2000);
    }
  };

  const handleAutoConfigurePrinter = async () => {
    if (!barInfo.id) {
      alert('❌ Bar ID not found. Please refresh the page.');
      return;
    }

    setConfiguringPrinter(true);
    try {
      const response = await fetch('/api/printer/configure-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barId: barInfo.id }),
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Printer service configured successfully!\n\nYour printer is now connected to Tabeza.');
      } else {
        if (response.status === 503) {
          alert(
            '❌ Cannot connect to printer service.\n\n' +
            'Please make sure:\n' +
            '1. You have downloaded the printer service\n' +
            '2. The printer service is running on this computer\n' +
            '3. You can see the terminal window with "Tabeza Printer Service - Running"\n\n' +
            'Then try again.'
          );
        } else {
          alert(`❌ Configuration failed: ${data.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error configuring printer:', error);
      alert(
        '❌ Failed to configure printer service.\n\n' +
        'Make sure the printer service is running on this computer.'
      );
    } finally {
      setConfiguringPrinter(false);
    }
  };

  const checkAndApplyVenueMigration = async (barId: string) => {
    try {
      console.log('🔍 Checking if venue needs migration:', barId);
      
      const response = await fetch('/api/venue-migration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barId })
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ Migration check failed:', result.error);
        
        // Show user-friendly error message if available
        const errorMessage = result.userMessage || result.error || 'Migration check failed';
        
        return { 
          migrationNeeded: false, 
          error: errorMessage,
          canRetry: result.canRetry || false
        };
      }

      if (result.migrationNeeded && result.migrationCompleted) {
        console.log('✅ Venue migration completed successfully');
        return { 
          migrationNeeded: true, 
          migrationCompleted: true, 
          venue: result.venue
        };
      } else if (result.migrationNeeded) {
        console.log('⚠️ Venue needs migration but it was not completed');
        return { 
          migrationNeeded: true, 
          migrationCompleted: false,
          error: 'Migration was needed but could not be completed automatically'
        };
      } else {
        console.log('✅ Venue does not need migration');
        return { migrationNeeded: false, venue: result.venue };
      }
    } catch (error: any) {
      console.error('❌ Error during migration check:', error);
      
      // Provide user-friendly error message for network/connection issues
      const errorMessage = error.name === 'TypeError' && error.message.includes('fetch')
        ? 'Unable to connect to the server. Please check your internet connection and try again.'
        : 'Migration check failed. Please try again or contact support if the problem persists.';
      
      return { 
        migrationNeeded: false, 
        error: errorMessage,
        canRetry: true
      };
    }
  };

  const loadBarInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata?.bar_id;
      
      if (!userBarId) {
        console.error('No bar_id in user metadata');
        alert('Your account is not linked to a bar. Please contact administrator.');
        router.push('/login');
        return;
      }

      // Check and apply venue migration if needed
      const migrationResult = await checkAndApplyVenueMigration(userBarId);
      
      if (migrationResult.error) {
        console.warn('⚠️ Migration check failed, continuing with normal load:', migrationResult.error);
      } else if (migrationResult.migrationCompleted) {
        console.log('✅ Venue migration completed, using migrated data');
        // Migration was successful, we can use the returned venue data
        if (migrationResult.venue) {
          // Update local state with migrated venue configuration
          setVenueMode(migrationResult.venue.venue_mode || 'venue');
          setAuthorityMode(migrationResult.venue.authority_mode || 'tabeza');
          setPosIntegrationEnabled(migrationResult.venue.pos_integration_enabled || false);
          setPrinterRequired(migrationResult.venue.printer_required || false);
          setOnboardingCompleted(migrationResult.venue.onboarding_completed || true);
        }
      }

      const { data, error } = await supabase
        .from('bars')
        .select('*')
        .eq('id', userBarId)
        .single() as { data: any, error: any };

      if (error) {
        console.error('Error loading bar:', error);
        throw error;
      }

      if (!data) {
        alert('Bar not found. Please contact administrator.');
        router.push('/login');
        return;
      }

      const locationParts = data.location ? data.location.split(',') : ['', ''];
      const info = {
        id: data.id,
        name: data.name || '',
        location: locationParts[0]?.trim() || '',
        city: locationParts[1]?.trim() || '',
        phone: data.phone || '',
        email: data.email || '',
        slug: data.slug || ''
      };
      
      const incomplete = !info.slug || !info.name;
      setIsNewUser(incomplete);
      setEditMode(incomplete);
      
      setBarInfo(info);
      setEditedInfo(info);
      
      // Pre-fill feedback form with user info
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.email) {
        setFeedbackForm(prev => ({
          ...prev,
          name: info.name || '',
          email: currentUser.email || ''
        }));
      }
      
      // Load payment settings (excluding M-Pesa which has its own section)
      setPaymentSettings({
        payment_card_enabled: data.payment_card_enabled ?? false,
        payment_cash_enabled: data.payment_cash_enabled ?? true
      });
      
      // Load notification settings
      setNotifications({
        newOrders: data.notification_new_orders ?? false,
        pendingApprovals: data.notification_pending_approvals ?? false,
        payments: data.notification_payments ?? false
      });

      // Load alert settings
      setAlertSettings({
        timeout: data.alert_timeout ?? 5,
        soundEnabled: data.alert_sound_enabled ?? true,
        customAudioUrl: data.alert_custom_audio_url ?? '',
        customAudioName: data.alert_custom_audio_name ?? '',
        volume: data.alert_volume ?? 0.8
      });

      // Load table settings
      setTableSettings({
        table_setup_enabled: data.table_setup_enabled ?? false,
        table_count: data.table_count ?? 20
      });

      // Load venue mode settings
      setVenueMode(data.venue_mode ?? 'venue');
      setAuthorityMode(data.authority_mode ?? 'tabeza');
      setPosIntegrationEnabled(data.pos_integration_enabled ?? false);
      setPrinterRequired(data.printer_required ?? false);
      setOnboardingCompleted(data.onboarding_completed ?? true);

      // Load M-Pesa settings via API to get masked credentials
      try {
        const mpesaResponse = await fetch(`/api/mpesa-settings?barId=${userBarId}`);
        if (mpesaResponse.ok) {
          const mpesaResult = await mpesaResponse.json();
          if (mpesaResult.success) {
            console.log('✅ M-Pesa settings loaded:', mpesaResult.settings);
            setMpesaSettings(mpesaResult.settings);
          } else {
            console.warn('⚠️ Failed to load M-Pesa settings:', mpesaResult.error);
            // Fallback to basic settings from bars table
            setMpesaSettings({
              mpesa_enabled: data.mpesa_enabled ?? false,
              mpesa_environment: data.mpesa_environment ?? 'sandbox',
              mpesa_business_shortcode: data.mpesa_business_shortcode ?? '',
              mpesa_consumer_key: '',
              mpesa_consumer_secret: '',
              mpesa_passkey: '',
              mpesa_setup_completed: data.mpesa_setup_completed ?? false,
              mpesa_last_test_at: data.mpesa_last_test_at ?? null,
              mpesa_test_status: data.mpesa_test_status ?? 'pending'
            });
          }
        } else {
          throw new Error('Failed to fetch M-Pesa settings');
        }
      } catch (mpesaError) {
        console.error('❌ Error loading M-Pesa settings:', mpesaError);
        // Fallback to basic settings from bars table
        setMpesaSettings({
          mpesa_enabled: data.mpesa_enabled ?? false,
          mpesa_environment: data.mpesa_environment ?? 'sandbox',
          mpesa_business_shortcode: data.mpesa_business_shortcode ?? '',
          mpesa_consumer_key: '',
          mpesa_consumer_secret: '',
          mpesa_passkey: '',
          mpesa_setup_completed: data.mpesa_setup_completed ?? false,
          mpesa_last_test_at: data.mpesa_last_test_at ?? null,
          mpesa_test_status: data.mpesa_test_status ?? 'pending'
        });
      }

      // Load business hours
      if (data.business_hours_mode) {
        setBusinessHoursMode(data.business_hours_mode);
      }

      if (data.business_hours_simple) {
        setSimpleHours(data.business_hours_simple);
      }

      if (data.business_hours_advanced) {
        setAdvancedHours(data.business_hours_advanced);
      }
    } catch (error) {
      console.error('Error loading bar info:', error);
      alert('Failed to load bar information');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBarInfo = async () => {
    if (!editedInfo.name.trim()) {
      alert('❌ Restaurant name is required');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;
      const fullLocation = editedInfo.city 
        ? `${editedInfo.location}, ${editedInfo.city}`
        : editedInfo.location;

      let slug = editedInfo.slug || generateSlug(editedInfo.name);

      const { data: existingBar } = await supabase
        .from('bars')
        .select('id')
        .eq('slug', slug)
        .neq('id', userBarId)
        .single() as { data: any, error: any };

      if (existingBar) {
        slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
      }

      const { error } = await (supabase as any)
        .from('bars')
        .update({
          name: editedInfo.name,
          location: fullLocation,
          phone: editedInfo.phone,
          email: editedInfo.email,
          slug: slug,
          active: true
        })
        .eq('id', userBarId);

      if (error) throw error;

      await loadBarInfo();
      setEditMode(false);
      setIsNewUser(false);
      alert('✅ Restaurant information saved!\n\nYour QR code is ready to download.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (isNewUser) {
      alert('Please complete your restaurant setup to continue.');
      return;
    }
    setEditedInfo({ ...barInfo });
    setEditMode(false);
  };

  const handleSavePaymentSettings = async () => {
    // Validate that at least one payment method is enabled
    if (!paymentSettings.payment_card_enabled && 
        !paymentSettings.payment_cash_enabled) {
      alert('❌ At least one payment method must be enabled.');
      return;
    }

    setSavingPaymentSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      const { error } = await (supabase as any)
        .from('bars')
        .update({
          payment_card_enabled: paymentSettings.payment_card_enabled,
          payment_cash_enabled: paymentSettings.payment_cash_enabled
        })
        .eq('id', userBarId);

      if (error) throw error;

      alert('✅ Payment settings saved successfully!');
    } catch (error) {
      console.error('Error saving payment settings:', error);
      alert('Failed to save payment settings. Please try again.');
    } finally {
      setSavingPaymentSettings(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      const { error } = await (supabase as any)
        .from('bars')
        .update({
          notification_new_orders: notifications.newOrders,
          notification_pending_approvals: notifications.pendingApprovals,
          notification_payments: notifications.payments
        })
        .eq('id', userBarId);

      if (error) throw error;

      alert('✅ Notification settings saved!');
    } catch (error) {
      setFeedbackError('Failed to save notification settings. Please try again.');
    }
  };

  const handleSaveBusinessHours = async () => {
    setSavingHours(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      // Validate hours
      if (businessHoursMode === 'simple') {
        const openTime = simpleHours.openTime;
        const closeTime = simpleHours.closeTime;
        
        if (openTime >= closeTime && !simpleHours.closeNextDay) {
          if (!confirm('Your closing time is earlier than opening time. Did you mean to set "Close next day"? Click OK to save as is, or Cancel to adjust.')) {
            setSavingHours(false);
            return;
          }
        }
      } else if (businessHoursMode === 'advanced') {
        // Validate each day
        for (const day of advancedHours) {
          if (day.open) {
            const openTime = day.openTime;
            const closeTime = day.closeTime;
            
            if (openTime >= closeTime && !day.openNextDay) {
              if (!confirm(`For ${day.label}, closing time is earlier than opening time. Did you mean to set "Close next day"? Click OK to save as is, or Cancel to adjust.`)) {
                setSavingHours(false);
                return;
              }
            }
          }
        }
      }

      const { error } = await (supabase as any)
        .from('bars')
        .update({
          business_hours_mode: businessHoursMode,
          business_hours_simple: businessHoursMode === 'simple' ? simpleHours : null,
          business_hours_advanced: businessHoursMode === 'advanced' ? advancedHours : null,
          business_24_hours: businessHoursMode === '24hours'
        })
        .eq('id', userBarId);

      if (error) throw error;

      alert('✅ Business hours saved successfully!');
    } catch (error) {
      console.error('Error saving business hours:', error);
      alert('Failed to save business hours. Please try again.');
    } finally {
      setSavingHours(false);
    }
  };

  const handleAdvancedDayChange = (index: number, field: keyof DayHours, value: any) => {
    const updatedHours = [...advancedHours];
    
    if (field === 'open') {
      updatedHours[index] = {
        ...updatedHours[index],
        open: value,
        // Reset to defaults if opening
        openTime: value ? updatedHours[index].openTime : '09:00',
        closeTime: value ? updatedHours[index].closeTime : '23:00',
        openNextDay: value ? updatedHours[index].openNextDay : false
      };
    } else {
      updatedHours[index] = {
        ...updatedHours[index],
        [field]: value
      };
    }
    
    setAdvancedHours(updatedHours);
  };

  const handleSaveAlertSettings = async () => {
    setSavingAlertSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      const { error } = await (supabase as any)
        .from('bars')
        .update({
          alert_timeout: alertSettings.timeout,
          alert_sound_enabled: alertSettings.soundEnabled,
          alert_custom_audio_url: alertSettings.customAudioUrl,
          alert_custom_audio_name: alertSettings.customAudioName,
          alert_volume: alertSettings.volume
        })
        .eq('id', userBarId);

      if (error) throw error;

      alert('✅ Alert settings saved successfully!');
    } catch (error) {
      console.error('Error saving alert settings:', error);
      alert('Failed to save alert settings. Please try again.');
    } finally {
      setSavingAlertSettings(false);
    }
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file (MP3, WAV, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Audio file must be less than 5MB');
      return;
    }

    setUploadingAudio(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        return;
      }

      const userBarId = user.user_metadata.bar_id;
      const fileName = `alert-audio-${userBarId}-${Date.now()}.${file.name.split('.').pop()}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('alert-audio')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('alert-audio')
        .getPublicUrl(fileName);

      // Update settings with new audio URL and name
      setAlertSettings(prev => ({ 
        ...prev, 
        customAudioUrl: publicUrl,
        customAudioName: file.name
      }));
      
      // Save to database
      const { error: updateError } = await (supabase as any)
        .from('bars')
        .update({ 
          alert_custom_audio_url: publicUrl,
          alert_custom_audio_name: file.name
        })
        .eq('id', userBarId);

      if (updateError) throw updateError;

      alert('✅ Custom alert sound uploaded successfully!');
    } catch (error) {
      console.error('Error uploading audio:', error);
      alert('Failed to upload audio file. Please try again.');
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleRemoveCustomAudio = async () => {
    if (!confirm('Are you sure you want to remove the custom alert sound?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      // Remove from database
      const { error } = await (supabase as any)
        .from('bars')
        .update({ 
          alert_custom_audio_url: '',
          alert_custom_audio_name: ''
        })
        .eq('id', userBarId);

      if (error) throw error;

      setAlertSettings(prev => ({ 
        ...prev, 
        customAudioUrl: '',
        customAudioName: ''
      }));
      alert('✅ Custom alert sound removed successfully!');
    } catch (error) {
      console.error('Error removing audio:', error);
      alert('Failed to remove custom audio. Please try again.');
    }
  };

  const handleSaveTableSettings = async () => {
    // Validate table count
    if (tableSettings.table_setup_enabled && (tableSettings.table_count < 1 || tableSettings.table_count > 100)) {
      alert('❌ Table count must be between 1 and 100');
      return;
    }

    setSavingTableSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      const { error } = await (supabase as any)
        .from('bars')
        .update({
          table_setup_enabled: tableSettings.table_setup_enabled,
          table_count: tableSettings.table_setup_enabled ? tableSettings.table_count : 0
        })
        .eq('id', userBarId);

      if (error) throw error;

      alert('✅ Table setup settings saved successfully!');
    } catch (error) {
      console.error('Error saving table settings:', error);
      alert('Failed to save table settings. Please try again.');
    } finally {
      setSavingTableSettings(false);
    }
  };

  // CORE TRUTH: Manual service always exists. 
  // Digital authority is singular. 
  // Tabeza adapts to the venue — never the reverse.

  const handleSaveVenueMode = async (config: {
    venue_mode: 'basic' | 'venue';
    authority_mode: 'pos' | 'tabeza';
    pos_integration_enabled: boolean;
    printer_required: boolean;
  }) => {
    // Validate configuration first
    const validationResult = validateChange(
      {
        venue_mode: venueMode,
        authority_mode: authorityMode,
        pos_integration_enabled: posIntegrationEnabled,
        printer_required: printerRequired,
        onboarding_completed: onboardingCompleted
      },
      config
    );

    if (!validationResult.isValid) {
      setConfigChangeWarnings(validationResult.errors);
      setPendingConfigChange(config);
      setShowConfirmationModal(true);
      return;
    }

    // Configuration is valid, proceed with save
    await performConfigurationSave(config, validationResult.correctedConfig);
  };

  const performConfigurationSave = async (
    config: {
      venue_mode: 'basic' | 'venue';
      authority_mode: 'pos' | 'tabeza';
      pos_integration_enabled: boolean;
      printer_required: boolean;
    },
    correctedConfig?: any
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      // Use corrected configuration if available, otherwise use provided config
      const configToSave = correctedConfig || {
        venue_mode: config.venue_mode,
        authority_mode: config.authority_mode,
        pos_integration_enabled: config.pos_integration_enabled,
        printer_required: config.printer_required,
        onboarding_completed: true,
        mode_last_changed_at: new Date().toISOString()
      };

      // Preserve authority_configured_at if this is not the first configuration
      const updateData: any = {
        venue_mode: configToSave.venue_mode,
        authority_mode: configToSave.authority_mode,
        pos_integration_enabled: configToSave.pos_integration_enabled,
        printer_required: configToSave.printer_required,
        onboarding_completed: true,
        mode_last_changed_at: new Date().toISOString()
      };

      // Only set authority_configured_at if this is the first time configuring
      if (!onboardingCompleted) {
        updateData.authority_configured_at = new Date().toISOString();
      }

      const { error } = await (supabase as any)
        .from('bars')
        .update(updateData)
        .eq('id', userBarId);

      if (error) throw error;

      // Update local state
      setVenueMode(configToSave.venue_mode);
      setAuthorityMode(configToSave.authority_mode);
      setPosIntegrationEnabled(configToSave.pos_integration_enabled);
      setPrinterRequired(configToSave.printer_required);
      setOnboardingCompleted(true);
      setShowVenueModeModal(false);
      setShowConfirmationModal(false);
      setPendingConfigChange(null);
      setConfigChangeWarnings([]);

      alert('✅ Venue configuration updated successfully!');
    } catch (error) {
      console.error('Error saving venue configuration:', error);
      alert('Failed to save venue configuration. Please try again.');
      throw error;
    }
  };

  const handleConfirmConfigurationChange = async () => {
    if (!pendingConfigChange) return;
    
    setSavingVenueMode(true);
    try {
      await performConfigurationSave(pendingConfigChange);
    } catch (error) {
      // Error already handled in performConfigurationSave
    } finally {
      setSavingVenueMode(false);
    }
  };

  const handleCancelConfigurationChange = () => {
    setShowConfirmationModal(false);
    setPendingConfigChange(null);
    setConfigChangeWarnings([]);
    setSavingVenueMode(false);
  };

  const handleSaveMpesaSettings = async () => {
    // Validate M-Pesa credentials
    if (mpesaSettings.mpesa_enabled) {
      // Consumer Key and Secret are always required
      if (!mpesaSettings.mpesa_consumer_key || !mpesaSettings.mpesa_consumer_secret) {
        alert('❌ Consumer Key and Consumer Secret are required when M-Pesa is enabled.');
        return;
      }

      // For production, all fields are required
      if (mpesaSettings.mpesa_environment === 'production') {
        if (!mpesaSettings.mpesa_business_shortcode || !mpesaSettings.mpesa_passkey) {
          alert('❌ Business Shortcode and Passkey are required for production environment.');
          return;
        }

        // Validate business shortcode format for production
        if (!/^\d{5,7}$/.test(mpesaSettings.mpesa_business_shortcode)) {
          alert('❌ Business shortcode must be 5-7 digits.');
          return;
        }
      }

      // For sandbox, business shortcode is optional (uses standard 174379 if empty)
      // Passkey is optional (uses standard sandbox passkey if empty)
      if (mpesaSettings.mpesa_environment === 'sandbox') {
        // If business shortcode is provided, validate format
        if (mpesaSettings.mpesa_business_shortcode && !/^\d{5,7}$/.test(mpesaSettings.mpesa_business_shortcode)) {
          alert('❌ Business shortcode must be 5-7 digits if provided.');
          return;
        }
      }
    }

    setSavingMpesaSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      console.log('🔧 Saving M-Pesa settings for bar:', userBarId);
      
      // Auto-fill sandbox credentials if empty (but don't modify the UI state)
      const settingsToSave = mpesaSettings.mpesa_environment === 'sandbox' ? {
        ...mpesaSettings,
        mpesa_business_shortcode: mpesaSettings.mpesa_business_shortcode || '174379',
        mpesa_passkey: mpesaSettings.mpesa_passkey || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'
      } : mpesaSettings;
      
      console.log('📝 Settings to save:', {
        mpesa_enabled: settingsToSave.mpesa_enabled,
        mpesa_environment: settingsToSave.mpesa_environment,
        mpesa_business_shortcode: settingsToSave.mpesa_business_shortcode,
        hasCredentials: !!(settingsToSave.mpesa_consumer_key && settingsToSave.mpesa_consumer_secret && settingsToSave.mpesa_passkey)
      });

      // Call API endpoint to save M-Pesa settings with server-side encryption
      const response = await fetch('/api/mpesa-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barId: userBarId,
          mpesa_enabled: settingsToSave.mpesa_enabled,
          mpesa_environment: settingsToSave.mpesa_environment,
          mpesa_business_shortcode: settingsToSave.mpesa_business_shortcode,
          mpesa_consumer_key: settingsToSave.mpesa_consumer_key,
          mpesa_consumer_secret: settingsToSave.mpesa_consumer_secret,
          mpesa_passkey: settingsToSave.mpesa_passkey
        })
      });

      console.log('📡 API Response status:', response.status);

      const result = await response.json();
      console.log('📡 API Response data:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save M-Pesa settings');
      }

      console.log('✅ M-Pesa settings saved successfully');

      // Keep the saved credentials in state (don't clear them after successful save)
      setMpesaSettings(prev => ({
        ...prev,
        mpesa_setup_completed: true,
        mpesa_test_status: 'pending'
      }));

      alert('✅ M-Pesa settings saved! Please test the connection.');
    } catch (error: any) {
      console.error('Error saving M-Pesa settings:', error);
      alert('❌ Failed to save M-Pesa settings: ' + (error.message || 'Please try again.'));
    } finally {
      setSavingMpesaSettings(false);
    }
  };

  const handleTestMpesa = async () => {
    // For production, business shortcode must be explicitly set
    // For sandbox, it can be empty (will use standard 174379)
    if (mpesaSettings.mpesa_environment === 'production' && !mpesaSettings.mpesa_business_shortcode) {
      alert('❌ Please save M-Pesa settings first.');
      return;
    }

    // For sandbox, we just need consumer key and secret to be saved
    if (mpesaSettings.mpesa_environment === 'sandbox' && 
        (!mpesaSettings.mpesa_consumer_key || !mpesaSettings.mpesa_consumer_secret)) {
      alert('❌ Please save your Consumer Key and Consumer Secret first.');
      return;
    }

    setTestingMpesa(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.user_metadata?.bar_id) {
        alert('Authentication error. Please log in again.');
        return;
      }

      const userBarId = user.user_metadata.bar_id;

      console.log('🧪 Testing M-Pesa credentials for bar:', userBarId);

      // Test M-Pesa credentials
      const response = await fetch('/api/payments/mpesa/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barId: userBarId
        })
      });

      const result = await response.json();
      console.log('📊 Test API response:', result);

      if (response.ok && result.success) {
        // Success - update state
        setMpesaSettings(prev => ({
          ...prev,
          mpesa_setup_completed: true,
          mpesa_test_status: 'success',
          mpesa_last_test_at: new Date().toISOString()
        }));

        alert('✅ M-Pesa credentials validated successfully! Your setup is complete.');
      } else {
        // Show detailed error
        let errorMessage = result.error || 'Test failed';
        let suggestion = result.suggestion || '';

        if (errorMessage.includes('grant_type') || errorMessage.includes('HTML')) {
          suggestion = 'This usually means invalid credentials or network issues. Please check your Consumer Key and Consumer Secret from Safaricom Developer Portal.';
        }

        throw new Error(`${errorMessage}${suggestion ? '\n\nSuggestion: ' + suggestion : ''}`);
      }
    } catch (error: any) {
      console.error('❌ Error testing M-Pesa:', error);
      
      setMpesaSettings(prev => ({
        ...prev,
        mpesa_setup_completed: false,
        mpesa_test_status: 'failed',
        mpesa_last_test_at: new Date().toISOString()
      }));

      // Show detailed error to user
      alert(`❌ M-Pesa test failed:\n\n${error.message}\n\nPlease check your credentials and try again.`);
    } finally {
      setTestingMpesa(false);
    }
  };

  const handleSendFeedback = async () => {
    // Clear previous errors
    setFeedbackError('');
    
    // Validation
    if (!feedbackForm.name.trim() || !feedbackForm.email.trim() || !feedbackForm.message.trim()) {
      setFeedbackError('Please fill in all fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(feedbackForm.email)) {
      setFeedbackError('Please enter a valid email address');
      return;
    }

    setSendingFeedback(true);
    
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: feedbackForm.name,
          email: feedbackForm.email,
          barName: barInfo.name || 'Not specified',
          message: feedbackForm.message
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send feedback');
      }

      // Success!
      setFeedbackSuccess(true);
      setFeedbackForm(prev => ({ ...prev, message: '' })); // Clear message only
      
      // Auto-close success modal after 3 seconds
      setTimeout(() => {
        setFeedbackSuccess(false);
        setShowFeedbackModal(false);
        setFeedbackError('');
      }, 3000);

    } catch (error: any) {
      console.error('Error sending feedback:', error);
      setFeedbackError(error.message || 'Failed to send feedback. Please try again.');
    } finally {
      setSendingFeedback(false);
    }
  };

  const customerOrigin = process.env.NEXT_PUBLIC_CUSTOMER_ORIGIN || 'https://app.tabeza.co.ke'; // Tabeza customer app URL

  const handleCopyQRUrl = () => {
    if (barInfo.slug) {
      // FIXED: Use /start instead of /menu for direct consent page access
      const url = `${customerOrigin}/start?bar=${barInfo.slug}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = async () => {
    try {
      if (!barInfo.id || !barInfo.slug || !barInfo.name) {
        alert('Please save your restaurant information first.');
        return;
      }

      // FIX: Use /start instead of /menu for direct consent page access
      const qrData = `${customerOrigin}/start?bar=${barInfo.slug}`;
      
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${barInfo.name} - QR Code</title>
          <style>
            @page {
              size: A4;
              margin: 2cm;
            }
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .qr-container {
              background: white;
              border: 3px solid #f97316;
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 600px;
            }
            h1 {
              color: #f97316;
              font-size: 32px;
              margin: 0 0 10px 0;
            }
            .subtitle {
              color: #666;
              font-size: 18px;
              margin-bottom: 30px;
            }
            .qr-code {
              background: white;
              padding: 20px;
              border-radius: 10px;
              display: inline-block;
              margin-bottom: 30px;
            }
            .qr-code img {
              display: block;
              width: 400px;
              height: 400px;
            }
            .instructions {
              background: #fff7ed;
              border: 2px solid #fed7aa;
              border-radius: 10px;
              padding: 20px;
              margin-top: 20px;
              text-align: left;
            }
            .instructions h2 {
              color: #f97316;
              font-size: 20px;
              margin: 0 0 15px 0;
            }
            .instructions ol {
              margin: 0;
              padding-left: 20px;
            }
            .instructions li {
              margin-bottom: 10px;
              font-size: 16px;
              color: #333;
            }
            .url-box {
              background: #f3f4f6;
              border: 2px solid #d1d5db;
              border-radius: 10px;
              padding: 15px;
              margin-top: 20px;
            }
            .url-box p {
              margin: 0 0 5px 0;
              font-size: 14px;
              color: #666;
              font-weight: bold;
            }
            .url-box code {
              font-size: 16px;
              color: #f97316;
              word-break: break-all;
            }
            .footer {
              margin-top: 30px;
              color: #999;
              font-size: 14px;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h1>${barInfo.name}</h1>
            <p class="subtitle">Scan to View Menu & Order</p>
            
            <div class="qr-code">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=f97316&qzone=2&format=png" alt="QR Code" />
            </div>

            <div class="instructions">
              <h2>📱 How to Connect:</h2>
              <ol>
                <li>Scan QR code with phone camera</li>
                <li>No scanner? Type URL: <code>${customerOrigin.replace(/^https?:\/\//, '')}</code></li>
                <li>Insert <code>${barInfo.slug}</code> in the search bar</li>
                <li>Install our app for easier access</li>
              </ol>
            </div>
          </div>
        </body>
      </html>
      `;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  const qrUrl = barInfo.slug ? `${customerOrigin}/start?bar=${barInfo.slug}` : '';

  // Create venue configuration for theme provider
  const currentVenueConfig: VenueConfiguration = {
    venue_mode: venueMode,
    authority_mode: authorityMode,
    pos_integration_enabled: posIntegrationEnabled,
    printer_required: printerRequired,
    onboarding_completed: onboardingCompleted,
    authority_configured_at: new Date().toISOString(),
    mode_last_changed_at: new Date().toISOString()
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {!isNewUser && (
            <button 
              onClick={() => router.push('/')}
              className="mb-4 p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 inline-block"
            >
              <ArrowRight size={24} className="transform rotate-180" />
            </button>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">{isNewUser ? 'Complete Setup' : 'Restaurant Settings'}</h1>
              <p className="text-orange-100 text-sm mt-1">
                {isNewUser ? 'Set up your restaurant to get started' : 'Manage your restaurant configuration and preferences'}
              </p>
            </div>
            {!isNewUser && (
              <div className="mt-4 sm:mt-0 flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-orange-100">System Active</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Welcome Banner for New Users */}
      {isNewUser && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 flex items-start gap-4">
            <AlertCircle size={28} className="text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-blue-900 mb-2">Welcome to Tabeza!</h2>
              <p className="text-blue-800 mb-3">
                Complete your restaurant information below to generate your QR code and start accepting digital orders.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">Step 1: Restaurant Info</span>
                <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded">Step 2: QR Code</span>
                <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded">Step 3: Configure</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Settings Navigation */}
        {!isNewUser && (
          <div className="mb-8">
            <nav className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
              <button 
                onClick={() => {
                  console.log('Switching to general tab');
                  setActiveTab('general');
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${
                  activeTab === 'general' 
                    ? 'text-orange-600 bg-orange-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Store size={16} />
                General
              </button>
              <button 
                onClick={() => {
                  console.log('Switching to venue tab');
                  setActiveTab('venue');
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${
                  activeTab === 'venue' 
                    ? 'text-orange-600 bg-orange-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings size={16} />
                Configuration
              </button>
              <button 
                onClick={() => {
                  console.log('Switching to payments tab');
                  setActiveTab('payments');
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${
                  activeTab === 'payments' 
                    ? 'text-orange-600 bg-orange-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CreditCard size={16} />
                Payments
              </button>
              <button 
                onClick={() => {
                  console.log('Switching to notifications tab');
                  setActiveTab('notifications');
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${
                  activeTab === 'notifications' 
                    ? 'text-orange-600 bg-orange-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Bell size={16} />
                Notifications
              </button>
              <button 
                onClick={() => {
                  console.log('Switching to operations tab');
                  setActiveTab('operations');
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${
                  activeTab === 'operations' 
                    ? 'text-orange-600 bg-orange-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Clock size={16} />
                Operations
              </button>
            </nav>
          </div>
        )}

        {/* Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Debug Info - Remove after fixing */}
          {!isNewUser && (
            <div className="col-span-full bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Debug:</strong> Active Tab = "{activeTab}" | isNewUser = {isNewUser.toString()}
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                M-Pesa State: enabled={mpesaSettings.mpesa_enabled.toString()}, env={mpesaSettings.mpesa_environment}, setup={mpesaSettings.mpesa_setup_completed.toString()}
              </p>
            </div>
          )}

          {/* General Tab Content */}
          {(isNewUser || activeTab === 'general') && (
            <>
              {/* Restaurant Information Section */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Store size={20} className="text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">Restaurant Information</h3>
                      <p className="text-sm text-gray-500">
                        {editMode ? 'Fill in your details' : 'Current registered details'}
                      </p>
                    </div>
                  </div>
                  {!editMode && !isNewUser && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
                    >
                      <Edit2 size={18} />
                      Edit
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Restaurant Name {editMode && <span className="text-red-500">*</span>}
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editedInfo.name}
                        onChange={(e) => setEditedInfo({...editedInfo, name: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-800 font-medium">{barInfo.name || '(Not set)'}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location/Area</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editedInfo.location}
                        onChange={(e) => setEditedInfo({...editedInfo, location: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-800">{barInfo.location || '(Not set)'}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editedInfo.city}
                        onChange={(e) => setEditedInfo({...editedInfo, city: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-800">{barInfo.city || '(Not set)'}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    {editMode ? (
                      <input
                        type="tel"
                        value={editedInfo.phone}
                        onChange={(e) => setEditedInfo({...editedInfo, phone: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-800">{barInfo.phone || '(Not set)'}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    {editMode ? (
                      <input
                        type="email"
                        value={editedInfo.email}
                        onChange={(e) => setEditedInfo({...editedInfo, email: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-800">{barInfo.email || '(Not set)'}</p>
                      </div>
                    )}
                  </div>

                  {!editMode && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bar Slug (URL)</label>
                        <div className="px-4 py-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                          <code className="text-sm text-gray-600 break-all">{barInfo.slug || '(No slug)'}</code>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Used in QR code: {customerOrigin}/menu?bar={barInfo.slug}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bar ID</label>
                        <div className="px-4 py-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                          <code className="text-xs text-gray-600 break-all font-mono">{barInfo.id}</code>
                        </div>
                      </div>
                    </>
                  )}

                  {editMode && (
                    <div className="flex gap-2 pt-3">
                      <button
                        onClick={handleSaveBarInfo}
                        disabled={saving}
                        className="flex-1 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                      >
                        <Save size={20} />
                        {saving ? 'Saving...' : isNewUser ? 'Complete Setup' : 'Save Changes'}
                      </button>
                      {!isNewUser && (
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* QR Code Section */}
              {!isNewUser && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <QrCode size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">Customer QR Code</h3>
                      <p className="text-sm text-gray-500">For {barInfo.name}</p>
                    </div>
                  </div>

                  {barInfo.slug ? (
                    <>
                      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 mb-4">
                        <div className="bg-white rounded-xl p-6 shadow-lg mx-auto max-w-xs">
                          <div className="aspect-square bg-white rounded-lg overflow-hidden border-4 border-gray-100">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=f97316&qzone=2&format=svg`}
                              alt={`${barInfo.name} QR Code`}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="text-center mt-4">
                            <p className="font-bold text-gray-800">{barInfo.name}</p>
                            <p className="text-sm text-gray-500">Scan to order</p>
                            <p className="text-xs text-orange-600 mt-1 font-mono">{barInfo.slug}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-500">Customer URL:</p>
                          <button
                            onClick={handleCopyQRUrl}
                            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                          >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <code className="text-sm text-gray-800 break-all">{qrUrl}</code>
                      </div>

                      <button
                        onClick={handleDownloadQR}
                        className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 flex items-center justify-center gap-2"
                      >
                        <Download size={20} />
                        Print QR Code (with Instructions)
                      </button>
                      <p className="text-xs text-center text-gray-500 mt-2">
                        Includes URL for customers without QR scanners
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle size={48} className="mx-auto mb-3 text-orange-500" />
                      <p className="text-gray-700 font-medium mb-2">Setup Required</p>
                      <p className="text-sm text-gray-500">
                        Complete restaurant information above to generate your QR code
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Feedback Section */}
              {!isNewUser && (
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <MessageSquare size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">Feedback & Support</h3>
                      <p className="text-sm text-gray-500">Share your experience or report issues</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={20} />
                    Send Feedback
                  </button>
                </div>
              )}
            </>
          )}

          {/* Venue Configuration Tab Content */}
          {!isNewUser && activeTab === 'venue' && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Venue Configuration</h2>
                <p className="text-gray-600 mb-6">
                  Your current venue mode and operational settings. Changes to these settings may affect how your venue operates.
                </p>
                
                <div className="bg-gray-100 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Current Configuration</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>Venue Mode:</strong> {venueMode}</p>
                    <p><strong>Authority Mode:</strong> {authorityMode}</p>
                    <p><strong>POS Integration:</strong> {posIntegrationEnabled ? 'Enabled' : 'Disabled'}</p>
                    <p><strong>Printer Required:</strong> {printerRequired ? 'Yes' : 'No'}</p>
                    <p><strong>Onboarding Completed:</strong> {onboardingCompleted ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                {/* Printer Setup Section - Show if printer is required */}
                {printerRequired && (
                  <div className="mb-6">
                    <PrinterStatusIndicator 
                      barId={barInfo.id}
                      autoRefresh={true}
                      refreshInterval={15000}
                      showDetails={true}
                      compact={false}
                    />
                    
                    {/* Configuration Instructions - Show different content based on status */}
                    {printerServiceStatus === 'offline' ? (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mt-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-amber-900 mb-2">
                              Printer Service Not Running
                            </h4>
                            <p className="text-xs text-amber-800 mb-3">
                              The Tabeza Printer Service needs to be <strong>running</strong> on this computer. 
                              Installing it is not enough - you must start it.
                            </p>
                            
                            <div className="bg-white rounded-lg p-3 mb-3 border border-amber-200">
                              <p className="text-xs font-semibold text-gray-800 mb-2">📋 How to Start the Service:</p>
                              <ol className="text-xs text-gray-700 space-y-1.5 ml-4 list-decimal">
                                <li>Open your <strong>Downloads</strong> folder</li>
                                <li>Find <code className="bg-gray-100 px-1 rounded">tabeza-printer-service.exe</code></li>
                                <li>Double-click it to run</li>
                                <li>A terminal window will open - <strong>keep it open!</strong></li>
                                <li>You should see "✅ Tabeza Printer Service - Running"</li>
                                <li>Come back here and click "Auto-Configure" below</li>
                              </ol>
                            </div>

                            <div className="flex gap-2">
                              <a
                                href="https://github.com/billoapp/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe"
                                download
                                className="flex-1 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-xs font-medium text-center flex items-center justify-center gap-2"
                              >
                                <Download size={14} />
                                Download Service (if not installed)
                              </a>
                              <button
                                onClick={checkPrinterServiceStatus}
                                className="px-3 py-2 bg-white border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-50 transition text-xs font-medium flex items-center gap-2"
                              >
                                <RefreshCw size={14} />
                                Check Again
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : printerServiceStatus === 'online' ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                        <div className="flex items-start gap-2 mb-3">
                          <CheckCircle size={16} className="text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-blue-800 block mb-2">
                              ✅ Service Running - Ready to Configure
                            </span>
                            <p className="text-xs text-blue-700 mb-3">
                              The printer service is running! Click the button below to connect it to your venue:
                            </p>
                            
                            <button
                              onClick={handleAutoConfigurePrinter}
                              disabled={configuringPrinter || !barInfo.id}
                              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
                            >
                              {configuringPrinter ? (
                                <>
                                  <RefreshCw size={16} className="animate-spin" />
                                  Configuring...
                                </>
                              ) : (
                                <>
                                  <Settings size={16} />
                                  Auto-Configure Printer Service
                                </>
                              )}
                            </button>
                            
                            <div className="border-t border-blue-200 pt-3 mt-3">
                              <p className="text-xs text-blue-700 mb-2">
                                Or manually copy your Bar ID:
                              </p>
                              <div className="bg-white rounded p-2 mb-2">
                                <code className="text-xs text-gray-800 break-all">
                                  {barInfo.id || 'Loading...'}
                                </code>
                              </div>
                              <button
                                onClick={() => {
                                  if (barInfo.id) {
                                    navigator.clipboard.writeText(barInfo.id);
                                    alert('✅ Bar ID copied to clipboard!');
                                  }
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                <Copy size={12} />
                                Copy Bar ID
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                        <div className="flex items-center gap-2">
                          <RefreshCw size={16} className="text-gray-600 animate-spin" />
                          <span className="text-sm text-gray-600">Checking printer service status...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white border border-gray-200 p-6 rounded-lg mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Change Configuration</h3>
                      <p className="text-gray-600 text-sm">
                        Modify your venue mode and authority settings. Note: Changing from Basic to Venue mode will affect printer requirements.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowVenueModeModal(true)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                    >
                      Change Settings
                    </button>
                  </div>
                </div>

                {/* Configuration History */}
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Configuration History</h3>
                  <ConfigurationHistory barId={barInfo.id} />
                </div>
              </div>
            </>
          )}

          {/* Payments Tab Content */}
          {!isNewUser && activeTab === 'payments' && (
            <>
              {/* Debug indicator */}
              <div className="col-span-full bg-purple-50 border border-purple-200 rounded-lg p-2 mb-4">
                <p className="text-xs text-purple-800">DEBUG: Payments tab is rendering</p>
              </div>

              {/* Payment Settings Section */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <CreditCard size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Payment Methods</h3>
                    <p className="text-sm text-gray-500">Choose which payment methods to accept</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* M-Pesa Section */}
                  <div className={`border-2 rounded-lg p-4 ${
                    mpesaSettings.mpesa_enabled 
                      ? mpesaSettings.mpesa_environment === 'production'
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Phone size={20} className={
                          mpesaSettings.mpesa_enabled 
                            ? mpesaSettings.mpesa_environment === 'production'
                              ? 'text-green-600' 
                              : 'text-blue-600'
                            : 'text-gray-400'
                        } />
                        <div>
                          <span className="text-sm font-medium text-gray-700">M-Pesa Mobile Payments</span>
                          <p className="text-xs text-gray-500">Accept payments via M-Pesa</p>
                          {mpesaSettings.mpesa_enabled && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className={`w-2 h-2 rounded-full ${
                                mpesaSettings.mpesa_environment === 'production' 
                                  ? 'bg-green-500' 
                                  : 'bg-blue-500'
                              }`}></div>
                              <span className={`text-xs font-medium ${
                                mpesaSettings.mpesa_environment === 'production' 
                                  ? 'text-green-600' 
                                  : 'text-blue-600'
                              }`}>
                                {mpesaSettings.mpesa_environment === 'production' 
                                  ? '🟢 Live Payments Active' 
                                  : '🔵 Testing Mode Active'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {mpesaSettings.mpesa_enabled && mpesaSettings.mpesa_setup_completed && (
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            mpesaSettings.mpesa_test_status === 'success' 
                              ? mpesaSettings.mpesa_environment === 'production'
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-blue-100 text-blue-700'
                              : mpesaSettings.mpesa_test_status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {mpesaSettings.mpesa_test_status === 'success' && 
                              (mpesaSettings.mpesa_environment === 'production' ? '✅ Production Ready' : '🧪 Sandbox Verified')}
                            {mpesaSettings.mpesa_test_status === 'failed' && '❌ Connection Failed'}
                            {mpesaSettings.mpesa_test_status === 'pending' && '⏳ Test Required'}
                          </div>
                        )}
                        <input
                          type="checkbox"
                          checked={mpesaSettings.mpesa_enabled}
                          onChange={(e) => setMpesaSettings({
                            ...mpesaSettings, 
                            mpesa_enabled: e.target.checked
                          })}
                          className={`w-5 h-5 rounded focus:ring-2 ${
                            mpesaSettings.mpesa_environment === 'production'
                              ? 'text-green-500 focus:ring-green-500'
                              : 'text-blue-500 focus:ring-blue-500'
                          }`}
                        />
                      </div>
                    </div>
                    
                    {mpesaSettings.mpesa_enabled && (
                      <div className="space-y-3">
                        {/* Environment Status Card */}
                        <div className={`p-3 rounded-lg border ${
                          mpesaSettings.mpesa_environment === 'production'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${
                              mpesaSettings.mpesa_environment === 'production' 
                                ? 'text-green-800' 
                                : 'text-blue-800'
                            }`}>
                              {mpesaSettings.mpesa_environment === 'production' 
                                ? '💰 Production Environment' 
                                : '🧪 Sandbox Environment'}
                            </span>
                            {mpesaSettings.mpesa_environment === 'sandbox' && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                                Test Mode
                              </span>
                            )}
                          </div>
                          <p className={`text-xs ${
                            mpesaSettings.mpesa_environment === 'production' 
                              ? 'text-green-700' 
                              : 'text-blue-700'
                          }`}>
                            {mpesaSettings.mpesa_environment === 'production' 
                              ? 'Real money transactions - customers will be charged' 
                              : 'Test transactions only - no real money involved'}
                          </p>
                          {mpesaSettings.mpesa_business_shortcode && (
                            <div className="mt-2 text-xs">
                              <strong>Business Shortcode:</strong> {mpesaSettings.mpesa_business_shortcode}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowMpesaSetup(true)}
                            className={`flex-1 text-white py-2 px-4 rounded-lg text-sm font-medium transition ${
                              mpesaSettings.mpesa_environment === 'production'
                                ? 'bg-green-500 hover:bg-green-600'
                                : 'bg-blue-500 hover:bg-blue-600'
                            }`}
                          >
                            {mpesaSettings.mpesa_environment === 'production' 
                              ? '⚙️ Configure Production' 
                              : '🔧 Configure Sandbox'}
                          </button>
                          
                          {mpesaSettings.mpesa_environment === 'sandbox' && mpesaSettings.mpesa_setup_completed && (
                            <button
                              onClick={() => {
                                if (confirm('Ready to switch to production? This will enable real money transactions.')) {
                                  setMpesaSettings({
                                    ...mpesaSettings,
                                    mpesa_environment: 'production',
                                    mpesa_setup_completed: false,
                                    mpesa_test_status: 'pending',
                                    mpesa_business_shortcode: '',
                                    mpesa_consumer_key: '',
                                    mpesa_consumer_secret: '',
                                    mpesa_passkey: ''
                                  });
                                  setShowMpesaSetup(true);
                                }
                              }}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition"
                            >
                              🚀 Go Live
                            </button>
                          )}
                        </div>

                        {/* Warning for Production */}
                        {mpesaSettings.mpesa_environment === 'production' && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-orange-800">
                                <p className="font-medium">Production Environment Active</p>
                                <p className="text-xs mt-1">
                                  Customers will be charged real money. Ensure your credentials are correct before going live.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Sandbox Info */}
                        {mpesaSettings.mpesa_environment === 'sandbox' && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-blue-800">
                                <p className="font-medium">Sandbox Testing Mode</p>
                                <p className="text-xs mt-1">
                                  Use test phone numbers (254708374149, 254711040400) for testing. No real money is processed.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!mpesaSettings.mpesa_enabled && (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-600 mb-2">Enable M-Pesa to accept mobile payments</p>
                        <p className="text-xs text-gray-500">
                          Start with sandbox testing, then switch to production when ready
                        </p>
                      </div>
                    )}
                  </div>

                  <label className="flex items-center justify-between p-3 bg-gray-100 rounded-lg opacity-60 cursor-not-allowed">
                    <div className="flex items-center gap-3">
                      <CreditCard size={20} className="text-gray-400" />
                      <div>
                        <span className="text-sm font-medium text-gray-500">Card Payments</span>
                        <p className="text-xs text-gray-400">Credit/Debit cards (Coming Soon)</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={true}
                      className="w-5 h-5 text-gray-300 rounded focus:ring-gray-300 cursor-not-allowed"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                      <DollarSign size={20} className="text-orange-600" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Cash Payment</span>
                        <p className="text-xs text-gray-500">Pay at counter</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={paymentSettings.payment_cash_enabled}
                      onChange={(e) => setPaymentSettings({
                        ...paymentSettings, 
                        payment_cash_enabled: e.target.checked
                      })}
                      className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                    />
                  </label>
                </div>

                <button
                  onClick={handleSavePaymentSettings}
                  disabled={savingPaymentSettings}
                  className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {savingPaymentSettings ? 'Saving...' : 'Save Payment Settings'}
                </button>
              </div>

              {/* M-Pesa Setup Modal */}
              {showMpesaSetup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <Phone size={24} className={
                            mpesaSettings.mpesa_environment === 'production' 
                              ? 'text-green-600' 
                              : 'text-blue-600'
                          } />
                          <div>
                            <h3 className="text-xl font-bold text-gray-800">
                              {mpesaSettings.mpesa_environment === 'production' 
                                ? '💰 M-Pesa Production Setup' 
                                : '🧪 M-Pesa Sandbox Setup'}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {mpesaSettings.mpesa_environment === 'production' 
                                ? 'Configure live payment processing' 
                                : 'Configure test payment processing'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowMpesaSetup(false)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                          <X size={20} className="text-gray-500" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Environment Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Environment <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => setMpesaSettings({...mpesaSettings, mpesa_environment: 'sandbox'})}
                              className={`p-3 rounded-lg border-2 text-left transition ${
                                mpesaSettings.mpesa_environment === 'sandbox'
                                  ? 'border-orange-500 bg-orange-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="font-medium text-gray-800">Sandbox</div>
                              <div className="text-xs text-gray-500">For testing</div>
                            </button>
                            <button
                              onClick={() => setMpesaSettings({...mpesaSettings, mpesa_environment: 'production'})}
                              className={`p-3 rounded-lg border-2 text-left transition ${
                                mpesaSettings.mpesa_environment === 'production'
                                  ? 'border-orange-500 bg-orange-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="font-medium text-gray-800">Production</div>
                              <div className="text-xs text-gray-500">Live payments</div>
                            </button>
                          </div>
                        </div>

                        {/* Business Shortcode */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Business Shortcode {mpesaSettings.mpesa_environment === 'production' && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type="text"
                            value={mpesaSettings.mpesa_business_shortcode}
                            onChange={(e) => setMpesaSettings({...mpesaSettings, mpesa_business_shortcode: e.target.value})}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                            placeholder={mpesaSettings.mpesa_environment === 'sandbox' ? '174379 (default sandbox)' : 'Your business shortcode'}
                          />
                          {mpesaSettings.mpesa_environment === 'sandbox' && (
                            <p className="text-xs text-gray-500 mt-1">
                              Leave empty to use default sandbox shortcode (174379)
                            </p>
                          )}
                        </div>

                        {/* Consumer Key */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Consumer Key <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={mpesaSettings.mpesa_consumer_key}
                            onChange={(e) => setMpesaSettings({...mpesaSettings, mpesa_consumer_key: e.target.value})}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                            placeholder="Your consumer key from Safaricom Developer Portal"
                          />
                        </div>

                        {/* Consumer Secret */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Consumer Secret <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            value={mpesaSettings.mpesa_consumer_secret}
                            onChange={(e) => setMpesaSettings({...mpesaSettings, mpesa_consumer_secret: e.target.value})}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                            placeholder="Your consumer secret from Safaricom Developer Portal"
                          />
                        </div>

                        {/* Passkey */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Passkey {mpesaSettings.mpesa_environment === 'production' && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type="password"
                            value={mpesaSettings.mpesa_passkey}
                            onChange={(e) => setMpesaSettings({...mpesaSettings, mpesa_passkey: e.target.value})}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                            placeholder={mpesaSettings.mpesa_environment === 'sandbox' ? 'Leave empty for default sandbox passkey' : 'Your production passkey'}
                          />
                          {mpesaSettings.mpesa_environment === 'sandbox' && (
                            <p className="text-xs text-gray-500 mt-1">
                              Leave empty to use default sandbox passkey
                            </p>
                          )}
                        </div>

                        {/* Test Status */}
                        {mpesaSettings.mpesa_setup_completed && (
                          <div className={`p-3 rounded-lg border ${
                            mpesaSettings.mpesa_test_status === 'success' 
                              ? 'bg-green-50 border-green-200' 
                              : mpesaSettings.mpesa_test_status === 'failed'
                              ? 'bg-red-50 border-red-200'
                              : 'bg-yellow-50 border-yellow-200'
                          }`}>
                            <div className="flex items-center gap-2">
                              {mpesaSettings.mpesa_test_status === 'success' && <Check size={16} className="text-green-600" />}
                              {mpesaSettings.mpesa_test_status === 'failed' && <X size={16} className="text-red-600" />}
                              {mpesaSettings.mpesa_test_status === 'pending' && <Clock size={16} className="text-yellow-600" />}
                              <span className={`text-sm font-medium ${
                                mpesaSettings.mpesa_test_status === 'success' ? 'text-green-800' :
                                mpesaSettings.mpesa_test_status === 'failed' ? 'text-red-800' : 'text-yellow-800'
                              }`}>
                                {mpesaSettings.mpesa_test_status === 'success' && 'Connection Verified ✓'}
                                {mpesaSettings.mpesa_test_status === 'failed' && 'Connection Failed ✗'}
                                {mpesaSettings.mpesa_test_status === 'pending' && 'Test Required'}
                              </span>
                            </div>
                            {mpesaSettings.mpesa_last_test_at && (
                              <p className="text-xs text-gray-500 mt-1">
                                Last tested: {new Date(mpesaSettings.mpesa_last_test_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                          <button
                            onClick={handleSaveMpesaSettings}
                            disabled={savingMpesaSettings}
                            className="flex-1 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                          >
                            <Save size={20} />
                            {savingMpesaSettings ? 'Saving...' : 'Save Settings'}
                          </button>
                          
                          <button
                            onClick={handleTestMpesa}
                            disabled={testingMpesa || !mpesaSettings.mpesa_consumer_key || !mpesaSettings.mpesa_consumer_secret}
                            className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                          >
                            {testingMpesa ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Testing...
                              </>
                            ) : (
                              <>
                                <Send size={20} />
                                Test Connection
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Notifications Tab Content */}
          {!isNewUser && activeTab === 'notifications' && (
            <>
              {/* Debug indicator */}
              <div className="col-span-full bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4">
                <p className="text-xs text-blue-800">DEBUG: Notifications tab is rendering</p>
              </div>

              {/* Notifications Section */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Bell size={20} className="text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Notifications</h3>
                    <p className="text-sm text-gray-500">Choose what notifications to receive</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                      <Bell size={18} className="text-blue-600" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">New Orders</span>
                        <p className="text-xs text-gray-500">Get notified when customers place orders</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.newOrders}
                      onChange={(e) => setNotifications({
                        ...notifications, 
                        newOrders: e.target.checked
                      })}
                      className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={18} className="text-yellow-600" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Pending Approvals</span>
                        <p className="text-xs text-gray-500">Notify about pending order approvals</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.pendingApprovals}
                      onChange={(e) => setNotifications({
                        ...notifications, 
                        pendingApprovals: e.target.checked
                      })}
                      className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                      <CreditCard size={18} className="text-green-600" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Payment Updates</span>
                        <p className="text-xs text-gray-500">Notify about payment status changes</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.payments}
                      onChange={(e) => setNotifications({
                        ...notifications, 
                        payments: e.target.checked
                      })}
                      className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                    />
                  </label>
                </div>

                <button
                  onClick={handleSaveNotificationSettings}
                  className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  Save Notification Settings
                </button>
              </div>

              {/* Alert Settings Section */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <BellRing size={20} className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Alert Settings</h3>
                    <p className="text-sm text-gray-500">Configure order and message alerts</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Alert Timeout */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alert Duration (seconds)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="3"
                        max="15"
                        value={alertSettings.timeout}
                        onChange={(e) => setAlertSettings({...alertSettings, timeout: parseInt(e.target.value)})}
                        className="flex-1"
                      />
                      <div className="w-16 text-center">
                        <span className="text-lg font-bold text-orange-600">{alertSettings.timeout}s</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>3s (Quick)</span>
                      <span>15s (Long)</span>
                    </div>
                  </div>

                  {/* Sound Settings */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alert Sound
                    </label>
                    
                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition mb-3">
                      <div className="flex items-center gap-3">
                        <Bell size={18} className="text-blue-600" />
                        <div>
                          <span className="text-sm font-medium text-gray-700">Enable Sound</span>
                          <p className="text-xs text-gray-500">Play sound when alerts appear</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={alertSettings.soundEnabled}
                        onChange={(e) => setAlertSettings({...alertSettings, soundEnabled: e.target.checked})}
                        className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                      />
                    </label>

                    {alertSettings.soundEnabled && (
                      <div className="space-y-3">
                        {/* Volume Control */}
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-sm font-medium text-gray-700 mb-3">Alert Volume</p>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={alertSettings.volume}
                              onChange={(e) => setAlertSettings({...alertSettings, volume: parseFloat(e.target.value)})}
                              className="flex-1"
                            />
                            <div className="w-12 text-center">
                              <span className="text-sm font-bold text-blue-600">{Math.round(alertSettings.volume * 100)}%</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>🔇 Silent</span>
                            <span>🔊 Max</span>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-800 font-medium mb-2">Custom Alert Sound</p>
                          
                          {alertSettings.customAudioUrl ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <audio controls className="flex-1 h-8">
                                  <source src={alertSettings.customAudioUrl} type="audio/mpeg" />
                                  <source src={alertSettings.customAudioUrl} type="audio/wav" />
                                  Your browser does not support audio playback.
                                </audio>
                                <button
                                  onClick={handleRemoveCustomAudio}
                                  className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition"
                                >
                                  Remove
                                </button>
                              </div>
                              <p className="text-xs text-gray-600">
                                {alertSettings.customAudioName || 'Custom alert sound is active'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="file"
                                  accept="audio/*"
                                  onChange={handleAudioUpload}
                                  disabled={uploadingAudio}
                                  className="hidden"
                                  id="audio-upload"
                                />
                                <label
                                  htmlFor="audio-upload"
                                  className="flex-1 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition cursor-pointer text-center disabled:bg-gray-300"
                                >
                                  {uploadingAudio ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                                      Uploading...
                                    </>
                                  ) : (
                                    '📤 Upload Custom Sound'
                                  )}
                                </label>
                              </label>
                              <p className="text-xs text-gray-600">MP3, WAV files (max 5MB)</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSaveAlertSettings}
                  disabled={savingAlertSettings}
                  className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {savingAlertSettings ? 'Saving...' : 'Save Alert Settings'}
                </button>
              </div>
            </>
          )}

          {/* Operations Tab Content */}
          {!isNewUser && activeTab === 'operations' && (
            <>
              {/* Debug indicator */}
              <div className="col-span-full bg-green-50 border border-green-200 rounded-lg p-2 mb-4">
                <p className="text-xs text-green-800">DEBUG: Operations tab is rendering</p>
              </div>

              {/* Venue Mode Configuration Section */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${
                    venueMode === 'basic' 
                      ? 'bg-blue-100' 
                      : venueMode === 'venue' && authorityMode === 'pos'
                        ? 'bg-yellow-100'
                        : 'bg-green-100'
                  }`}>
                    <Store size={20} className={
                      venueMode === 'basic' 
                        ? 'text-blue-600' 
                        : venueMode === 'venue' && authorityMode === 'pos'
                          ? 'text-yellow-600'
                          : 'text-green-600'
                    } />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Venue Configuration</h3>
                    <p className="text-sm text-gray-500">Configure how Tabeza operates at your venue</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Current Configuration Display with Enhanced Theming */}
                  <div className={`border-2 rounded-lg p-4 ${
                    venueMode === 'basic' 
                      ? 'bg-blue-50 border-blue-200' 
                      : venueMode === 'venue' && authorityMode === 'pos'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          venueMode === 'basic' 
                            ? 'bg-blue-100' 
                            : venueMode === 'venue' && authorityMode === 'pos'
                              ? 'bg-yellow-100'
                              : 'bg-green-100'
                        }`}>
                          {venueMode === 'basic' ? (
                            <Printer size={24} className="text-blue-600" />
                          ) : venueMode === 'venue' && authorityMode === 'pos' ? (
                            <div className="flex items-center gap-1">
                              <Menu size={12} className="text-yellow-600" />
                              <Printer size={12} className="text-yellow-600" />
                            </div>
                          ) : (
                            <Menu size={24} className="text-green-600" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 text-lg">
                            {venueMode === 'basic' ? 'Tabeza Basic' : 'Tabeza Venue'}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {venueMode === 'basic' 
                              ? 'Transaction & Receipt Bridge' 
                              : authorityMode === 'pos'
                                ? 'Customer Interaction + POS Integration'
                                : 'Full Service Platform'
                            }
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${
                              venueMode === 'basic' 
                                ? 'bg-blue-500' 
                                : venueMode === 'venue' && authorityMode === 'pos'
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                            }`}></div>
                            <span className="text-xs text-gray-500">
                              {venueMode === 'basic' 
                                ? 'POS-Authoritative Mode' 
                                : authorityMode === 'pos'
                                  ? 'Hybrid POS Integration'
                                  : 'Tabeza-Authoritative Mode'
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowVenueModeModal(true)}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-sm font-medium flex items-center gap-2"
                      >
                        <Edit2 size={16} />
                        Change Configuration
                      </button>
                    </div>

                    {/* Enhanced Configuration Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-gray-600">Venue Mode:</span>
                        <span className={`font-medium px-2 py-1 rounded text-xs ${
                          venueMode === 'basic' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {venueMode === 'basic' ? 'Basic' : 'Venue'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-gray-600">Order Authority:</span>
                        <span className={`font-medium px-2 py-1 rounded text-xs ${
                          authorityMode === 'pos' 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {authorityMode === 'pos' ? 'POS System' : 'Tabeza'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-gray-600">POS Integration:</span>
                        <span className={`font-medium px-2 py-1 rounded text-xs ${
                          posIntegrationEnabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {posIntegrationEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-gray-600">Printer Required:</span>
                        <span className={`font-medium px-2 py-1 rounded text-xs ${
                          printerRequired 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {printerRequired ? 'Required' : 'Optional'}
                        </span>
                      </div>
                    </div>

                    {/* Enhanced Feature Status */}
                    <div className="mb-4">
                      <h5 className="font-medium text-gray-800 mb-2">Feature Status</h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          {venueMode === 'venue' ? (
                            <Check size={14} className="text-green-600" />
                          ) : (
                            <X size={14} className="text-red-500" />
                          )}
                          <span className={venueMode === 'venue' ? 'text-green-700' : 'text-red-600'}>
                            Customer Menus
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {venueMode === 'venue' && authorityMode === 'tabeza' ? (
                            <Check size={14} className="text-green-600" />
                          ) : venueMode === 'venue' && authorityMode === 'pos' ? (
                            <AlertCircle size={14} className="text-yellow-600" />
                          ) : (
                            <X size={14} className="text-red-500" />
                          )}
                          <span className={
                            venueMode === 'venue' && authorityMode === 'tabeza' 
                              ? 'text-green-700' 
                              : venueMode === 'venue' && authorityMode === 'pos'
                                ? 'text-yellow-700'
                                : 'text-red-600'
                          }>
                            Customer Ordering
                            {venueMode === 'venue' && authorityMode === 'pos' && (
                              <span className="ml-1 text-xs">(Requests)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {venueMode === 'venue' && authorityMode === 'tabeza' ? (
                            <Check size={14} className="text-green-600" />
                          ) : (
                            <X size={14} className="text-red-500" />
                          )}
                          <span className={
                            venueMode === 'venue' && authorityMode === 'tabeza' 
                              ? 'text-green-700' 
                              : 'text-red-600'
                          }>
                            Staff Ordering
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {printerRequired ? (
                            <AlertCircle size={14} className="text-orange-600" />
                          ) : (
                            <Check size={14} className="text-green-600" />
                          )}
                          <span className={printerRequired ? 'text-orange-700' : 'text-green-700'}>
                            Printer Setup
                            {printerRequired && (
                              <span className="ml-1 text-xs">(Required)</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Workflow Description */}
                    <div className="p-3 bg-white rounded-lg border">
                      <div className="flex items-start gap-2">
                        <ArrowRight size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-800 mb-1">Current Workflow:</p>
                          <p className="text-sm text-gray-700">
                            {venueMode === 'basic' 
                              ? 'POS creates orders → Tabeza mirrors receipts → Digital delivery to customers'
                              : authorityMode === 'pos'
                                ? 'Customers browse menus → Send requests → Staff confirms in POS → Tabeza delivers receipts'
                                : 'Customers browse menus → Place orders → Staff confirms in Tabeza → Digital receipts generated'
                            }
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            <strong>Core Truth:</strong> Manual service always exists. Digital authority is singular.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Configuration Warnings and Requirements */}
                  {venueMode === 'basic' && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Printer size={16} className="text-blue-600" />
                        </div>
                        <div className="text-sm text-blue-800">
                          <p className="font-semibold mb-2">🔵 Basic Mode Requirements</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                              <span>Thermal printer must be configured and connected</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                              <span>POS system must be operational for order creation</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                              <span>Customer ordering and menus are disabled</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                              <span>Staff ordering in Tabeza is disabled</span>
                            </div>
                          </div>
                          <div className="mt-3 p-2 bg-blue-100 rounded border border-blue-300">
                            <p className="text-xs font-medium">Ideal for: Established venues with existing POS systems</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {venueMode === 'venue' && authorityMode === 'pos' && (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <div className="flex items-center gap-0.5">
                            <Menu size={8} className="text-yellow-600" />
                            <Printer size={8} className="text-yellow-600" />
                          </div>
                        </div>
                        <div className="text-sm text-yellow-800">
                          <p className="font-semibold mb-2">🟡 Hybrid POS Integration Mode</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></div>
                              <span>Customers can browse menus and send order requests</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></div>
                              <span>All orders must be confirmed in your POS system</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></div>
                              <span>Staff ordering in Tabeza is disabled</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></div>
                              <span>Receipts originate from POS and are mirrored digitally</span>
                            </div>
                          </div>
                          <div className="mt-3 p-2 bg-yellow-100 rounded border border-yellow-300">
                            <p className="text-xs font-medium">Best for: Venues wanting customer interaction while keeping existing POS workflows</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {venueMode === 'venue' && authorityMode === 'tabeza' && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Menu size={16} className="text-green-600" />
                        </div>
                        <div className="text-sm text-green-800">
                          <p className="font-semibold mb-2">🟢 Full Tabeza Mode</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                              <span>Complete customer ordering system with menus</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                              <span>Staff can manage orders directly in Tabeza</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                              <span>Digital receipts and payment processing</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                              <span>No POS system required</span>
                            </div>
                          </div>
                          <div className="mt-3 p-2 bg-green-100 rounded border border-green-300">
                            <p className="text-xs font-medium">Perfect for: New venues or those wanting to replace their POS system</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Hours Section */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Clock size={20} className="text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Business Hours</h3>
                    <p className="text-sm text-gray-500">Set when your restaurant is open</p>
                  </div>
                </div>

                {/* Mode Selection */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <button
                    onClick={() => setBusinessHoursMode('simple')}
                    className={`p-3 rounded-lg text-center transition ${
                      businessHoursMode === 'simple'
                        ? 'bg-orange-100 border-2 border-orange-500 text-orange-700'
                        : 'bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Sun size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">Simple</span>
                    <p className="text-xs text-gray-500 mt-1">Same hours daily</p>
                  </button>
                  
                  <button
                    onClick={() => setBusinessHoursMode('advanced')}
                    className={`p-3 rounded-lg text-center transition ${
                      businessHoursMode === 'advanced'
                        ? 'bg-orange-100 border-2 border-orange-500 text-orange-700'
                        : 'bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Calendar size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">Advanced</span>
                    <p className="text-xs text-gray-500 mt-1">Different per day</p>
                  </button>
                  
                  <button
                    onClick={() => setBusinessHoursMode('24hours')}
                    className={`p-3 rounded-lg text-center transition ${
                      businessHoursMode === '24hours'
                        ? 'bg-orange-100 border-2 border-orange-500 text-orange-700'
                        : 'bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Clock size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">24 Hours</span>
                    <p className="text-xs text-gray-500 mt-1">Always open</p>
                  </button>
                </div>

                {/* Simple Mode */}
                {businessHoursMode === 'simple' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Opening Time
                        </label>
                        <input
                          type="time"
                          value={simpleHours.openTime}
                          onChange={(e) => setSimpleHours({...simpleHours, openTime: e.target.value})}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Closing Time
                        </label>
                        <input
                          type="time"
                          value={simpleHours.closeTime}
                          onChange={(e) => setSimpleHours({...simpleHours, closeTime: e.target.value})}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <Moon size={16} className="text-gray-600" />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simpleHours.closeNextDay}
                          onChange={(e) => setSimpleHours({...simpleHours, closeNextDay: e.target.checked})}
                          className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">
                          Close next day (for bars/restaurants open past midnight)
                        </span>
                      </label>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        <strong>Example:</strong> If you open at 10:00 AM and close at 3:00 AM the next day, 
                        set opening time to 10:00, closing time to 03:00, and check "Close next day".
                      </p>
                    </div>
                  </div>
                )}

                {/* Advanced Mode */}
                {businessHoursMode === 'advanced' && (
                  <div className="space-y-3">
                    {advancedHours.map((day, index) => (
                      <div key={day.day} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={day.open}
                              onChange={(e) => handleAdvancedDayChange(index, 'open', e.target.checked)}
                              className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                            />
                            <span className="font-medium text-gray-700">{day.label}</span>
                          </label>
                          {!day.open && (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">Closed</span>
                          )}
                        </div>
                        
                        {day.open && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Open</label>
                              <input
                                type="time"
                                value={day.openTime}
                                onChange={(e) => handleAdvancedDayChange(index, 'openTime', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Close</label>
                              <input
                                type="time"
                                value={day.closeTime}
                                onChange={(e) => handleAdvancedDayChange(index, 'closeTime', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
                              />
                            </div>
                          </div>
                        )}
                        
                        {day.open && (
                          <div className="mt-2 flex items-center gap-2">
                            <Moon size={14} className="text-gray-500" />
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={day.openNextDay}
                                onChange={(e) => handleAdvancedDayChange(index, 'openNextDay', e.target.checked)}
                                className="w-3 h-3 text-orange-500 rounded focus:ring-orange-500"
                              />
                              <span className="text-xs text-gray-600">
                                Close next day (open past midnight)
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 24 Hours Mode */}
                {businessHoursMode === '24hours' && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock size={32} className="text-green-600" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-800 mb-2">24/7 Operation</h4>
                    <p className="text-gray-600 mb-4">Your restaurant will be shown as open 24 hours a day, 7 days a week.</p>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 inline-block">
                      <p className="text-sm text-green-800 font-medium">Always Open ✓</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSaveBusinessHours}
                  disabled={savingHours}
                  className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {savingHours ? 'Saving...' : 'Save Business Hours'}
                </button>
              </div>

              {/* Table Setup Section */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <Grid3X3 size={20} className="text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Table Setup</h3>
                    <p className="text-sm text-gray-500">Configure customer table selection</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Enable Table Setup Toggle */}
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                      <Grid3X3 size={18} className="text-teal-600" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Require Table Selection</span>
                        <p className="text-xs text-gray-500">Customers must select their table before ordering</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={tableSettings.table_setup_enabled}
                      onChange={(e) => setTableSettings({
                        ...tableSettings, 
                        table_setup_enabled: e.target.checked
                      })}
                      className="w-5 h-5 text-teal-500 rounded focus:ring-teal-500"
                    />
                  </label>

                  {/* Table Count Configuration */}
                  {tableSettings.table_setup_enabled && (
                    <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Number of Tables
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={tableSettings.table_count}
                          onChange={(e) => setTableSettings({
                            ...tableSettings, 
                            table_count: parseInt(e.target.value) || 1
                          })}
                          className="w-24 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none text-center font-medium"
                        />
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">
                            Tables will be numbered 1 to {tableSettings.table_count}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Range: 1-100 tables
                          </p>
                        </div>
                      </div>
                      
                      {/* Preview */}
                      <div className="mt-3 p-3 bg-white border border-teal-200 rounded-lg">
                        <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
                        <div className="grid grid-cols-6 gap-1">
                          {Array.from({ length: Math.min(tableSettings.table_count, 12) }, (_, i) => (
                            <div
                              key={i + 1}
                              className="w-8 h-8 bg-teal-100 border border-teal-300 rounded flex items-center justify-center text-xs font-medium text-teal-700"
                            >
                              {i + 1}
                            </div>
                          ))}
                          {tableSettings.table_count > 12 && (
                            <div className="w-8 h-8 bg-gray-100 border border-gray-300 rounded flex items-center justify-center text-xs text-gray-500">
                              ...
                            </div>
                          )}
                        </div>
                        {tableSettings.table_count > 12 && (
                          <p className="text-xs text-gray-500 mt-2">
                            Showing first 12 of {tableSettings.table_count} tables
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Information Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">How Table Setup Works:</p>
                        <ul className="text-xs space-y-1 ml-2">
                          <li>• When enabled, customers must select their table number before ordering</li>
                          <li>• Orders will be linked to the selected table for easy identification</li>
                          <li>• Staff can see which table each order came from</li>
                          <li>• When disabled, customers can order without table selection</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveTableSettings}
                  disabled={savingTableSettings}
                  className="w-full mt-4 bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {savingTableSettings ? 'Saving...' : 'Save Table Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <MessageSquare size={24} className="text-indigo-600" />
                  <h3 className="text-xl font-bold text-gray-800">Send Feedback</h3>
                </div>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {feedbackSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} className="text-green-600" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-2">Thank You!</h4>
                  <p className="text-gray-600">Your feedback has been sent successfully.</p>
                  <p className="text-sm text-gray-500 mt-4">This window will close in 3 seconds...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedbackError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-600" />
                        <p className="text-sm text-red-800">{feedbackError}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={feedbackForm.name}
                      onChange={(e) => setFeedbackForm({...feedbackForm, name: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={feedbackForm.email}
                      onChange={(e) => setFeedbackForm({...feedbackForm, email: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={feedbackForm.message}
                      onChange={(e) => setFeedbackForm({...feedbackForm, message: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none resize-none h-32"
                      placeholder="Tell us what you think, report issues, or suggest improvements..."
                    />
                  </div>

                  <button
                    onClick={handleSendFeedback}
                    disabled={sendingFeedback}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sendingFeedback ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        Send Feedback
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Venue Mode Configuration Modal */}
      {showVenueModeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Venue Configuration</h3>
                <button
                  onClick={() => setShowVenueModeModal(false)}
                  disabled={savingVenueMode}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {savingVenueMode ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Saving configuration...</p>
                </div>
              ) : (
                <VenueModeOnboarding
                  onComplete={handleSaveVenueMode}
                  onCancel={() => setShowVenueModeModal(false)}
                  isForced={!onboardingCompleted}
                  barId={barInfo.id}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Configuration Change Confirmation Modal */}
      {showConfirmationModal && pendingConfigChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <AlertTriangle size={24} className="text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Confirm Configuration Change</h3>
                  <p className="text-sm text-gray-600">This change may affect your venue's operations</p>
                </div>
              </div>

              {/* Configuration Change Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-800 mb-3">Configuration Change Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Current Mode:</span>
                    <div className="font-medium text-gray-800">
                      {venueMode === 'basic' ? 'Tabeza Basic' : 'Tabeza Venue'} 
                      ({authorityMode === 'pos' ? 'POS Authority' : 'Tabeza Authority'})
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">New Mode:</span>
                    <div className="font-medium text-gray-800">
                      {pendingConfigChange.venue_mode === 'basic' ? 'Tabeza Basic' : 'Tabeza Venue'} 
                      ({pendingConfigChange.authority_mode === 'pos' ? 'POS Authority' : 'Tabeza Authority'})
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {configChangeWarnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-yellow-800 mb-2">Important Considerations</h4>
                      <ul className="space-y-2 text-sm text-yellow-700">
                        {configChangeWarnings.map((warning, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></div>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleCancelConfigurationChange}
                  disabled={savingVenueMode}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmConfigurationChange}
                  disabled={savingVenueMode}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium flex items-center gap-2"
                >
                  {savingVenueMode ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Confirm Change
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}