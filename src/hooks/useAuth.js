import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.warn('Session error:', error.message);
        if (session?.user && mounted) {
          setUser(session.user);
          try {
            const p = await loadProfile(session.user.id);
            if (mounted) setProfile(p);
          } catch (e) {
            console.warn('Profile load failed:', e.message);
          }
        }
      } catch (e) {
        console.warn('Auth init error:', e.message);
      }
      if (mounted) setLoading(false);
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          try {
            const p = await loadProfile(session.user.id);
            if (mounted) setProfile(p);
          } catch (e) {
            console.warn('Profile load failed:', e.message);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
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
