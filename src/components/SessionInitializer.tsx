'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createClient } from '@/utils/supabase/client';
import { loginSuccess, logout } from '@/store/authSlice';
import api from '@/api/axios';

export default function SessionInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const supabase = createClient();

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        try {
          const res = await api.get('/user/profile');
          const profile = res.data;
          dispatch(loginSuccess({
            user: {
              id: profile.id,
              userId: profile.userId,
              email: profile.email,
              role: profile.role
            },
            token: 'session_active'
          }));
        } catch (e) {
          console.error('Session sync error:', e);
          dispatch(logout());
        }
      } else {
        dispatch(logout());
      }
    };

    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const res = await api.get('/user/profile');
          const profile = res.data;
          dispatch(loginSuccess({
            user: {
              id: profile.id,
              userId: profile.userId,
              email: profile.email,
              role: profile.role
            },
            token: 'session_active'
          }));
        } catch (e) {
          console.error('Auth state change sync error:', e);
        }
      } else if (event === 'SIGNED_OUT') {
        dispatch(logout());
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  return <>{children}</>;
}
