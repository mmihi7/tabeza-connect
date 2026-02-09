'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bar, setBar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        loadUserData(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('🔐 Checking authentication...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Auth session error:', error);
        router.push('/login');
        return;
      }
      
      if (!session) {
        console.log('❌ No session found, redirecting to login');
        router.push('/login');
        return;
      }

      console.log('✅ Session found:', { userId: session.user.id, email: session.user.email });
      await loadUserData(session.user);
    } catch (error) {
      console.error('❌ Auth check error:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (user: any) => {
    setUser(user);
    
    const barId = user.user_metadata?.bar_id;
    console.log('🔐 Loading user data:', { userId: user.id, barId });
    
    if (barId) {
      try {
        const { data: barData, error } = await supabase
          .from('bars')
          .select('*')
          .eq('id', barId)
          .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no rows
        
        if (error) {
          console.error('❌ Error loading bar data:', error);
          console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
        } else if (barData) {
          console.log('✅ Bar data loaded:', barData);
          setBar(barData);
        } else {
          console.warn('⚠️ No bar found with ID:', barId);
        }
      } catch (error) {
        console.error('❌ Exception loading bar data:', error);
      }
    }
  };

  const signOut = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear all local storage related to auth
      localStorage.removeItem('currentBarId');
      localStorage.removeItem('tabeza-staff-auth');
      
      // Clear any session storage
      sessionStorage.clear();
      
      console.log('✅ Signed out successfully');
      
      // Redirect to login
      router.push('/login');
    } catch (error) {
      console.error('❌ Error signing out:', error);
      // Force redirect even if signout fails
      router.push('/login');
    }
  };

  return { user, bar, loading, signOut };
}