// apps/staff/app/signup/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, MapPin, Lock, CheckCircle, AlertCircle, Eye, EyeOff, UserCheck, Shield, Clock, TrendingUp, ArrowRight, Printer, Menu, Store, Zap, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    venueMode: '' as 'basic' | 'venue' | '',
    hasPOS: false, // For Venue mode only - determines authority mode
    premiseName: '',
    location: '',
    phone: '',
    agreeToTerms: false,
    agreeToPrivacy: false,
  });

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep1 = () => {
    if (!formData.email || !formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.venueMode) {
      setError('Please select a venue mode');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    // Premise details
    if (!formData.premiseName.trim()) {
      setError('Please enter your premise name');
      return false;
    }
    if (!formData.location.trim()) {
      setError('Please enter your location');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Please enter your phone number');
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    // Terms & Conditions
    if (!formData.agreeToTerms) {
      setError('You must agree to the Terms and Conditions');
      return false;
    }
    if (!formData.agreeToPrivacy) {
      setError('You must agree to the Privacy Policy');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2); // Mode selection
    } else if (step === 2 && validateStep2()) {
      setStep(3); // Premise details (for both Basic and Venue)
    } else if (step === 3 && validateStep3()) {
      setStep(4); // Terms & Conditions
    }
  };

  const handleSignup = async () => {
    if (!validateStep4()) return;

    setLoading(true);
    setError('');

    try {
      // First, check if this email already has an account
      const { data: existingSession } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      let userId: string;
      let isExistingUser = false;

      if (existingSession?.user) {
        // User exists and password is correct - check if they have a bar
        userId = existingSession.user.id;
        isExistingUser = true;

        const { data: existingBars } = await supabase
          .from('user_bars')
          .select('bar_id')
          .eq('user_id', userId);

        if (existingBars && existingBars.length > 0) {
          // User already has a bar - they should use login instead
          setError('This account already exists with a venue. Please use the login page.');
          await supabase.auth.signOut(); // Sign them out
          setLoading(false);
          return;
        }
        // If no bars exist, we'll let them complete the setup
      } else {
        // Try to create new user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });

        if (authError) {
          // Check for specific error messages
          if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
            setError('This email is already registered. If you forgot your password, please use the login page to reset it.');
            setLoading(false);
            return;
          }
          throw authError;
        }
        
        if (!authData.user) throw new Error('Failed to create user');
        userId = authData.user.id;
      }

      // Generate slug from premise name with uniqueness check
      let slug = formData.premiseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      // Check if slug exists and add suffix if needed
      const { data: existingBarSlugs } = await supabase
        .from('bars')
        .select('slug')
        .like('slug', `${slug}%`);
      
      if (existingBarSlugs && existingBarSlugs.length > 0) {
        // Add timestamp suffix to make it unique
        slug = `${slug}-${Date.now()}`;
      }

      // Determine authority mode based on venue mode and hasPOS checkbox
      let authorityMode: 'pos' | 'tabeza';
      if (formData.venueMode === 'basic') {
        authorityMode = 'pos'; // Basic mode always uses POS authority
      } else {
        // Venue mode: use POS if they have one, otherwise Tabeza
        authorityMode = formData.hasPOS ? 'pos' : 'tabeza';
      }

      // Determine configuration based on authority mode
      const posIntegrationEnabled = authorityMode === 'pos';
      const printerRequired = authorityMode === 'pos';

      // Create bar with full configuration
      const { data: bar, error: barError } = await supabase
        .from('bars')
        .insert({
          name: formData.premiseName,
          location: formData.location,
          phone: formData.phone,
          email: formData.email,
          slug,
          venue_mode: formData.venueMode,
          authority_mode: authorityMode,
          pos_integration_enabled: posIntegrationEnabled,
          printer_required: printerRequired,
          onboarding_completed: true,
        })
        .select()
        .single();

      if (barError) throw barError;

      console.log('✅ Bar created successfully:', bar.id);

      // Create user-bar association with error handling
      const { error: userBarError } = await supabase
        .from('user_bars')
        .insert({
          user_id: userId,
          bar_id: bar.id,
          role: 'owner'
        });

      if (userBarError) {
        console.error('❌ Failed to create user-bar association:', userBarError);
        throw new Error(`Failed to link user to bar: ${userBarError.message}`);
      }

      console.log('✅ User-bar association created successfully');

      // Update user metadata with bar_id
      const { error: updateUserError } = await supabase.auth.updateUser({
        data: { bar_id: bar.id }
      });

      if (updateUserError) {
        console.error('❌ Failed to update user metadata:', updateUserError);
        // Don't throw here - this is not critical since we have user_bars
      }

      console.log('✅ User metadata updated with bar_id');

      console.log('✅ User metadata updated with bar_id');

      // Small delay to ensure database transaction is fully committed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate based on printer requirement
      if (printerRequired) {
        // Redirect to printer setup page for Basic or Venue+POS
        console.log('🖨️ Redirecting to printer setup...');
        router.push('/setup/printer');
      } else {
        // Navigate directly to dashboard for Venue+Tabeza
        console.log('📊 Redirecting to dashboard...');
        router.push('/dashboard');
      }

      // Show success message if this was a recovery scenario
      if (isExistingUser) {
        console.log('Successfully completed setup for existing user');
      }

    } catch (err: any) {
      console.error('Signup error:', err);
      
      // Provide helpful error messages
      if (err.message?.includes('duplicate key') && err.message?.includes('slug')) {
        setError('A venue with this name already exists. Please try a different name.');
      } else if (err.message?.includes('bars_venue_authority_check')) {
        setError('Invalid venue configuration. Please contact support.');
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center mb-4">
            <Logo size="lg" variant="white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-3">Join Tabeza</h1>
          <p className="text-lg md:text-xl text-center text-orange-50 max-w-2xl mx-auto mb-2">
            Start managing your bar tabs digitally and say goodbye to lost revenue
          </p>
          <div className="inline-block bg-white/20 backdrop-blur-sm px-6 py-2 rounded-full">
            <p className="text-lg font-semibold text-white">✨ 100% Free Forever</p>
          </div>
          {/* Learn More Link */}
          <div className="mt-4">
            <button
              onClick={() => router.push('/learn-more')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition text-white"
            >
              <span>📊 See How It Works</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Benefits Bar */}
      <div className="bg-white border-b-2 border-orange-100 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <UserCheck size={20} className="text-orange-600" />
              </div>
              <div className="text-sm font-semibold text-gray-800">Personal Tabs</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Shield size={20} className="text-orange-600" />
              </div>
              <div className="text-sm font-semibold text-gray-800">Zero Revenue Loss</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock size={20} className="text-orange-600" />
              </div>
              <div className="text-sm font-semibold text-gray-800">Real-Time Tracking</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <TrendingUp size={20} className="text-orange-600" />
              </div>
              <div className="text-sm font-semibold text-gray-800">Better Analytics</div>
            </div>
          </div>
        </div>
      </div>

      {/* Signup Form Section */}
      <div className="py-12 px-4">
        <div className="w-full max-w-md mx-auto">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((stepNum, index) => (
                <React.Fragment key={stepNum}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step >= stepNum ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > stepNum ? <CheckCircle size={20} /> : stepNum}
                  </div>
                  {stepNum < 4 && (
                    <div className={`w-12 h-1 ${step >= stepNum + 1 ? 'bg-orange-500' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Step 1: Account Info */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Create Your Account</h2>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      placeholder="your@email.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition-all"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 2: Mode Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Choose Your Setup</h2>
                <p className="text-gray-600 mb-6">Select the option that best matches your venue's needs</p>
                
                <div className="space-y-4">
                  {/* Basic Mode */}
                  <div 
                    onClick={() => updateField('venueMode', 'basic')}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                      formData.venueMode === 'basic' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Printer size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">Tabeza Basic</h3>
                        <p className="text-xs text-blue-600">Transaction & Receipt Bridge</p>
                      </div>
                      {formData.venueMode === 'basic' && (
                        <Check size={20} className="text-green-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      I have a POS system and want digital receipts
                    </p>
                    <div className="flex gap-1">
                      <span>🖨️</span><span>📱</span><span>💳</span>
                    </div>
                  </div>

                  {/* Venue Mode */}
                  <div 
                    onClick={() => updateField('venueMode', 'venue')}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                      formData.venueMode === 'venue' 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Menu size={20} className="text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">Tabeza Venue</h3>
                        <p className="text-xs text-green-600">Customer Interaction & Service</p>
                      </div>
                      {formData.venueMode === 'venue' && (
                        <Check size={20} className="text-green-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      I want full customer ordering and menus
                    </p>
                    <div className="flex gap-1">
                      <span>📋</span><span>💬</span><span>💳</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!formData.venueMode}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Premise Details */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Premise Details</h2>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Premise Name
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Logo size="sm" />
                    </div>
                    <input
                      type="text"
                      value={formData.premiseName}
                      onChange={(e) => updateField('premiseName', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      placeholder="Your Premise Name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Location
                  </label>
                  <div className="relative">
                    <MapPin size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => updateField('location', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      placeholder="City, Country"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      placeholder="+254 700 000 000"
                    />
                  </div>
                </div>

                {/* POS Checkbox - Only for Venue mode */}
                {formData.venueMode === 'venue' && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hasPOS}
                        onChange={(e) => updateField('hasPOS', e.target.checked)}
                        className="mt-1 w-5 h-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-semibold text-gray-800 block">
                          I have a POS system
                        </span>
                        <span className="text-xs text-gray-600">
                          Tabeza will integrate with your existing POS
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Terms & Conditions */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Terms & Conditions</h2>
                
                <div className="bg-gray-50 rounded-xl p-4 max-h-48 overflow-y-auto border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-2">Tabeza Platform Agreement</h3>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p>By using Tabeza, you agree to:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Provide accurate business information</li>
                      <li>Maintain the security of your account credentials</li>
                      <li>Comply with local laws and regulations</li>
                      <li>Use the platform responsibly and ethically</li>
                      <li>Accept our data processing practices</li>
                    </ul>
                    <p className="mt-3">
                      Tabeza provides digital tab management services. You are responsible for all transactions processed through your account.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.agreeToTerms}
                      onChange={(e) => updateField('agreeToTerms', e.target.checked)}
                      className="mt-1 w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">
                      I agree to the <a href="/terms" target="_blank" className="text-orange-600 font-semibold hover:underline">Terms and Conditions</a>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.agreeToPrivacy}
                      onChange={(e) => updateField('agreeToPrivacy', e.target.checked)}
                      className="mt-1 w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">
                      I agree to the <a href="/privacy" target="_blank" className="text-orange-600 font-semibold hover:underline">Privacy Policy</a>
                    </span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(3)}
                    disabled={loading}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSignup}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </button>
                </div>
              </div>
            )}

            {/* Login Link */}
            <div className="mt-6 text-center text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => router.push('/login')}
                className="text-orange-600 font-semibold hover:underline"
              >
                Sign In
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            By signing up, you agree to our <a href="/terms" className="text-orange-500 hover:underline">Terms</a> and <a href="/privacy" className="text-orange-500 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}