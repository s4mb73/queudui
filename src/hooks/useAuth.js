import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadingTimeout = useRef(null);

  // Load profile from profiles table
  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.warn('Profile load error:', error.message);
      return null;
    }
    return data;
  }, []);

  // Initialize auth state using onAuthStateChange only (recommended by Supabase)
  useEffect(() => {
    let mounted = true;

    // Safety timeout - if auth doesn't resolve in 5s, stop loading
    loadingTimeout.current = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth timeout - forcing load complete');
        setLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          // Use setTimeout to avoid Supabase deadlock on token refresh
          setTimeout(async () => {
            if (!mounted) return;
            try {
              const p = await loadProfile(session.user.id);
              if (mounted) setProfile(p);
            } catch (e) {
              console.warn('Profile load failed:', e.message);
            }
            if (mounted) setLoading(false);
          }, 0);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Also do an initial check in case onAuthStateChange doesn't fire
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        setLoading(false);
      }
      // If session exists, onAuthStateChange will handle it
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }, []);

  // Admin: invite a new team member
  const inviteUser = useCallback(async (email, displayName, role = 'va') => {
    if (profile?.role !== 'admin') throw new Error('Only admins can invite users');

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: displayName, role },
    });

    // If admin API not available (client-side), use invite
    if (error?.message?.includes('not authorized')) {
      const { error: inviteErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          data: { display_name: displayName, role },
          shouldCreateUser: true,
        },
      });
      if (inviteErr) throw inviteErr;
      return { invited: true };
    }

    if (error) throw error;
    return data;
  }, [profile]);

  // Admin: update a team member's role
  const updateUserRole = useCallback(async (userId, newRole) => {
    if (profile?.role !== 'admin') throw new Error('Only admins can change roles');
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    if (error) throw error;
  }, [profile]);

  // Load all team members
  const loadTeam = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }, []);

  const isAdmin = profile?.role === 'admin';

  return {
    user,
    profile,
    loading,
    isAdmin,
    signIn,
    signOut,
    resetPassword,
    inviteUser,
    updateUserRole,
    loadTeam,
    loadProfile,
  };
}
