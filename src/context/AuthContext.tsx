import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  /**
   * The currently authenticated Supabase user.
   * Null while the initial session check is loading, and null when signed out.
   */
  user: User | null;
  /**
   * The user's profile row from public.profiles.
   * Null while loading or when signed out.
   */
  profile: Profile | null;
  /** True during the initial session hydration. Use to prevent flash-of-redirect. */
  isLoading: boolean;
  /** Signs out the current user and clears all context state. */
  signOut: () => Promise<void>;
  /**
   * Allows other parts of the app (e.g. Profile settings) to update the
   * in-memory profile without a full refetch.
   */
  updateProfile: (partial: Partial<Profile>) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Fetch the profile row for the given user ID. */
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // The profile trigger may not have fired yet on first sign-up —
      // treat a not-found as a soft failure rather than crashing.
      console.warn('Profile fetch failed:', error.message);
      setProfile(null);
    } else {
      setProfile(data as Profile);
    }
  }, []);

  useEffect(() => {
    // 1. Hydrate session on mount
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        fetchProfile(sessionUser.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // 2. Keep session in sync with Supabase auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        if (nextUser) {
          fetchProfile(nextUser.id);
        } else {
          setProfile(null);
        }
      },
    );

    return () => listener.subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange will fire and clear user/profile
  }, []);

  const updateProfile = useCallback((partial: Partial<Profile>) => {
    setProfile((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the auth context. Must be used inside <AuthProvider>.
 * Throws if called outside the provider so missing wrappers surface early.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
