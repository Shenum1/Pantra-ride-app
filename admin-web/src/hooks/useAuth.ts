import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: AdminUser | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  const loadSession = useCallback(async (session: Session | null) => {
    if (!session) {
      setState({ user: null, session: null, loading: false, error: null });
      return;
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('uid, displayName, email, role')
      .eq('uid', session.user.id)
      .single();

    if (error || !profile) {
      await supabase.auth.signOut();
      setState({ user: null, session: null, loading: false, error: 'Profile not found.' });
      return;
    }

    if (profile.role !== 'admin') {
      await supabase.auth.signOut();
      setState({
        user: null,
        session: null,
        loading: false,
        error: 'Access denied. This account does not have admin privileges.',
      });
      return;
    }

    setState({
      user: {
        id: profile.uid,
        email: profile.email ?? session.user.email ?? '',
        name: profile.displayName || profile.email || session.user.email || 'Admin',
      },
      session,
      loading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => loadSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadSession]);

  const login = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
      return false;
    }
    await loadSession(data.session);
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setState({ user: null, session: null, loading: false, error: null });
  };

  return { ...state, login, logout };
}
