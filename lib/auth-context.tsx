import type { AuthError, Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { AUTH_CALLBACK_URL, type AuthRedirectParams } from '@/lib/auth-redirect';
import { bootstrapOrganization } from '@/lib/organizations';
import { supabase } from '@/lib/supabase';

type AuthFlowError = Error | AuthError;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: AuthFlowError | null }>;
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: AuthFlowError | null; needsEmailConfirmation: boolean }>;
  completeAuthCallback: (
    params: AuthRedirectParams
  ) => Promise<{ error: AuthFlowError | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isSessionPublicationBlocked = useRef(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isMounted) setSession(data.session);
      })
      .catch(() => {
        if (isMounted) setSession(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Immediate-session signup provisions the user's organization before exposing the session
      // to the protected navigator. Other auth changes (including sign-in) apply immediately.
      if (isSessionPublicationBlocked.current && nextSession) return;
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function provisionSession(nextSession: Session) {
    try {
      const { error } = await bootstrapOrganization();
      if (error) throw error;
      setSession(nextSession);
      return { error: null };
    } catch (failure) {
      const error = failure instanceof Error ? failure : new Error('Unable to set up your organization.');
      try {
        const { error: cleanupError } = await supabase.auth.signOut({ scope: 'local' });
        if (cleanupError) throw cleanupError;
      } catch {
        return { error: new Error(`${error.message} Local sign-out also failed; please restart Workify and sign out before retrying.`) };
      } finally {
        setSession(null);
      }
      return { error };
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signInWithPassword: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
      },
      signUpWithPassword: async (email, password) => {
        isSessionPublicationBlocked.current = true;
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: AUTH_CALLBACK_URL },
          });
          if (error || !data.session) {
            // Supabase returns `session: null` when email confirmation is required.
            return { error, needsEmailConfirmation: !error };
          }
          const provisioned = await provisionSession(data.session);
          return { ...provisioned, needsEmailConfirmation: false };
        } finally {
          isSessionPublicationBlocked.current = false;
        }
      },
      completeAuthCallback: async ({ accessToken, refreshToken, type }) => {
        if (type !== 'signup') {
          return { error: new Error('Only signup confirmation links are supported.') };
        }
        isSessionPublicationBlocked.current = true;
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error || !data.session) {
            return { error: error ?? new Error('The confirmation link did not create a session.') };
          }
          return await provisionSession(data.session);
        } finally {
          isSessionPublicationBlocked.current = false;
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
